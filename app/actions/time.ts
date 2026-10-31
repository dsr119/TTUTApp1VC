"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/ActionForm";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_SHIFT_HOURS, hoursBetween, parseLocalDateTime, validateShift } from "@/lib/time";

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? v : null));
const note = z
  .string()
  .max(1000)
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null));

async function checkPicklists(serviceId: string | null, clientId: string | null) {
  if (serviceId && !(await db.service.findFirst({ where: { id: serviceId, active: true } }))) return "Pick a service from the list.";
  if (clientId && !(await db.client.findFirst({ where: { id: clientId, active: true } }))) return "Pick a kid from the list.";
  return null;
}

export async function clockIn(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const data = z.object({ serviceId: optionalId, clientId: optionalId }).parse({
    serviceId: formData.get("serviceId") ?? undefined,
    clientId: formData.get("clientId") ?? undefined,
  });
  const bad = await checkPicklists(data.serviceId, data.clientId);
  if (bad) return { error: bad };
  const open = await db.timeEntry.findFirst({ where: { userId: user.id, clockOut: null } });
  if (open) return { error: "You're already clocked in." };
  const entry = await db.timeEntry.create({
    data: { userId: user.id, clockIn: new Date(), source: "CLOCK", status: "APPROVED", ...data },
  });
  await audit(user.id, "time.clock_in", "TimeEntry", entry.id);
  revalidatePath("/", "layout");
  return { ok: "Clocked in." };
}

export async function clockOut(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const data = z.object({ serviceId: optionalId, clientId: optionalId, note }).parse({
    serviceId: formData.get("serviceId") ?? undefined,
    clientId: formData.get("clientId") ?? undefined,
    note: formData.get("note") ?? undefined,
  });
  const bad = await checkPicklists(data.serviceId, data.clientId);
  if (bad) return { error: bad };
  const open = await db.timeEntry.findFirst({ where: { userId: user.id, clockOut: null } });
  if (!open) return { error: "You're not clocked in." };
  const now = new Date();
  // A forgotten clock-out turns into a request so an admin can confirm the real end time.
  const tooLong = hoursBetween(open.clockIn, now) > MAX_SHIFT_HOURS;
  await db.timeEntry.update({
    where: { id: open.id },
    data: {
      clockOut: now,
      serviceId: data.serviceId ?? open.serviceId,
      clientId: data.clientId ?? open.clientId,
      note: data.note ?? open.note,
      status: tooLong ? "PENDING" : open.status,
    },
  });
  await audit(user.id, "time.clock_out", "TimeEntry", open.id, { flaggedLong: tooLong });
  revalidatePath("/", "layout");
  return { ok: tooLong ? "Clocked out. This shift was very long, so an admin will review it." : "Clocked out." };
}

const manualSchema = z.object({
  clockIn: z.string(),
  clockOut: z.string(),
  serviceId: z.string().min(1, "Pick the service you provided."),
  clientId: z.string().min(1, "Pick the kid you saw."),
  note,
});

export async function addManualEntry(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const start = parseLocalDateTime(parsed.data.clockIn);
  const end = parseLocalDateTime(parsed.data.clockOut);
  const invalid = validateShift(start, end) ?? (await checkPicklists(parsed.data.serviceId, parsed.data.clientId));
  if (invalid) return { error: invalid };
  const entry = await db.timeEntry.create({
    data: {
      userId: user.id,
      clockIn: start!,
      clockOut: end!,
      serviceId: parsed.data.serviceId,
      clientId: parsed.data.clientId,
      note: parsed.data.note,
      source: "MANUAL",
      status: "PENDING",
    },
  });
  await audit(user.id, "time.manual_entry", "TimeEntry", entry.id);
  revalidatePath("/", "layout");
  return { ok: "Submitted for approval." };
}

export async function requestChange(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z
    .object({
      timeEntryId: z.string().min(1),
      clockIn: z.string(),
      clockOut: z.string(),
      serviceId: optionalId,
      clientId: optionalId,
      note,
      reason: z.string().trim().min(3, "Say why the time needs to change.").max(500),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const entry = await db.timeEntry.findFirst({ where: { id: d.timeEntryId, userId: user.id } });
  if (!entry) return { error: "That shift wasn't found." };
  if (!entry.clockOut) return { error: "Clock out before asking for a change." };
  if (await db.timeChangeRequest.findFirst({ where: { timeEntryId: entry.id, status: "PENDING" } })) {
    return { error: "There's already a change waiting for approval on this shift." };
  }
  const start = parseLocalDateTime(d.clockIn);
  const end = parseLocalDateTime(d.clockOut);
  const invalid = validateShift(start, end) ?? (await checkPicklists(d.serviceId, d.clientId));
  if (invalid) return { error: invalid };
  const req = await db.timeChangeRequest.create({
    data: {
      timeEntryId: entry.id,
      requestedById: user.id,
      proposedClockIn: start!,
      proposedClockOut: end!,
      proposedServiceId: d.serviceId,
      proposedClientId: d.clientId,
      proposedNote: d.note,
      reason: d.reason,
    },
  });
  await audit(user.id, "time.change_requested", "TimeChangeRequest", req.id, { timeEntryId: entry.id });
  revalidatePath("/", "layout");
  return { ok: "Change requested. An admin will review it." };
}
