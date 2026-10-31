import { cancelTimeOff, requestTimeOff } from "@/app/actions/comms";
import { ActionForm } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, toLocalDateInput } from "@/lib/time";

export default async function TimeOffPage() {
  const user = await requireUser();
  const requests = await db.timeOffRequest.findMany({ where: { userId: user.id }, orderBy: { startDate: "desc" }, take: 50 });
  const today = toLocalDateInput(new Date());

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="page-title">Time off</h1>
      <ActionForm action={requestTimeOff} className="card space-y-3" resetOnSuccess>
        <h2 className="font-semibold">Request time off</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="startDate">First day off</label>
            <input className="input" type="date" id="startDate" name="startDate" min={today} required />
          </div>
          <div>
            <label className="label" htmlFor="endDate">Last day off</label>
            <input className="input" type="date" id="endDate" name="endDate" min={today} required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="reason">Note for your admin (optional)</label>
          <textarea className="input" id="reason" name="reason" rows={2} maxLength={500} />
        </div>
        <button className="btn-primary w-full">Send request</button>
      </ActionForm>

      <section className="card">
        <h2 className="mb-2 font-semibold">My requests</h2>
        {requests.length === 0 && <p className="text-sm text-slate-500">No requests yet.</p>}
        <ul className="divide-y divide-slate-100">
          {requests.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 py-2">
              <div>
                <div className="font-medium">
                  {formatDate(r.startDate, "UTC")}
                  {r.endDate.getTime() !== r.startDate.getTime() && ` to ${formatDate(r.endDate, "UTC")}`}
                </div>
                {r.reason && <div className="text-sm text-slate-500">{r.reason}</div>}
                {r.reviewNote && <div className="text-sm text-slate-600">Admin: {r.reviewNote}</div>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={r.status} />
                {r.status === "PENDING" && (
                  <form action={cancelTimeOff}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-xs text-slate-500 hover:text-rose-600">Cancel</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
