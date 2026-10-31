import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { hoursReport } from "@/lib/hours";
import { csvCell, roundMoney } from "@/lib/pay";
import { addDays, parseLocalDate, toLocalDateInput, toLocalInput } from "@/lib/time";

// Payroll CSV of approved hours, for entering into QuickBooks.
// kind=summary: one row per staff member. kind=detail: one row per shift.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) return new NextResponse("Not allowed", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const from = parseLocalDate(sp.get("from") ?? "");
  const to = parseLocalDate(sp.get("to") ?? "");
  if (!from || !to || to < from) return new NextResponse("Pick a valid date range", { status: 400 });
  const kind = sp.get("kind") === "detail" ? "detail" : "summary";
  const includeKids = sp.get("kids") === "1";

  const rows = await hoursReport({ status: "APPROVED", clockOut: { not: null }, clockIn: { gte: from, lt: addDays(to, 1) } });
  const lines: (string | number | null)[][] = [];

  if (kind === "summary") {
    lines.push(["Employee", "Email", "Service", "Hours", "Rate", "Amount"]);
    const groups = new Map<string, { name: string; email: string; service: string; hours: number; rate: number; amount: number }>();
    for (const r of rows) {
      const service = r.service?.name ?? "Unspecified";
      const key = `${r.userId}|${service}|${r.rate}`;
      const g = groups.get(key) ?? { name: r.user.name, email: r.user.email, service, hours: 0, rate: r.rate, amount: 0 };
      g.hours += r.hours;
      g.amount += r.amount;
      groups.set(key, g);
    }
    for (const g of groups.values()) {
      lines.push([g.name, g.email, g.service, roundMoney(g.hours), g.rate.toFixed(2), roundMoney(g.amount).toFixed(2)]);
    }
  } else {
    lines.push(["Employee", "Email", "Date", "Start", "End", "Service", ...(includeKids ? ["Kid"] : []), "Hours", "Rate", "Amount", "Source"]);
    for (const r of rows) {
      lines.push([
        r.user.name,
        r.user.email,
        toLocalDateInput(r.clockIn),
        toLocalInput(r.clockIn).slice(11),
        toLocalInput(r.clockOut!).slice(11),
        r.service?.name ?? "Unspecified",
        ...(includeKids ? [r.client ? `${r.client.firstName} ${r.client.lastInitial}.` : ""] : []),
        r.hours,
        r.rate.toFixed(2),
        r.amount.toFixed(2),
        r.source === "MANUAL" ? "Manual" : "Clock",
      ]);
    }
  }

  await audit(user.id, "export.payroll", "TimeEntry", null, { from: sp.get("from"), to: sp.get("to"), kind, includeKids, rows: rows.length });
  const csv = lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll-${kind}-${sp.get("from")}-to-${sp.get("to")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
