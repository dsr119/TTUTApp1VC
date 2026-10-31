import { notFound } from "next/navigation";
import Link from "next/link";
import { requestChange } from "@/app/actions/time";
import { ActionForm } from "@/components/ActionForm";
import { ServiceKidSelects } from "@/components/Picklists";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPicklists } from "@/lib/picklists";
import { formatDateTime, toLocalInput } from "@/lib/time";

export default async function ChangeRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [entry, picklists] = await Promise.all([db.timeEntry.findFirst({ where: { id, userId: user.id } }), getPicklists()]);
  if (!entry || !entry.clockOut) notFound();

  return (
    <div className="max-w-xl space-y-4">
      <Link href="/time" className="text-sm text-brand-700 hover:underline">Back to my time</Link>
      <h1 className="page-title">Request a change</h1>
      <p className="text-sm text-slate-600">
        Currently recorded as {formatDateTime(entry.clockIn)} to {formatDateTime(entry.clockOut)}. Your shift stays as it is until an admin approves the change.
      </p>
      <ActionForm action={requestChange} className="card space-y-3">
        <input type="hidden" name="timeEntryId" value={entry.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="c-in">Start</label>
            <input className="input" id="c-in" name="clockIn" type="datetime-local" defaultValue={toLocalInput(entry.clockIn)} required />
          </div>
          <div>
            <label className="label" htmlFor="c-out">End</label>
            <input className="input" id="c-out" name="clockOut" type="datetime-local" defaultValue={toLocalInput(entry.clockOut)} required />
          </div>
        </div>
        <ServiceKidSelects picklists={picklists} serviceId={entry.serviceId} clientId={entry.clientId} />
        <div>
          <label className="label" htmlFor="c-note">Shift note</label>
          <textarea className="input" id="c-note" name="note" rows={2} maxLength={1000} defaultValue={entry.note ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="c-reason">Why does it need to change?</label>
          <textarea className="input" id="c-reason" name="reason" rows={2} maxLength={500} required />
        </div>
        <button className="btn-primary w-full">Send request</button>
      </ActionForm>
    </div>
  );
}
