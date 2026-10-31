import { reviewChangeRequest, reviewTimeEntry, reviewTimeOff } from "@/app/actions/admin";
import { Avatar } from "@/components/Avatar";
import { ReviewButtons } from "@/components/ReviewButtons";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { kidName } from "@/lib/picklists";
import { formatDate, formatDateTime, formatHours, formatTime, hoursBetween } from "@/lib/time";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

export default async function ApprovalsPage() {
  await requireAdmin();
  const [entries, changes, timeOff, services, clients] = await Promise.all([
    db.timeEntry.findMany({
      where: { status: "PENDING" },
      orderBy: { clockIn: "asc" },
      include: { user: { select: { name: true } }, service: true, client: true },
    }),
    db.timeChangeRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { requestedBy: { select: { name: true } }, timeEntry: { include: { service: true, client: true } } },
    }),
    db.timeOffRequest.findMany({ where: { status: "PENDING" }, orderBy: { startDate: "asc" }, include: { user: { select: { name: true } } } }),
    db.service.findMany(),
    db.client.findMany(),
  ]);
  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name ?? "No service";
  const clientName = (id: string | null) => {
    const c = clients.find((k) => k.id === id);
    return c ? kidName(c) : "No kid";
  };

  return (
    <div className="space-y-6">
      <h1 className="page-title">Approvals</h1>

      <section className="space-y-3">
        <h2 className="font-semibold">Hours entered manually ({entries.length})</h2>
        {entries.length === 0 && <Empty>Nothing waiting.</Empty>}
        {entries.map((e) => (
          <div key={e.id} className="card space-y-2">
            <div className="flex items-center gap-3">
              <Avatar name={e.user.name} size="sm" />
              <div className="flex-1">
                <div className="font-medium">{e.user.name}</div>
                <div className="text-sm text-slate-500">
                  {formatDate(e.clockIn)}, {formatTime(e.clockIn)} to {e.clockOut ? formatTime(e.clockOut) : "?"} ·{" "}
                  {e.clockOut && formatHours(hoursBetween(e.clockIn, e.clockOut))}
                </div>
              </div>
              <span className="badge bg-slate-100 text-slate-600">{e.source === "MANUAL" ? "Manual" : "Long shift"}</span>
            </div>
            <div className="text-sm">
              {[e.service?.name, e.client && kidName(e.client)].filter(Boolean).join(" · ")}
              {e.note && <span className="text-slate-500"> · “{e.note}”</span>}
            </div>
            <ReviewButtons id={e.id} action={reviewTimeEntry} />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Requested time changes ({changes.length})</h2>
        {changes.length === 0 && <Empty>Nothing waiting.</Empty>}
        {changes.map((c) => (
          <div key={c.id} className="card space-y-2">
            <div className="flex items-center gap-3">
              <Avatar name={c.requestedBy.name} size="sm" />
              <div className="font-medium">{c.requestedBy.name}</div>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-xs font-semibold text-slate-400 uppercase">Now</div>
                {formatDateTime(c.timeEntry.clockIn)} to {c.timeEntry.clockOut ? formatTime(c.timeEntry.clockOut) : "?"}
                <div className="text-slate-500">{serviceName(c.timeEntry.serviceId)} · {clientName(c.timeEntry.clientId)}</div>
              </div>
              <div className="rounded-lg bg-brand-50 p-2">
                <div className="text-xs font-semibold text-brand-700 uppercase">Requested</div>
                {formatDateTime(c.proposedClockIn)} to {formatTime(c.proposedClockOut)}
                <div className="text-slate-500">{serviceName(c.proposedServiceId)} · {clientName(c.proposedClientId)}</div>
              </div>
            </div>
            <div className="text-sm text-slate-600">Reason: {c.reason}</div>
            <ReviewButtons id={c.id} action={reviewChangeRequest} />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Time off requests ({timeOff.length})</h2>
        {timeOff.length === 0 && <Empty>Nothing waiting.</Empty>}
        {timeOff.map((t) => (
          <div key={t.id} className="card space-y-2">
            <div className="flex items-center gap-3">
              <Avatar name={t.user.name} size="sm" />
              <div>
                <div className="font-medium">{t.user.name}</div>
                <div className="text-sm text-slate-500">
                  {formatDate(t.startDate, "UTC")} to {formatDate(t.endDate, "UTC")}
                </div>
              </div>
            </div>
            {t.reason && <div className="text-sm text-slate-600">{t.reason}</div>}
            <ReviewButtons id={t.id} action={reviewTimeOff} />
          </div>
        ))}
      </section>
    </div>
  );
}
