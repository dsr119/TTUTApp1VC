import Link from "next/link";
import { notFound } from "next/navigation";
import { adminUpdateEntry } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { ServiceKidSelects } from "@/components/Picklists";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPicklists } from "@/lib/picklists";
import { formatDateTime, toLocalInput } from "@/lib/time";

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [entry, picklists] = await Promise.all([
    db.timeEntry.findUnique({ where: { id }, include: { user: { select: { name: true } } } }),
    getPicklists(),
  ]);
  if (!entry) notFound();
  const history = await db.auditLog.findMany({
    where: { entityType: "TimeEntry", entityId: id },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });

  return (
    <div className="max-w-xl space-y-4">
      <Link href="/admin/hours" className="text-sm text-brand-700 hover:underline">Back to all hours</Link>
      <h1 className="page-title">Edit shift for {entry.user.name}</h1>
      <ActionForm action={adminUpdateEntry} className="card space-y-3">
        <input type="hidden" name="id" value={entry.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="e-in">Start</label>
            <input className="input" id="e-in" name="clockIn" type="datetime-local" defaultValue={toLocalInput(entry.clockIn)} required />
          </div>
          <div>
            <label className="label" htmlFor="e-out">End</label>
            <input className="input" id="e-out" name="clockOut" type="datetime-local" defaultValue={entry.clockOut ? toLocalInput(entry.clockOut) : ""} required />
          </div>
        </div>
        <ServiceKidSelects picklists={picklists} serviceId={entry.serviceId} clientId={entry.clientId} />
        <div>
          <label className="label" htmlFor="e-note">Note</label>
          <textarea className="input" id="e-note" name="note" rows={2} maxLength={1000} defaultValue={entry.note ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="e-status">Status</label>
          <select className="input" id="e-status" name="status" defaultValue={entry.status}>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
          </select>
        </div>
        <button className="btn-primary w-full">Save changes</button>
      </ActionForm>
      <section className="card">
        <h2 className="mb-2 font-semibold">History</h2>
        <ul className="space-y-1 text-sm text-slate-600">
          {history.map((h) => (
            <li key={h.id}>{formatDateTime(h.createdAt)} · {h.actor?.name ?? "System"} · {h.action.replace("time.", "").replace(/_/g, " ")}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
