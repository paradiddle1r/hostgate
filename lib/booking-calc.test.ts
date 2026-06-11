import { describe, it, expect } from "vitest";
import { nightsBetween, nightDates, overlaps, stayTotal } from "./booking-calc";

describe("nightsBetween", () => {
  it("counts half-open nights", () => {
    expect(nightsBetween("2026-07-01", "2026-07-03")).toBe(2);
    expect(nightsBetween("2026-07-01", "2026-07-01")).toBe(0);
  });
  it("returns 0 for bad input", () => {
    expect(nightsBetween("nope", "2026-07-03")).toBe(0);
  });
});

describe("nightDates", () => {
  it("lists each night's date", () => {
    expect(nightDates("2026-07-01", "2026-07-03")).toEqual(["2026-07-01", "2026-07-02"]);
  });
});

describe("overlaps", () => {
  it("true when ranges intersect", () => {
    expect(overlaps("2026-07-01", "2026-07-04", "2026-07-03", "2026-07-05")).toBe(true);
  });
  it("false when adjacent (checkout == next checkin)", () => {
    expect(overlaps("2026-07-01", "2026-07-03", "2026-07-03", "2026-07-05")).toBe(false);
  });
});

describe("stayTotal", () => {
  it("uses base rate when no override", () => {
    const r = stayTotal({}, 800, "2026-07-01", "2026-07-03");
    expect(r.nights).toBe(2);
    expect(r.total).toBe(1600);
  });
  it("applies per-date overrides", () => {
    const r = stayTotal({ "2026-07-01": 1000 }, 800, "2026-07-01", "2026-07-03");
    expect(r.total).toBe(1800); // 1000 + 800
  });
});
