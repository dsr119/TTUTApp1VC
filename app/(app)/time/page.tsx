import Link from "next/link";
import { addManualEntry } from "@/app/actions/time";
import { ActionForm } from "@/components/ActionForm";
import { ClockCard } from "@/components/ClockCard";
import { ServiceKidSelects } from "@/components/Picklists";
import { StatusBadge } from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPicklists, kidName } from "@/lib/picklists";
import { addDays, formatDate, formatHours, formatTime, hoursBetween, startOfWeek, toLocalInput } from "@/lib/time";

export default async function TimePage() {
  const user = await requireUser();
  const since = addDays(startOfWeek(), -14);
  const [entries, picklists] = await Promise.all([
    db.timeEntry.findMany({
      where: { userId: user.id, clockIn: { gte: since } },
      orderBy: { clockIn: "desc" },
      include: { service: true, client: true, changeRequests: { where: { status: "PENDING" }, select: { id: true } } },
    }),
    getPicklists(),
  ]);
  const now = toLocalInput(new Date());

  return (
    <div className="space-y-4">
      <h1 className="page-title">My time</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <ClockCard userId={user.id} />
        <section className="card">
          <h2 className="mb-1 font-semibold">Add time manually</h2>
          <p className="mb-3 text-sm text-slate-500">Forgot to clock in? Enter the shift here and an admin will approve it.</p>
          <ActionForm action={addManualEntry} className="space-y-3" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="m-in">Start</label>
                <input className="input" id="m-in" name="clockIn" type="datetime-local" max={now} required />
              </div>
              <div>
                <label className="label" htmlFor="m-out">End</label>
                <input className="input" id="m-out" name="clockOut" type="datetime-local" max={now} required />
              </div>
            </div>
            <ServiceKidSelects picklists={picklists} required />
            <div>
              <label className="label" htmlFor="m-note">Shift note (optional)</label>
              <textarea className="input" id="m-note" name="note" rows={2} maxLength={1000} />
            </div>
            <button className="btn-primary w-full">Submit for approval</button>
          </ActionForm>
        </section>
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">Recent shifts</h2>
        {entries.length === 0 && <p className="text-sm text-slate-500">No shifts in the last few weeks.</p>}
        <ul className="divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div>
                <div className="font-medium">
                  {formatDate(e.clockIn)} · {formatTime(e.clockIn)} to {e.clockOut ? formatTime(e.clockOut) : "now"}
                </div>
                <div className="text-sm text-slate-500">
                  {[e.service?.name, e.client && kidName(e.client)].filter(Boolean).join(" · ") || "No service"}
                  {e.source === "MANUAL" && " · entered manually"}
                </div>
                {e.note && <div className="mt-1 text-sm text-slate-600">{e.note}</div>}
              </div>
              <div className="flex flex-col items-end gap-1 text-sm">
                <span className="font-medium">{formatHours(hoursBetween(e.clockIn, e.clockOut ?? new Date()))}</span>
                <StatusBadge status={e.status} />
                {e.changeRequests.length > 0 ? (
                  <span className="text-xs text-amber-700">Change pending</span>
                ) : (
                  e.clockOut && (
                    <Link href={`/time/${e.id}/change`} className="text-xs text-brand-700 hover:underline">Request a change</Link>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
