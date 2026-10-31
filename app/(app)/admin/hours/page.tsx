import Link from "next/link";
import type { ApprovalStatus, Prisma } from "@prisma/client";
import { StatusBadge } from "@/components/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { hoursReport } from "@/lib/hours";
import { kidName } from "@/lib/picklists";
import { addDays, formatDate, formatTime, parseLocalDate, startOfWeek, toLocalDateInput } from "@/lib/time";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function AllHoursPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const from = parseLocalDate(sp.from ?? "") ?? startOfWeek();
  const toDay = parseLocalDate(sp.to ?? "") ?? addDays(startOfWeek(), 6);
  const status = (["PENDING", "APPROVED", "DENIED"] as const).find((s) => s === sp.status);
  const where: Prisma.TimeEntryWhereInput = {
    clockIn: { gte: from, lt: addDays(toDay, 1) },
    ...(sp.user ? { userId: sp.user } : {}),
    ...(status ? { status: status as ApprovalStatus } : {}),
  };
  const [rows, people] = await Promise.all([
    hoursReport(where),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const approved = rows.filter((r) => r.status === "APPROVED");
  const totalHours = approved.reduce((s, r) => s + r.hours, 0);
  const totalPay = approved.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <h1 className="page-title">All hours</h1>
      <form className="card grid gap-3 sm:grid-cols-5 sm:items-end">
        <div>
          <label className="label" htmlFor="from">From</label>
          <input className="input" type="date" id="from" name="from" defaultValue={toLocalDateInput(from)} />
        </div>
        <div>
          <label className="label" htmlFor="to">To</label>
          <input className="input" type="date" id="to" name="to" defaultValue={toLocalDateInput(toDay)} />
        </div>
        <div>
          <label className="label" htmlFor="user">Staff</label>
          <select className="input" id="user" name="user" defaultValue={sp.user ?? ""}>
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Any</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
          </select>
        </div>
        <button className="btn-secondary">Filter</button>
      </form>

      <div className="grid grid-cols-2 gap-4">
        <div className="card"><div className="text-sm text-slate-500">Approved hours</div><div className="text-2xl font-semibold">{totalHours.toFixed(2)}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Approved pay</div><div className="text-2xl font-semibold">{money(totalPay)}</div></div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="data-table">
          <thead>
            <tr><th>Staff</th><th>Date</th><th>Time</th><th>Service · Kid</th><th className="text-right">Hours</th><th className="text-right">Rate</th><th className="text-right">Pay</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="text-center text-slate-500">No shifts in this range.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium whitespace-nowrap">{r.user.name}</td>
                <td className="whitespace-nowrap">{formatDate(r.clockIn)}</td>
                <td className="whitespace-nowrap">{formatTime(r.clockIn)} to {r.clockOut ? formatTime(r.clockOut) : "now"}</td>
                <td>{[r.service?.name, r.client && kidName(r.client)].filter(Boolean).join(" · ") || "—"}{r.source === "MANUAL" && <span className="text-slate-400"> (manual)</span>}</td>
                <td className="text-right tabular-nums">{r.clockOut ? r.hours.toFixed(2) : "—"}</td>
                <td className="text-right tabular-nums">{money(r.rate)}</td>
                <td className="text-right tabular-nums">{money(r.amount)}</td>
                <td><StatusBadge status={r.status} /></td>
                <td><Link className="text-brand-700 hover:underline" href={`/admin/hours/${r.id}`}>Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
