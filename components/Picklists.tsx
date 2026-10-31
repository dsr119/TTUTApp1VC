import type { Picklists } from "@/lib/picklists";

export function ServiceKidSelects({
  picklists,
  required = false,
  serviceId,
  clientId,
}: {
  picklists: Picklists;
  required?: boolean;
  serviceId?: string | null;
  clientId?: string | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="serviceId">Service</label>
        <select className="input" id="serviceId" name="serviceId" required={required} defaultValue={serviceId ?? ""}>
          <option value="">{required ? "Choose a service" : "No service selected"}</option>
          {picklists.services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="clientId">Kid</label>
        <select className="input" id="clientId" name="clientId" required={required} defaultValue={clientId ?? ""}>
          <option value="">{required ? "Choose a kid" : "No kid selected"}</option>
          {picklists.clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
