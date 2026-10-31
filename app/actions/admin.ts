"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/ActionForm";
import { audit } from "@/lib/audit";
import { hashPassword, requireAdmin, requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseLocalDateTime, validateShift } from "@/lib/time";

export type Decision = "APPROVED" | "DENIED";

const reviewSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "DENIED"]),
  reviewNote: z
    .string()
    .max(500)
    .optional()
    .transform((v) => v?.trim() || null),
});

function parseReview(decision: Decision, formData: FormData) {
  return reviewSchema.parse({
    id: formData.get("id"),
    decision,
    reviewNote: formData.get("reviewNote") ?? undefined,
  });
}

export async function reviewTimeEntry(decision: Decision, formData: FormData) {
  const admin = await requireAdmin();
  const { id, reviewNote } = parseReview(decision, formData);
  const updated = await db.timeEntry.updateMany({
    where: { id, status: "PENDING" },
    data: { status: decision, reviewedById: admin.id, reviewedAt: new Date(), reviewNote },
  });
  if (updated.count) await audit(admin.id, `time.entry_${decision.toLowerCase()}`, "TimeEntry", id);
  revalidatePath("/", "layout");
}

export async function reviewChangeRequest(decision: Decision, formData: FormData) {
  const admin = await requireAdmin();
  const { id, reviewNote } = parseReview(decision, formData);
  await db.$transaction(async (tx) => {
    const req = await tx.timeChangeRequest.findFirst({ where: { id, status: "PENDING" }, include: { timeEntry: true } });
    if (!req) return;
    await tx.timeChangeRequest.update({
      where: { id },
      data: { status: decision, reviewedById: admin.id, reviewedAt: new Date(), reviewNote },
    });
    if (decision === "APPROVED") {
      await tx.timeEntry.update({
        where: { id: req.timeEntryId },
        data: {
          clockIn: req.proposedClockIn,
          clockOut: req.proposedClockOut,
          serviceId: req.proposedServiceId,
          clientId: req.proposedClientId,
          note: req.proposedNote,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: `time.change_${decision.toLowerCase()}`,
        entityType: "TimeChangeRequest",
        entityId: id,
        details: {
          timeEntryId: req.timeEntryId,
          before: { clockIn: req.timeEntry.clockIn.toISOString(), clockOut: req.timeEntry.clockOut?.toISOString() ?? null },
          after: { clockIn: req.proposedClockIn.toISOString(), clockOut: req.proposedClockOut.toISOString() },
        },
      },
    });
  });
  revalidatePath("/", "layout");
}

export async function reviewTimeOff(decision: Decision, formData: FormData) {
  const admin = await requireAdmin();
  const { id, reviewNote } = parseReview(decision, formData);
  const updated = await db.timeOffRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: decision, reviewedById: admin.id, reviewedAt: new Date(), reviewNote },
  });
  if (updated.count) await audit(admin.id, `timeoff.${decision.toLowerCase()}`, "TimeOffRequest", id);
  revalidatePath("/", "layout");
}

const optionalId = z
  .string()
  .optional()
  .transform((v) => v || null);

export async function adminUpdateEntry(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      id: z.string().min(1),
      clockIn: z.string(),
      clockOut: z.string(),
      serviceId: optionalId,
      clientId: optionalId,
      note: z.string().max(1000).optional().transform((v) => v?.trim() || null),
      status: z.enum(["PENDING", "APPROVED", "DENIED"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const before = await db.timeEntry.findUnique({ where: { id: d.id } });
  if (!before) return { error: "That shift wasn't found." };
  const start = parseLocalDateTime(d.clockIn);
  const end = parseLocalDateTime(d.clockOut);
  const invalid = validateShift(start, end);
  if (invalid) return { error: invalid };
  await db.timeEntry.update({
    where: { id: d.id },
    data: {
      clockIn: start!,
      clockOut: end!,
      serviceId: d.serviceId,
      clientId: d.clientId,
      note: d.note,
      status: d.status,
      ...(d.status !== before.status ? { reviewedById: admin.id, reviewedAt: new Date() } : {}),
    },
  });
  await audit(admin.id, "time.admin_edit", "TimeEntry", d.id, {
    before: { clockIn: before.clockIn.toISOString(), clockOut: before.clockOut?.toISOString() ?? null, status: before.status },
    after: { clockIn: start!.toISOString(), clockOut: end!.toISOString(), status: d.status },
  });
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

// ----- Rates and services (owner only) -----

const money = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 10000), "Enter a dollar amount.");

export async function setStaffRate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = z.object({ userId: z.string().min(1), rate: money }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await db.user.update({ where: { id: parsed.data.userId }, data: { hourlyRate: parsed.data.rate } });
  await audit(owner.id, "rate.staff_base", "User", parsed.data.userId);
  revalidatePath("/admin/rates");
  return { ok: "Saved." };
}

export async function saveService(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(1, "Name the service.").max(100),
      defaultRate: money,
      active: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { id, name, defaultRate } = parsed.data;
  const clash = await db.service.findFirst({ where: { name, NOT: id ? { id } : undefined } });
  if (clash) return { error: "A service with that name already exists." };
  const data = { name, defaultRate, active: id ? parsed.data.active === "on" : true };
  const row = id ? await db.service.update({ where: { id }, data }) : await db.service.create({ data });
  await audit(owner.id, id ? "service.update" : "service.create", "Service", row.id);
  revalidatePath("/admin/rates");
  return { ok: "Saved." };
}

export async function setServiceOverride(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = z
    .object({ userId: z.string().min(1, "Pick a staff member."), serviceId: z.string().min(1, "Pick a service."), rate: money })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { userId, serviceId, rate } = parsed.data;
  if (rate === null) {
    await db.staffServiceRate.deleteMany({ where: { userId, serviceId } });
  } else {
    await db.staffServiceRate.upsert({
      where: { userId_serviceId: { userId, serviceId } },
      update: { rate },
      create: { userId, serviceId, rate },
    });
  }
  await audit(owner.id, rate === null ? "rate.override_removed" : "rate.override_set", "StaffServiceRate", null, { userId, serviceId });
  revalidatePath("/admin/rates");
  return { ok: rate === null ? "Override removed." : "Saved." };
}

// ----- People (owner only) -----

const roleSchema = z.enum(["STAFF", "ADMIN", "OWNER"]);
const text = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => v?.trim() || null);

export async function createPerson(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Enter a name.").max(100),
      email: z.string().trim().toLowerCase().email("Enter a valid email."),
      title: text(100),
      phone: text(30),
      role: roleSchema,
      password: z.string().min(10, "Temporary password must be at least 10 characters."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { password, ...data } = parsed.data;
  if (await db.user.findUnique({ where: { email: data.email } })) return { error: "Someone already uses that email." };
  const user = await db.user.create({ data: { ...data, passwordHash: await hashPassword(password) } });
  await audit(owner.id, "user.create", "User", user.id, { role: data.role });
  revalidatePath("/", "layout");
  return { ok: `${data.name} was added.` };
}

export async function updatePerson(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = z
    .object({
      id: z.string().min(1),
      title: text(100),
      phone: text(30),
      role: roleSchema,
      managerId: optionalId,
      active: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { id, active, managerId, ...data } = parsed.data;
  if (id === owner.id && (data.role !== "OWNER" || active !== "on")) return { error: "You can't remove your own owner access." };
  if (managerId === id) return { error: "Someone can't report to themselves." };
  await db.user.update({ where: { id }, data: { ...data, managerId, active: active === "on" } });
  if (active !== "on") await db.session.deleteMany({ where: { userId: id } });
  await audit(owner.id, "user.update", "User", id, { role: data.role, active: active === "on" });
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

// ----- Kids (admins) -----

export async function addKid(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      firstName: z.string().trim().min(1, "Enter a first name.").max(50),
      lastInitial: z
        .string()
        .trim()
        .regex(/^[A-Za-z]$/, "Enter just the first letter of the last name.")
        .transform((v) => v.toUpperCase()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const kid = await db.client.create({ data: parsed.data });
  await audit(admin.id, "client.create", "Client", kid.id);
  revalidatePath("/admin/kids");
  return { ok: "Added." };
}

export async function toggleKid(formData: FormData) {
  const admin = await requireAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  const kid = await db.client.findUniqueOrThrow({ where: { id } });
  await db.client.update({ where: { id }, data: { active: !kid.active } });
  await audit(admin.id, kid.active ? "client.deactivate" : "client.activate", "Client", id);
  revalidatePath("/admin/kids");
}
