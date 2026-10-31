// Shift times are stored in UTC and shown/entered in the clinic's time zone.

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Chicago";

function zoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-30T14:30" in the clinic time zone -> Date. Returns null when malformed. */
export function parseLocalDateTime(value: string, timeZone = APP_TIMEZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let result = guess - zoneOffsetMs(new Date(guess), timeZone);
  // Second pass settles the offset across a daylight saving change.
  result = guess - zoneOffsetMs(new Date(result), timeZone);
  return new Date(result);
}

/** "2026-10-30" in the clinic time zone -> start of that day. */
export function parseLocalDate(value: string, timeZone = APP_TIMEZONE): Date | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? parseLocalDateTime(`${value}T00:00`, timeZone) : null;
}

/** Date -> "2026-10-30T14:30" for a datetime-local input. */
export function toLocalInput(date: Date, timeZone = APP_TIMEZONE) {
  const local = new Date(date.getTime() + zoneOffsetMs(date, timeZone));
  return local.toISOString().slice(0, 16);
}

export function toLocalDateInput(date: Date, timeZone = APP_TIMEZONE) {
  return toLocalInput(date, timeZone).slice(0, 10);
}

export function formatDate(date: Date, timeZone = APP_TIMEZONE) {
  return date.toLocaleDateString("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
}

export function formatTime(date: Date, timeZone = APP_TIMEZONE) {
  return date.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(date: Date, timeZone = APP_TIMEZONE) {
  return `${formatDate(date, timeZone)}, ${formatTime(date, timeZone)}`;
}

export function hoursBetween(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / 3600_000);
}

export function formatHours(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 60 ? `${h + 1}h 0m` : `${h}h ${m}m`;
}

/** Monday 00:00 of the week containing `date`, in the clinic time zone. */
export function startOfWeek(date = new Date(), timeZone = APP_TIMEZONE) {
  const day = toLocalDateInput(date, timeZone);
  const [y, mo, d] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  const monday = new Date(Date.UTC(y, mo - 1, d - ((weekday + 6) % 7)));
  return parseLocalDate(monday.toISOString().slice(0, 10), timeZone)!;
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400_000);
}

export const MAX_SHIFT_HOURS = 16;

/** Shared checks for any entered shift. Returns an error message or null. */
export function validateShift(clockIn: Date | null, clockOut: Date | null, now = new Date()) {
  if (!clockIn || !clockOut) return "Enter a start and end time.";
  if (clockOut <= clockIn) return "End time must be after the start time.";
  if (clockOut.getTime() > now.getTime() + 5 * 60_000) return "Shifts can't end in the future.";
  if (hoursBetween(clockIn, clockOut) > MAX_SHIFT_HOURS) return `A shift can't be longer than ${MAX_SHIFT_HOURS} hours.`;
  return null;
}
