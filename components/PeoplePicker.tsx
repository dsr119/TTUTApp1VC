import { Avatar } from "./Avatar";

export function PeoplePicker({ people }: { people: { id: string; name: string; title: string | null }[] }) {
  return (
    <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
      {people.map((p) => (
        <label key={p.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
          <input type="checkbox" name="members" value={p.id} className="h-4 w-4" />
          <Avatar name={p.name} size="sm" />
          <span>
            <span className="block text-sm font-medium">{p.name}</span>
            {p.title && <span className="block text-xs text-slate-500">{p.title}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
