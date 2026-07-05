import { describe, it, expect } from "vitest";
import {
  toICalDate,
  foldLine,
  escapeICalText,
  toICalTimestamp,
  buildBookingsICS,
} from "./ical";

describe("toICalDate", () => {
  it("strips dashes", () => {
    expect(toICalDate("2026-07-05")).toBe("20260705");
  });
});

describe("toICalTimestamp", () => {
  it("converts an ISO timestamp to iCal UTC form", () => {
    expect(toICalTimestamp("2026-07-05T12:34:56.789Z")).toBe("20260705T123456Z");
  });
});

describe("escapeICalText", () => {
  it("escapes commas, semicolons, backslashes and newlines", () => {
    expect(escapeICalText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
});

describe("foldLine", () => {
  it("leaves short lines untouched", () => {
    expect(foldLine("SUMMARY:Booked")).toBe("SUMMARY:Booked");
  });
  it("folds lines over 75 octets with CRLF + a leading space", () => {
    const long = "X-TEST:" + "a".repeat(100);
    const folded = foldLine(long);
    expect(folded.startsWith(long.slice(0, 75))).toBe(true);
    expect(folded).toContain("\r\n ");
  });
});

describe("buildBookingsICS", () => {
  const dtstamp = "2026-07-05T00:00:00.000Z";

  it("wraps a calendar with no events", () => {
    const ics = buildBookingsICS("Property — Room", [], dtstamp);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("emits one all-day VEVENT per booking with a stable UID", () => {
    const ics = buildBookingsICS(
      "Property — Room",
      [{ id: "abc-123", checkIn: "2026-07-10", checkOut: "2026-07-12" }],
      dtstamp
    );
    expect(ics).toContain("UID:booking-abc-123@hostgate.app");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260710");
    expect(ics).toContain("DTEND;VALUE=DATE:20260712");
    expect(ics).toContain("SUMMARY:Booked");
    // No guest PII of any kind should ever appear in the feed.
    expect(ics).not.toMatch(/guest|phone|email/i);
  });

  it("uses CRLF line endings", () => {
    const ics = buildBookingsICS("P", [], dtstamp);
    expect(ics.includes("\r\n")).toBe(true);
  });
});
