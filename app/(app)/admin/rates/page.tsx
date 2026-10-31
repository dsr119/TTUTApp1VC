import { saveService, setServiceOverride, setStaffRate } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";

const fmt = (v: { toString(): string } | null) => (v === null ? "" : Number(v.toString()).toFixed(2));

export default async function RatesPage() {
  await requireOwner();
  const [people, services, overrides] = await Promise.all([
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.service.findMany({ orderBy: { name: "asc" } }),
    db.staffServiceRate.findMany({ include: { user: { select: { name: true } }, service: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title mb-1">Rates & services</h1>
        <p className="text-sm text-slate-600">
          Pay for a shift uses the most specific rate: a staff member's rate for that service, then the service's rate, then the staff member's base rate.
        </p>
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">Services</h2>
        <div className="space-y-2">
          {services.map((s) => (
            <ActionForm key={s.id} action={saveService} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={s.id} />
              <input className="input min-w-40 flex-1" name="name" defaultValue={s.name} aria-label="Service name" required />
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-500">$</span>
                <input className="input w-28" name="defaultRate" type="number" step="0.01" min="0" defaultValue={fmt(s.defaultRate)} placeholder="Base rate" aria-label="Service hourly rate" />
                <span className="text-sm text-slate-500">/hr</span>
              </div>
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={s.active} /> Active</label>
              <button className="btn-secondary py-1.5">Save</button>
            </ActionForm>
          ))}
          <ActionForm action={saveService} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3" resetOnSuccess>
            <input className="input min-w-40 flex-1" name="name" placeholder="New service, e.g. Parent training" aria-label="New service name" required />
            <input className="input w-28" name="defaultRate" type="number" step="0.01" min="0" placeholder="$/hr" aria-label="New service rate" />
            <button className="btn-primary py-1.5">Add service</button>
          </ActionForm>
        </div>
        <p className="mt-2 text-xs text-slate-500">Leave a service rate blank to pay each person's base rate for it.</p>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Staff base rates</h2>
        <div className="divide-y divide-slate-100">
          {people.map((p) => (
            <ActionForm key={p.id} action={setStaffRate} className="flex flex-wrap items-center gap-2 py-2">
              <input type="hidden" name="userId" value={p.id} />
              <span className="min-w-40 flex-1 text-sm font-medium">{p.name}</span>
              <span className="text-sm text-slate-500">$</span>
              <input className="input w-28" name="rate" type="number" step="0.01" min="0" defaultValue={fmt(p.hourlyRate)} aria-label={`Base rate for ${p.name}`} />
              <span className="text-sm text-slate-500">/hr</span>
              <button className="btn-secondary py-1.5">Save</button>
            </ActionForm>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">Staff rates for a specific service</h2>
        <p className="mb-3 text-sm text-slate-500">For example, a therapist who earns more for evaluations. Leave the rate blank to remove an override.</p>
        <ActionForm action={setServiceOverride} className="mb-4 flex flex-wrap items-center gap-2">
          <select className="input w-auto" name="userId" required aria-label="Staff member" defaultValue="">
            <option value="">Staff member</option>
            {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <select className="input w-auto" name="serviceId" required aria-label="Service" defaultValue="">
            <option value="">Service</option>
            {services.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
          <input className="input w-28" name="rate" type="number" step="0.01" min="0" placeholder="$/hr" aria-label="Rate" />
          <button className="btn-primary py-1.5">Save</button>
        </ActionForm>
        {overrides.length === 0 ? (
          <p className="text-sm text-slate-500">No overrides yet.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Staff</th><th>Service</th><th className="text-right">Rate</th></tr></thead>
            <tbody>
              {overrides.map((o) => (
                <tr key={o.id}><td>{o.user.name}</td><td>{o.service.name}</td><td className="text-right">${fmt(o.rate)}/hr</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
