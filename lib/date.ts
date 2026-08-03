/**
 * Calendar-date helpers that agree with the property's wall clock.
 *
 * `new Date().toISOString().slice(0, 10)` is UTC. Properties run on +07, so
 * between 00:00 and 07:00 local time that expression returns YESTERDAY — the
 * public booking form used to open with a check-in date already in the past,
 * and the PMS and the accounting modules disagreed about what "today" was.
 * `lib/accounting/*` already computed its dates in Asia/Bangkok; this module is
 * the shared version of that, so there is one definition of "today" app-wide.
 */

/** Properties default to this in `lib/db/properties.ts` and Channex provisioning. */
export const DEFAULT_TIMEZONE = "Asia/Bangkok";

/** `YYYY-MM-DD` for the given instant in `tz`. `sv-SE` formats as ISO. */
export function toLocalISODate(date: Date, tz: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Today's calendar date in `tz`, as `YYYY-MM-DD`. */
export function todayISO(tz: string = DEFAULT_TIMEZONE): string {
  return toLocalISODate(new Date(), tz);
}

/**
 * Shift a `YYYY-MM-DD` string by whole days. Operates on the date parts via UTC
 * noon, so it never crosses a day boundary through a timezone offset.
 */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d, 12);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole nights between two `YYYY-MM-DD` dates (never negative). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** True when `iso` is before today in `tz`. */
export function isPastDate(iso: string, tz: string = DEFAULT_TIMEZONE): boolean {
  return iso < todayISO(tz);
}
