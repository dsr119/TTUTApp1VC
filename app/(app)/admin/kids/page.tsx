import { addKid, toggleKid } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { kidName } from "@/lib/picklists";

export default async function KidsPage() {
  await requireAdmin();
  const kids = await db.client.findMany({ orderBy: [{ active: "desc" }, { firstName: "asc" }] });
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="page-title mb-1">Kids</h1>
      <p className="text-sm text-slate-600">
        These are the names staff pick from when logging time. To keep records minimal, only a first name and last initial are stored.
      </p>
      <ActionForm action={addKid} className="card flex flex-wrap items-end gap-2" resetOnSuccess>
        <div className="flex-1">
          <label className="label" htmlFor="firstName">First name</label>
          <input className="input" id="firstName" name="firstName" required maxLength={50} />
        </div>
        <div className="w-24">
          <label className="label" htmlFor="lastInitial">Last initial</label>
          <input className="input" id="lastInitial" name="lastInitial" required maxLength={1} />
        </div>
        <button className="btn-primary">Add</button>
      </ActionForm>
      <ul className="card divide-y divide-slate-100 p-0">
        {kids.map((k) => (
          <li key={k.id} className="flex items-center justify-between px-4 py-2">
            <span className={k.active ? "" : "text-slate-400 line-through"}>{kidName(k)}</span>
            <form action={toggleKid}>
              <input type="hidden" name="id" value={k.id} />
              <button className="text-sm text-brand-700 hover:underline">{k.active ? "Remove from list" : "Restore"}</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
