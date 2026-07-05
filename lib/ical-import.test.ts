import { describe, it, expect } from "vitest";
import { parseICS } from "./ical-import";

describe("parseICS", () => {
  it("parses a single all-day VEVENT", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:abc123@booking.com",
      "DTSTART;VALUE=DATE:20260710",
      "DTEND;VALUE=DATE:20260712",
      "SUMMARY:Reserved",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseICS(ics)).toEqual([
      { uid: "abc123@booking.com", checkIn: "2026-07-10", checkOut: "2026-07-12" },
    ]);
  });

  it("parses multiple VEVENTs", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:a@x",
      "DTSTART;VALUE=DATE:20260701",
      "DTEND;VALUE=DATE:20260703",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:b@x",
      "DTSTART;VALUE=DATE:20260801",
      "DTEND;VALUE=DATE:20260805",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(parseICS(ics)).toEqual([
      { uid: "a@x", checkIn: "2026-07-01", checkOut: "2026-07-03" },
      { uid: "b@x", checkIn: "2026-08-01", checkOut: "2026-08-05" },
    ]);
  });

  it("handles LF-only line endings", () => {
    const ics = [
      "BEGIN:VEVENT",
      "UID:lf@x",
      "DTSTART;VALUE=DATE:20260101",
      "DTEND;VALUE=DATE:20260102",
      "END:VEVENT",
    ].join("\n");
    expect(parseICS(ics)).toEqual([{ uid: "lf@x", checkIn: "2026-01-01", checkOut: "2026-01-02" }]);
  });

  it("un-folds continuation lines (RFC 5545 §3.1)", () => {
    // A folded UID: continuation line starts with a single space.
    const ics = [
      "BEGIN:VEVENT",
      "UID:folded-part-one",
      " -part-two@x",
      "DTSTART;VALUE=DATE:20260710",
      "DTEND;VALUE=DATE:20260712",
      "END:VEVENT",
    ].join("\r\n");
    expect(parseICS(ics)).toEqual([
      { uid: "folded-part-one-part-two@x", checkIn: "2026-07-10", checkOut: "2026-07-12" },
    ]);
  });

  it("accepts DTSTART/DTEND without VALUE=DATE and truncates timestamp form", () => {
    const ics = [
      "BEGIN:VEVENT",
      "UID:ts@x",
      "DTSTART:20260710T120000Z",
      "DTEND:20260712T140000Z",
      "END:VEVENT",
    ].join("\r\n");
    expect(parseICS(ics)).toEqual([{ uid: "ts@x", checkIn: "2026-07-10", checkOut: "2026-07-12" }]);
  });

  it("skips a VEVENT missing UID/DTSTART/DTEND", () => {
    const ics = [
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260710",
      "DTEND;VALUE=DATE:20260712",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:ok@x",
      "DTSTART;VALUE=DATE:20260901",
      "DTEND;VALUE=DATE:20260903",
      "END:VEVENT",
    ].join("\r\n");
    expect(parseICS(ics)).toEqual([{ uid: "ok@x", checkIn: "2026-09-01", checkOut: "2026-09-03" }]);
  });

  it("returns an empty array for a calendar with no VEVENTs", () => {
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "END:VCALENDAR"].join("\r\n");
    expect(parseICS(ics)).toEqual([]);
  });
});
