import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Avatar } from "@/components/Avatar";
import { requireUser } from "@/lib/auth";
import { listConversations } from "@/lib/chat";
import { formatDate, formatTime } from "@/lib/time";

export default async function ChatListPage() {
  const user = await requireUser();
  const convos = await listConversations(user.id);
  const today = formatDate(new Date());

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={10} />
      <div className="flex items-center justify-between">
        <h1 className="page-title mb-0">Chat</h1>
        <div className="flex gap-2">
          <Link href="/directory" className="btn-secondary">New message</Link>
          <Link href="/chat/new" className="btn-primary">New group</Link>
        </div>
      </div>
      {convos.length === 0 && <p className="card text-sm text-slate-500">No conversations yet. Find someone in the Directory to start one.</p>}
      <ul className="card divide-y divide-slate-100 p-0">
        {convos.map((c) => (
          <li key={c.id}>
            <Link href={`/chat/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <Avatar name={c.title} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate ${c.unread ? "font-semibold" : "font-medium"}`}>{c.title}</span>
                  {c.last && (
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDate(c.last.createdAt) === today ? formatTime(c.last.createdAt) : formatDate(c.last.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-slate-500">
                    {c.last ? `${c.isGroup ? `${c.last.sender.name.split(" ")[0]}: ` : ""}${c.last.body}` : c.isGroup ? `${c.members.length} members` : "Say hello"}
                  </span>
                  {c.unread > 0 && <span className="ml-auto rounded-full bg-brand-600 px-2 text-xs font-semibold text-white">{c.unread}</span>}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
