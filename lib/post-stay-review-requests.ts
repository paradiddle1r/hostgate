// Post-stay review request EMAIL PIPELINE — roadmap m1.
//
// Mirrors lib/pre-arrival-reminders.ts: pure, DB-free selection logic so the
// cron route can stay thin and this business rule remains trivially
// unit-testable. No Supabase/network/Date.now() calls happen in here.
//
// Dates are compared as plain YYYY-MM-DD strings throughout, never as Date
// objects/timestamps — that avoids any time-of-day/timezone drift between
// "today" (as computed by the caller) and the stored `check_out` date.

/** Status eligible for a post-stay review request — explicitly excludes cancelled (and all non-checked-out states). */
const REVIEW_REQUEST_ELIGIBLE_STATUS = "checked_out";

/**
 * Minimal shape this module needs from a booking. Kept generic (rather than
 * importing the full `Booking` type from lib/db/bookings.ts) so callers can
 * pass richer, DB-shaped rows straight through and get them back typed.
 */
export interface ReviewRequestCandidateBooking {
  check_out: string; // YYYY-MM-DD
  status: string;
}

/** Add `days` calendar days to a YYYY-MM-DD date string, UTC-safe, no time-of-day drift. */
function addDaysISO(dateISO: string, days: number): string {
  const t = Date.parse(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(t)) return dateISO;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Select the bookings due a post-stay review request "today" (`todayISO`,
 * YYYY-MM-DD): those whose `check_out` equals `todayISO - daysAfter` days
 * exactly, and whose status is checked_out (cancelled — and all other states
 * — are never requested).
 *
 * Pure and side-effect free: no DB, no email sending, no Date.now(). Compares
 * check_out as a date-only string against a computed target date string, so
 * there's no time-of-day/timezone drift regardless of what time the cron
 * actually fires.
 */
export function selectBookingsDueForReviewRequest<T extends ReviewRequestCandidateBooking>(
  todayISO: string,
  bookings: T[],
  daysAfter = 1
): T[] {
  const targetDate = addDaysISO(todayISO, -daysAfter);
  return bookings.filter(
    (b) => b.check_out === targetDate && b.status === REVIEW_REQUEST_ELIGIBLE_STATUS
  );
}
