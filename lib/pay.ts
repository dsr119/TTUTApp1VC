import { hoursBetween } from "./time";

type Num = { toString(): string } | number | null | undefined;

const toNumber = (v: Num) => (v === null || v === undefined ? null : Number(v.toString()));

/**
 * Pay rate for a shift, most specific first:
 * 1. this staff member's rate for this service
 * 2. the service's rate (e.g. eval vs group session)
 * 3. the staff member's base hourly rate
 */
export function resolveRate(opts: { override?: Num; serviceRate?: Num; baseRate?: Num }) {
  return toNumber(opts.override) ?? toNumber(opts.serviceRate) ?? toNumber(opts.baseRate) ?? 0;
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function shiftPay(clockIn: Date, clockOut: Date, rate: number) {
  const hours = Math.round(hoursBetween(clockIn, clockOut) * 100) / 100;
  return { hours, amount: roundMoney(hours * rate) };
}

/** Quote a CSV cell and neutralize spreadsheet formulas. */
export function csvCell(value: string | number | null | undefined) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}
