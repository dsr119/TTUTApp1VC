"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/components/ActionForm";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseLocalDate } from "@/lib/time";

/** Open (or create) the one-to-one conversation with another person. */
export async function openDirectMessage(formData: FormData) {
  const user = await requireUser();
  const otherId = z.string().min(1).parse(formData.get("userId"));
  if (otherId === user.id) redirect("/chat");
  const other = await db.user.findFirst({ where: { id: otherId, active: true } });
  if (!other) redirect("/directory");
  const existing = await db.conversation.findFirst({
    where: { isGroup: false, AND: [{ members: { some: { userId: user.id } } }, { members: { some: { userId: otherId } } }] },
  });
  const convo =
    existing ??
    (await db.conversation.create({
      data: { isGroup: false, createdById: user.id, members: { create: [{ userId: user.id }, { userId: otherId }] } },
    }));
  redirect(`/chat/${convo.id}`);
}

export async function createGroup(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const name = z.string().trim().min(1, "Name the group.").max(80).safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message };
  const memberIds = [...new Set(formData.getAll("members").map(String))].filter((id) => id !== user.id);
  if (memberIds.length === 0) return { error: "Add at least one other person." };
  const valid = await db.user.count({ where: { id: { in: memberIds }, active: true } });
  if (valid !== memberIds.length) return { error: "Someone you picked isn't available." };
  const convo = await db.conversation.create({
    data: {
      name: name.data,
      isGroup: true,
      createdById: user.id,
      members: { create: [user.id, ...memberIds].map((userId) => ({ userId })) },
    },
  });
  await audit(user.id, "chat.group_create", "Conversation", convo.id, { members: memberIds.length + 1 });
  redirect(`/chat/${convo.id}`);
}

export async function sendMessage(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = z.string().min(1).parse(formData.get("conversationId"));
  const body = z.string().trim().min(1).max(4000).safeParse(formData.get("body"));
  if (!body.success) return { error: "Type a message first." };
  const member = await db.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: user.id } } });
  if (!member) return { error: "You're not in this conversation." };
  const now = new Date();
  await db.$transaction([
    db.message.create({ data: { conversationId, senderId: user.id, body: body.data, createdAt: now } }),
    db.conversation.update({ where: { id: conversationId }, data: { updatedAt: now } }),
    db.conversationMember.update({ where: { conversationId_userId: { conversationId, userId: user.id } }, data: { lastReadAt: now } }),
  ]);
  revalidatePath(`/chat/${conversationId}`);
  return { ok: " " };
}

export async function addGroupMembers(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const conversationId = z.string().min(1).parse(formData.get("conversationId"));
  const convo = await db.conversation.findFirst({ where: { id: conversationId, isGroup: true, members: { some: { userId: user.id } } } });
  if (!convo) return { error: "Group not found." };
  const ids = formData.getAll("members").map(String);
  if (ids.length === 0) return { error: "Pick someone to add." };
  await db.conversationMember.createMany({ data: ids.map((userId) => ({ conversationId, userId })), skipDuplicates: true });
  await audit(user.id, "chat.group_add", "Conversation", conversationId, { added: ids.length });
  revalidatePath(`/chat/${conversationId}`);
  return { ok: "Added." };
}

export async function leaveGroup(formData: FormData) {
  const user = await requireUser();
  const conversationId = z.string().min(1).parse(formData.get("conversationId"));
  await db.conversationMember.deleteMany({ where: { conversationId, userId: user.id, conversation: { isGroup: true } } });
  await audit(user.id, "chat.group_leave", "Conversation", conversationId);
  redirect("/chat");
}

export async function postAnnouncement(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z
    .object({ title: z.string().trim().min(1, "Add a title.").max(120), body: z.string().trim().min(1, "Write the update.").max(5000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const row = await db.announcement.create({ data: { ...parsed.data, authorId: user.id } });
  await audit(user.id, "announcement.create", "Announcement", row.id);
  revalidatePath("/", "layout");
  return { ok: "Posted." };
}

export async function deleteAnnouncement(formData: FormData) {
  const user = await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  const isAdmin = user.role !== "STAFF";
  const deleted = await db.announcement.deleteMany({ where: { id, ...(isAdmin ? {} : { authorId: user.id }) } });
  if (deleted.count) await audit(user.id, "announcement.delete", "Announcement", id);
  revalidatePath("/", "layout");
}

export async function requestTimeOff(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z
    .object({ startDate: z.string(), endDate: z.string(), reason: z.string().max(500).optional().transform((v) => v?.trim() || null) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the dates." };
  // Dates are calendar days; store them as UTC midnight so they never shift.
  const start = parseLocalDate(parsed.data.startDate, "UTC");
  const end = parseLocalDate(parsed.data.endDate, "UTC");
  if (!start || !end) return { error: "Pick a first and last day." };
  if (end < start) return { error: "The last day can't be before the first day." };
  const row = await db.timeOffRequest.create({ data: { userId: user.id, startDate: start, endDate: end, reason: parsed.data.reason } });
  await audit(user.id, "timeoff.request", "TimeOffRequest", row.id);
  revalidatePath("/", "layout");
  return { ok: "Request sent. You'll see the answer here." };
}

export async function cancelTimeOff(formData: FormData) {
  const user = await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  const deleted = await db.timeOffRequest.deleteMany({ where: { id, userId: user.id, status: "PENDING" } });
  if (deleted.count) await audit(user.id, "timeoff.cancel", "TimeOffRequest", id);
  revalidatePath("/", "layout");
}
