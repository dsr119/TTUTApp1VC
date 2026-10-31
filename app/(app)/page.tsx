import Link from "next/link";
import { ClockCard } from "@/components/ClockCard";
import { isAdmin, requireUser } from "@/lib/auth";
import { pendingApprovalCount } from "@/lib/counts";
import { db } from "@/lib/db";
import { formatDate, formatHours, hoursBetween, startOfWeek } from "@/lib/time";

export default async function HomePage() {
  const user = await requireUser();
  const weekStart = startOfWeek();
  const [entries, updates, pending] = await Promise.all([
    db.timeEntry.findMany({ where: { userId: user.id, clockIn: { gte: weekStart }, status: { not: "DENIED" } } }),
    db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 3, include: { author: { select: { name: true } } } }),
    isAdmin(user.role) ? pendingApprovalCount() : 0,
  ]);
  const weekHours = entries.reduce((sum, e) => sum + hoursBetween(e.clockIn, e.clockOut ?? new Date()), 0);

  return (
    <div className="space-y-4">
      <h1 className="page-title">Hi, {user.name.split(" ")[0]}</h1>
      {pending > 0 && (
        <Link href="/admin/approvals" className="card flex items-center justify-between border-amber-200 bg-amber-50">
          <span className="font-medium text-amber-900">{pending} item{pending === 1 ? "" : "s"} waiting for approval</span>
          <span className="text-sm text-amber-800">Review</span>
        </Link>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <ClockCard userId={user.id} />
        <div className="space-y-4">
          <section className="card">
            <div className="text-sm text-slate-500">This week</div>
            <div className="text-2xl font-semibold">{formatHours(weekHours)}</div>
            <Link href="/time" className="text-sm text-brand-700 hover:underline">See my time</Link>
          </section>
          <section className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Latest updates</h2>
              <Link href="/updates" className="text-sm text-brand-700 hover:underline">All</Link>
            </div>
            {updates.length === 0 && <p className="text-sm text-slate-500">No updates yet.</p>}
            <ul className="space-y-3">
              {updates.map((u) => (
                <li key={u.id}>
                  <div className="font-medium">{u.title}</div>
                  <div className="text-xs text-slate-500">{u.author.name} · {formatDate(u.createdAt)}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
