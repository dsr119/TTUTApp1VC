import { db } from "./db";

export async function unreadCount(userId: string) {
  const memberships = await db.conversationMember.findMany({ where: { userId }, select: { conversationId: true, lastReadAt: true } });
  if (memberships.length === 0) return 0;
  return db.message.count({
    where: {
      senderId: { not: userId },
      OR: memberships.map((m) => ({ conversationId: m.conversationId, createdAt: { gt: m.lastReadAt } })),
    },
  });
}

export async function pendingApprovalCount() {
  const [entries, changes, timeOff] = await Promise.all([
    db.timeEntry.count({ where: { status: "PENDING" } }),
    db.timeChangeRequest.count({ where: { status: "PENDING" } }),
    db.timeOffRequest.count({ where: { status: "PENDING" } }),
  ]);
  return entries + changes + timeOff;
}
