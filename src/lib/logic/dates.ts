// Date helpers. Calendar dates are ISO "YYYY-MM-DD" strings (no time zone).
// Instants (deadlines) are shown and entered in IST.

const IST = "Asia/Kolkata";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Days from a to b (b - a), both ISO dates. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date in IST. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(now);
}

/** Parse a <input type="datetime-local"> value as IST. */
export function istLocalToDate(local: string): Date | null {
  if (!LOCAL_DATETIME.test(local)) return null;
  const d = new Date(`${local}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format an instant as a datetime-local value in IST. */
export function dateToIstLocal(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatIST(d: Date | string): string {
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: IST,
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(d)) + " IST"
  );
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function hasPassed(instant: string | Date, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(instant).getTime();
}

/** Default response deadline: 3 days from now at 21:00 IST (the 72-hour target). */
export function defaultDeadlineLocal(now: Date = new Date()): string {
  const inThreeDays = new Date(now.getTime() + 3 * 86_400_000);
  return `${dateToIstLocal(inThreeDays).slice(0, 11)}21:00`;
}
