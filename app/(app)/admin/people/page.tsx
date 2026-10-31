import { createPerson, updatePerson } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function PeoplePage() {
  await requireOwner();
  const people = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  const active = people.filter((p) => p.active);

  return (
    <div className="space-y-6">
      <h1 className="page-title">People</h1>
      <section className="card">
        <h2 className="mb-3 font-semibold">Add someone</h2>
        <ActionForm action={createPerson} className="grid gap-3 sm:grid-cols-3" resetOnSuccess>
          <input className="input" name="name" placeholder="Full name" required aria-label="Full name" />
          <input className="input" name="email" type="email" placeholder="Work email" required aria-label="Work email" />
          <input className="input" name="title" placeholder="Job title" aria-label="Job title" />
          <input className="input" name="phone" placeholder="Work phone" aria-label="Work phone" />
          <select className="input" name="role" defaultValue="STAFF" aria-label="Role">
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
            <option value="OWNER">Owner</option>
          </select>
          <input className="input" name="password" type="text" minLength={10} placeholder="Temporary password" required aria-label="Temporary password" autoComplete="off" />
          <button className="btn-primary sm:col-span-3">Add person</button>
        </ActionForm>
        <p className="mt-2 text-xs text-slate-500">Once the app moves to AWS, invitations will come from Amazon Cognito instead of temporary passwords.</p>
      </section>

      <section className="space-y-2">
        {people.map((p) => (
          <ActionForm key={p.id} action={updatePerson} className="card flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={p.id} />
            <Avatar name={p.name} size="sm" />
            <div className="min-w-40 flex-1">
              <div className={`font-medium ${p.active ? "" : "text-slate-400"}`}>{p.name}</div>
              <div className="text-xs text-slate-500">{p.email}</div>
            </div>
            <input className="input w-44" name="title" defaultValue={p.title ?? ""} placeholder="Title" aria-label="Title" />
            <input className="input w-32" name="phone" defaultValue={p.phone ?? ""} placeholder="Phone" aria-label="Phone" />
            <select className="input w-auto" name="role" defaultValue={p.role} aria-label="Role">
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
              <option value="OWNER">Owner</option>
            </select>
            <select className="input w-44" name="managerId" defaultValue={p.managerId ?? ""} aria-label="Reports to">
              <option value="">Reports to nobody</option>
              {active.filter((m) => m.id !== p.id).map((m) => (<option key={m.id} value={m.id}>Reports to {m.name}</option>))}
            </select>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> Active</label>
            <button className="btn-secondary py-1.5">Save</button>
          </ActionForm>
        ))}
      </section>
    </div>
  );
}
