import { describe, it, expect } from "vitest";
import { selectBookingsDueForReminder, type ReminderCandidateBooking } from "./pre-arrival-reminders";

const TODAY = "2026-07-09";

function booking(check_in: string, status: string): ReminderCandidateBooking {
  return { check_in, status };
}

describe("selectBookingsDueForReminder", () => {
  it("includes a confirmed booking checking in exactly today+3", () => {
    const bookings = [booking("2026-07-12", "confirmed")];
    const due = selectBookingsDueForReminder(TODAY, bookings, 3);
    expect(due).toEqual([booking("2026-07-12", "confirmed")]);
  });

  it("includes a checked_in booking on the exact target date", () => {
    const bookings = [booking("2026-07-12", "checked_in")];
    expect(selectBookingsDueForReminder(TODAY, bookings, 3)).toHaveLength(1);
  });

  it("excludes a booking checking in one day too early (today+2)", () => {
    const bookings = [booking("2026-07-11", "confirmed")];
    expect(selectBookingsDueForReminder(TODAY, bookings, 3)).toEqual([]);
  });

  it("excludes a booking checking in one day too late (today+4)", () => {
    const bookings = [booking("2026-07-13", "confirmed")];
    expect(selectBookingsDueForReminder(TODAY, bookings, 3)).toEqual([]);
  });

  it("excludes a cancelled booking even on the exact target date", () => {
    const bookings = [booking("2026-07-12", "cancelled")];
    expect(selectBookingsDueForReminder(TODAY, bookings, 3)).toEqual([]);
  });

  it("respects a custom daysBefore window", () => {
    const bookings = [booking("2026-07-10", "confirmed")];
    expect(selectBookingsDueForReminder(TODAY, bookings, 1)).toHaveLength(1);
    expect(selectBookingsDueForReminder(TODAY, bookings, 3)).toEqual([]);
  });
});
