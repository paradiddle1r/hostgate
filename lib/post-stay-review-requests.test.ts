import { describe, it, expect } from "vitest";
import {
  selectBookingsDueForReviewRequest,
  type ReviewRequestCandidateBooking,
} from "./post-stay-review-requests";

const TODAY = "2026-07-09";

function booking(check_out: string, status: string): ReviewRequestCandidateBooking {
  return { check_out, status };
}

describe("selectBookingsDueForReviewRequest", () => {
  it("includes a checked_out booking checking out exactly today-1", () => {
    const bookings = [booking("2026-07-08", "checked_out")];
    const due = selectBookingsDueForReviewRequest(TODAY, bookings, 1);
    expect(due).toEqual([booking("2026-07-08", "checked_out")]);
  });

  it("excludes a booking checking out on the wrong date", () => {
    const bookings = [booking("2026-07-07", "checked_out")];
    expect(selectBookingsDueForReviewRequest(TODAY, bookings, 1)).toEqual([]);
  });

  it("excludes a booking with the wrong status even on the exact target date", () => {
    const bookings = [booking("2026-07-08", "confirmed")];
    expect(selectBookingsDueForReviewRequest(TODAY, bookings, 1)).toEqual([]);
  });

  it("excludes a cancelled booking even on the exact target date", () => {
    const bookings = [booking("2026-07-08", "cancelled")];
    expect(selectBookingsDueForReviewRequest(TODAY, bookings, 1)).toEqual([]);
  });

  it("respects a custom daysAfter window", () => {
    const bookings = [booking("2026-07-06", "checked_out")];
    expect(selectBookingsDueForReviewRequest(TODAY, bookings, 3)).toHaveLength(1);
    expect(selectBookingsDueForReviewRequest(TODAY, bookings, 1)).toEqual([]);
  });
});
