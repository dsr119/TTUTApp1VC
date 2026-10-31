import type { Prisma } from "@prisma/client";
import { db } from "./db";

// Record who did what. Keep details to ids, times and statuses: no notes, messages or names.
export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Prisma.InputJsonValue,
) {
  await db.auditLog.create({ data: { actorId, action, entityType, entityId, details } });
}
