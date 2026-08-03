import { describe, it, expect, afterEach, vi } from "vitest";
import {
  toLocalISODate,
  todayISO,
  addDaysISO,
  nightsBetween,
  isPastDate,
  DEFAULT_TIMEZONE,
} from "./date";

afterEach(() => vi.useRealTimers());

describe("toLocalISODate", () => {
  it("uses the property timezone, not UTC", () => {
    // 22:00 UTC on Aug 3 is already 05:00 on Aug 4 in Bangkok (+07).
    const instant = new Date("2026-08-03T22:00:00Z");
    expect(toLocalISODate(instant, "UTC")).toBe("2026-08-03");
    expect(toLocalISODate(instant, DEFAULT_TIMEZONE)).toBe("2026-08-04");
  });

  it("does not roll forward in the middle of the Bangkok day", () => {
    expect(toLocalISODate(new Date("2026-08-04T05:00:00Z"), DEFAULT_TIMEZONE)).toBe("2026-08-04");
  });
});

describe("todayISO", () => {
  it("is the local date during the 00:00-07:00 window that used to read as yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T21:30:00Z")); // 04:30 Aug 4 in Bangkok
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-08-03"); // the old bug
    expect(todayISO()).toBe("2026-08-04");
  });
});

describe("addDaysISO", () => {
  it("adds and subtracts whole days", () => {
    expect(addDaysISO("2026-08-04", 1)).toBe("2026-08-05");
    expect(addDaysISO("2026-08-04", -1)).toBe("2026-08-03");
    expect(addDaysISO("2026-08-04", 0)).toBe("2026-08-04");
  });

  it("crosses month and year boundaries", () => {
    expect(addDaysISO("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("handles the leap day", () => {
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2028-02-29", 1)).toBe("2028-03-01");
  });
});

describe("nightsBetween", () => {
  it("counts nights, not calendar days touched", () => {
    expect(nightsBetween("2026-08-05", "2026-08-07")).toBe(2);
    expect(nightsBetween("2026-08-05", "2026-08-06")).toBe(1);
  });

  it("is zero for a same-day or inverted range", () => {
    expect(nightsBetween("2026-08-05", "2026-08-05")).toBe(0);
    expect(nightsBetween("2026-08-07", "2026-08-05")).toBe(0);
  });

  it("spans a month boundary", () => {
    expect(nightsBetween("2026-08-30", "2026-09-02")).toBe(3);
  });
});

describe("isPastDate", () => {
  it("compares against the local day, so an early-morning today is not 'past'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T21:30:00Z")); // 04:30 Aug 4 in Bangkok
    expect(isPastDate("2026-08-04")).toBe(false);
    expect(isPastDate("2026-08-03")).toBe(true);
    expect(isPastDate("2026-08-05")).toBe(false);
  });
});
