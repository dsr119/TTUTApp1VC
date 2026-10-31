import { db } from "./db";

/** Conversations for a user, newest activity first, with a display name and unread count. */
export async function listConversations(userId: string) {
  const convos = await db.conversation.findMany({
    where: { members: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, include: { sender: { select: { name: true } } } },
    },
  });
  return Promise.all(
    convos.map(async (c) => {
      const me = c.members.find((m) => m.userId === userId)!;
      const unread = await db.message.count({ where: { conversationId: c.id, senderId: { not: userId }, createdAt: { gt: me.lastReadAt } } });
      return { ...c, title: conversationTitle(c, userId), unread, last: c.messages[0] ?? null };
    }),
  );
}

export function conversationTitle(c: { name: string | null; isGroup: boolean; members: { userId: string; user: { name: string } }[] }, userId: string) {
  if (c.isGroup) return c.name ?? "Group";
  return c.members.find((m) => m.userId !== userId)?.user.name ?? "Just you";
}
