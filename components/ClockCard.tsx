import { clockIn, clockOut } from "@/app/actions/time";
import { db } from "@/lib/db";
import { getPicklists, kidName } from "@/lib/picklists";
import { formatTime } from "@/lib/time";
import { ActionForm } from "./ActionForm";
import { ClockTicker } from "./ClockTicker";
import { ServiceKidSelects } from "./Picklists";

export async function ClockCard({ userId }: { userId: string }) {
  const [open, picklists] = await Promise.all([
    db.timeEntry.findFirst({ where: { userId, clockOut: null }, include: { service: true, client: true } }),
    getPicklists(),
  ]);

  if (open) {
    return (
      <section className="card border-brand-100 bg-brand-50">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-brand-700">Clocked in</h2>
          <span className="text-sm text-slate-500">since {formatTime(open.clockIn)}</span>
        </div>
        <div className="my-3 text-4xl font-semibold text-slate-900">
          <ClockTicker since={open.clockIn.toISOString()} />
        </div>
        <p className="mb-3 text-sm text-slate-600">
          {[open.service?.name, open.client && kidName(open.client)].filter(Boolean).join(" with ") || "No service or kid picked yet"}
        </p>
        <ActionForm action={clockOut} className="space-y-3">
          <ServiceKidSelects picklists={picklists} serviceId={open.serviceId} clientId={open.clientId} />
          <div>
            <label className="label" htmlFor="note">Shift note (optional)</label>
            <textarea className="input" id="note" name="note" rows={2} maxLength={1000} defaultValue={open.note ?? ""} />
          </div>
          <button className="btn-danger w-full py-3 text-base">Clock out</button>
        </ActionForm>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="mb-3 font-semibold text-slate-900">Time clock</h2>
      <ActionForm action={clockIn} className="space-y-3">
        <ServiceKidSelects picklists={picklists} />
        <button className="btn-primary w-full py-3 text-base">Clock in</button>
      </ActionForm>
    </section>
  );
}
