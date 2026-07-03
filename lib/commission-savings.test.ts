import { describe, it, expect } from "vitest";
import { estimateCommissionSavings, OTA_COMMISSION_RATE } from "./commission-savings";

describe("estimateCommissionSavings", () => {
  it("applies the default OTA commission rate", () => {
    expect(estimateCommissionSavings(10_000)).toBe(10_000 * OTA_COMMISSION_RATE);
  });

  it("accepts a custom rate", () => {
    expect(estimateCommissionSavings(10_000, 0.2)).toBe(2_000);
  });

  it("returns 0 for zero/negative/non-finite revenue", () => {
    expect(estimateCommissionSavings(0)).toBe(0);
    expect(estimateCommissionSavings(-500)).toBe(0);
    expect(estimateCommissionSavings(NaN)).toBe(0);
  });
});
