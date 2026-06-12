import { describe, it, expect } from "vitest";
import { meterUsage, calculateBill, moveOutSettlement, isOpenEnded, OPEN_ENDED_DATE } from "./rental-calc";

describe("meterUsage", () => {
  it("returns the positive delta", () => {
    expect(meterUsage(100, 145)).toBe(45);
  });
  it("never goes negative (meter reset / bad input)", () => {
    expect(meterUsage(200, 50)).toBe(0);
    expect(meterUsage(null, 30)).toBe(30);
    expect(meterUsage(undefined, undefined)).toBe(0);
  });
});

describe("calculateBill", () => {
  it("composes rent + metered utilities + other", () => {
    const b = calculateBill({
      rent: 4000, electricUnits: 120, electricRate: 8, waterUnits: 15, waterRate: 18, other: 200,
    });
    expect(b.electric_amount).toBe(960); // 120*8
    expect(b.water_amount).toBe(270); // 15*18
    expect(b.total).toBe(4000 + 960 + 270 + 200);
  });
  it("rounds to 2 dp", () => {
    const b = calculateBill({ rent: 0, electricUnits: 1, electricRate: 8.005, waterUnits: 0, waterRate: 0, other: 0 });
    expect(b.electric_amount).toBe(8.01);
  });
});

describe("moveOutSettlement", () => {
  it("advance is consumed; net refund = deposit - utilities - other", () => {
    const s = moveOutSettlement({ deposit: 8000, advance_rent: 4000, electric: 960, water: 270, other: 0 });
    expect(s.held).toBe(12000); // deposit + advance
    expect(s.deductions).toBe(4000 + 960 + 270);
    expect(s.refund).toBe(8000 - 960 - 270); // 6770
  });
  it("can go negative when the tenant owes", () => {
    const s = moveOutSettlement({ deposit: 1000, advance_rent: 0, electric: 1500, water: 0, other: 0 });
    expect(s.refund).toBe(-500);
  });
});

describe("isOpenEnded", () => {
  it("detects the sentinel", () => {
    expect(isOpenEnded(OPEN_ENDED_DATE)).toBe(true);
    expect(isOpenEnded("2099-12-31")).toBe(true);
    expect(isOpenEnded("2026-08-01")).toBe(false);
  });
});
