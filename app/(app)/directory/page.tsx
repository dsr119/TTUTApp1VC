import Link from "next/link";
import { openDirectMessage } from "@/app/actions/comms";
import { Avatar } from "@/components/Avatar";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);
const ChatIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <path d="M4 5h16v11H8l-4 4z" />
  </svg>
);

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const user = await requireUser();
  const { q = "", tab } = await searchParams;
  const term = q.trim();
  const showGroups = tab === "groups";
  const contains = { contains: term, mode: "insensitive" as const };

  const [people, groups] = await Promise.all([
    showGroups
      ? []
      : db.user.findMany({
          where: { active: true, ...(term ? { OR: [{ name: contains }, { title: contains }] } : {}) },
          orderBy: { name: "asc" },
          select: { id: true, name: true, title: true, phone: true },
        }),
    showGroups
      ? db.conversation.findMany({
          where: { isGroup: true, members: { some: { userId: user.id } }, ...(term ? { name: contains } : {}) },
          orderBy: { name: "asc" },
          include: { _count: { select: { members: true } } },
        })
      : [],
  ]);

  const tabClass = (active: boolean) =>
    `flex-1 rounded-md py-1.5 text-center text-sm font-medium ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="page-title text-center md:text-left">Directory</h1>
      <form className="relative">
        {showGroups && <input type="hidden" name="tab" value="groups" />}
        <input className="input rounded-full pr-10" name="q" defaultValue={term} placeholder="Search directory" aria-label="Search directory" />
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </form>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <Link href={`/directory${term ? `?q=${encodeURIComponent(term)}` : ""}`} className={tabClass(!showGroups)}>People</Link>
        <Link href={`/directory?tab=groups${term ? `&q=${encodeURIComponent(term)}` : ""}`} className={tabClass(showGroups)}>Groups</Link>
      </div>

      {!showGroups && (
        <section>
          <div className="px-1 pb-2 text-sm text-slate-500">Users</div>
          <ul className="card divide-y divide-slate-100 p-0">
            {people.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No one matches “{term}”.</li>}
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}{p.id === user.id && <span className="text-slate-400"> (you)</span>}</div>
                  {p.title && <div className="truncate text-sm text-slate-500">{p.title}</div>}
                </div>
                {p.phone ? (
                  <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${p.name}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-500 text-brand-600 hover:bg-brand-50">
                    <PhoneIcon />
                  </a>
                ) : (
                  <span className="h-9 w-9" />
                )}
                {p.id !== user.id ? (
                  <form action={openDirectMessage}>
                    <input type="hidden" name="userId" value={p.id} />
                    <button aria-label={`Message ${p.name}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700">
                      <ChatIcon />
                    </button>
                  </form>
                ) : (
                  <span className="h-9 w-9" />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showGroups && (
        <section>
          <div className="flex items-center justify-between px-1 pb-2 text-sm text-slate-500">
            <span>Your groups</span>
            <Link href="/chat/new" className="text-brand-700 hover:underline">New group</Link>
          </div>
          <ul className="card divide-y divide-slate-100 p-0">
            {groups.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No groups found.</li>}
            {groups.map((g) => (
              <li key={g.id}>
                <Link href={`/chat/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <Avatar name={g.name ?? "Group"} />
                  <div className="flex-1">
                    <div className="font-medium">{g.name}</div>
                    <div className="text-sm text-slate-500">{g._count.members} members</div>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white"><ChatIcon /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
