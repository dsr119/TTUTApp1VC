import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, startOfWeek, toLocalDateInput } from "@/lib/time";

export default async function ExportPage() {
  await requireAdmin();
  const lastWeekStart = addDays(startOfWeek(), -7);
  const pending = await db.timeEntry.count({ where: { status: "PENDING" } });

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="page-title">Payroll export</h1>
      <p className="text-sm text-slate-600">
        Download approved hours as a spreadsheet to enter into QuickBooks. Only approved shifts are included.
      </p>
      {pending > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {pending} shift{pending === 1 ? " is" : "s are"} still waiting for approval and won't be in the export.
        </p>
      )}
      <form action="/api/export" method="get" className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="from">From</label>
            <input className="input" type="date" id="from" name="from" defaultValue={toLocalDateInput(lastWeekStart)} required />
          </div>
          <div>
            <label className="label" htmlFor="to">To</label>
            <input className="input" type="date" id="to" name="to" defaultValue={toLocalDateInput(addDays(lastWeekStart, 6))} required />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="label">Layout</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="kind" value="summary" defaultChecked /> Summary: total hours per person and service
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="kind" value="detail" /> Detail: one row per shift
          </label>
          <label className="ml-6 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="kids" value="1" /> Include kid names in the detail file
          </label>
        </fieldset>
        <button className="btn-primary w-full">Download CSV</button>
        <p className="text-xs text-slate-500">
          Payroll files leave the app, so kid names are off by default. Store downloads only on approved, encrypted devices.
        </p>
      </form>
    </div>
  );
}
