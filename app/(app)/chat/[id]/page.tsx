import Link from "next/link";
import { notFound } from "next/navigation";
import { addGroupMembers, leaveGroup } from "@/app/actions/comms";
import { ActionForm } from "@/components/ActionForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Avatar } from "@/components/Avatar";
import { MessageComposer } from "@/components/MessageComposer";
import { PeoplePicker } from "@/components/PeoplePicker";
import { ScrollToBottom } from "@/components/ScrollToBottom";
import { requireUser } from "@/lib/auth";
import { conversationTitle } from "@/lib/chat";
import { db } from "@/lib/db";
import { formatDate, formatTime } from "@/lib/time";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const convo = await db.conversation.findFirst({
    where: { id, members: { some: { userId: user.id } } },
    include: { members: { include: { user: { select: { id: true, name: true, title: true } } } } },
  });
  if (!convo) notFound();
  const messages = await db.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { sender: { select: { id: true, name: true } } },
  });
  messages.reverse();
  await db.conversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: user.id } }, data: { lastReadAt: new Date() } });

  const title = conversationTitle(convo, user.id);
  const memberIds = new Set(convo.members.map((m) => m.userId));
  const others = convo.isGroup
    ? await db.user.findMany({ where: { active: true, id: { notIn: [...memberIds] } }, orderBy: { name: "asc" }, select: { id: true, name: true, title: true } })
    : [];
  let lastDay = "";

  return (
    <div className="flex flex-col gap-3">
      <AutoRefresh seconds={4} />
      <ScrollToBottom dep={messages.length} />
      <div className="flex items-center gap-3">
        <Link href="/chat" className="text-sm text-brand-700 hover:underline">Chat</Link>
        <Avatar name={title} size="sm" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{title}</h1>
          {convo.isGroup && <div className="truncate text-xs text-slate-500">{convo.members.map((m) => m.user.name).join(", ")}</div>}
        </div>
      </div>

      {convo.isGroup && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium">Group members</summary>
          {others.length > 0 && (
            <ActionForm action={addGroupMembers} className="mt-3 space-y-2">
              <input type="hidden" name="conversationId" value={convo.id} />
              <PeoplePicker people={others} />
              <button className="btn-secondary">Add to group</button>
            </ActionForm>
          )}
          <form action={leaveGroup} className="mt-3">
            <input type="hidden" name="conversationId" value={convo.id} />
            <button className="text-sm text-rose-600 hover:underline">Leave group</button>
          </form>
        </details>
      )}

      <div className="flex flex-col gap-2 pb-2">
        {messages.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No messages yet.</p>}
        {messages.map((m) => {
          const mine = m.senderId === user.id;
          const day = formatDate(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && <div className="my-2 text-center text-xs text-slate-400">{day}</div>}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-brand-600 text-white" : "border border-slate-200 bg-white"}`}>
                  {!mine && convo.isGroup && <div className="mb-0.5 text-xs font-semibold text-brand-700">{m.sender.name}</div>}
                  <div className="break-words whitespace-pre-wrap">{m.body}</div>
                  <div className={`mt-0.5 text-right text-[10px] ${mine ? "text-brand-100" : "text-slate-400"}`}>{formatTime(m.createdAt)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-16 border-t border-slate-200 bg-slate-50 py-2 md:bottom-0">
        <MessageComposer conversationId={convo.id} />
      </div>
    </div>
  );
}
