// Pre-arrival reminder EMAIL PIPELINE — roadmap m1.
//
// (Note: lib/bookable-addons.ts uses its own, unrelated "m1"/"m2" numbering
// for the addon catalog vs. the public cart — this file is the real roadmap
// m1, the scheduled pre-arrival reminder pipeline.)
//
// Pure, DB-free selection logic so it's trivially unit-testable: given
// "today" and a batch of bookings, which ones are due a pre-arrival reminder
// right now? The cron route (app/api/cron/pre-arrival-reminders/route.ts)
// fetches the candidate bookings and hands them to this function — no
// Supabase/network/Date.now() calls happen in here.
//
// Dates are compared as plain YYYY-MM-DD strings throughout, never as Date
// objects/timestamps — that avoids any time-of-day/timezone drift between
// "today" (as computed by the caller) and the stored `check_in` date.

/** Statuses eligible for a pre-arrival reminder — explicitly excludes cancelled (and pending/checked_out). */
const REMINDER_ELIGIBLE_STATUSES = new Set(["confirmed", "checked_in"]);

/**
 * Minimal shape this module needs from a booking. Kept generic (rather than
 * importing the full `Booking` type from lib/db/bookings.ts) so callers can
 * pass richer, DB-shaped rows straight through and get them back typed.
 */
export interface ReminderCandidateBooking {
  check_in: string; // YYYY-MM-DD
  status: string;
}

/** Add `days` calendar days to a YYYY-MM-DD date string, UTC-safe, no time-of-day drift. */
function addDaysISO(dateISO: string, days: number): string {
  const t = Date.parse(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(t)) return dateISO;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Select the bookings due a pre-arrival reminder "today" (`todayISO`,
 * YYYY-MM-DD): those whose `check_in` equals `todayISO + daysBefore` days
 * exactly, and whose status is confirmed/checked-in (cancelled — and
 * pending/checked-out — are never reminded).
 *
 * Pure and side-effect free: no DB, no email sending, no Date.now(). Compares
 * check_in as a date-only string against a computed target date string, so
 * there's no time-of-day/timezone drift regardless of what time the cron
 * actually fires.
 */
export function selectBookingsDueForReminder<T extends ReminderCandidateBooking>(
  todayISO: string,
  bookings: T[],
  daysBefore = 3
): T[] {
  const targetDate = addDaysISO(todayISO, daysBefore);
  return bookings.filter(
    (b) => b.check_in === targetDate && REMINDER_ELIGIBLE_STATUSES.has(b.status)
  );
}
