import { describe, it, expect } from "vitest";
import { validatePromoCode, applyPromoDiscount, type PromoCode } from "./promo-codes";

const list: PromoCode[] = [
  { code: "WELCOME10", type: "percent", value: 10, active: true },
  { code: "STAY300", type: "fixed", value: 300, active: true },
  { code: "OLDPROMO", type: "percent", value: 20, active: false },
  { code: "PASTDEAL", type: "percent", value: 50, active: true, expiresAt: "2020-01-01" },
];

describe("validatePromoCode", () => {
  it("accepts a valid, active code (case-insensitive)", () => {
    const r = validatePromoCode("welcome10", list);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.promo.code).toBe("WELCOME10");
  });

  it("rejects an unknown code", () => {
    const r = validatePromoCode("NOTREAL", list);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Invalid promo code/);
  });

  it("rejects an empty code", () => {
    const r = validatePromoCode("   ", list);
    expect(r.ok).toBe(false);
  });

  it("rejects an inactive code", () => {
    const r = validatePromoCode("OLDPROMO", list);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/expired/);
  });

  it("rejects an expired code", () => {
    const r = validatePromoCode("PASTDEAL", list);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/expired/);
  });
});

describe("applyPromoDiscount", () => {
  it("applies a percent discount", () => {
    const r = applyPromoDiscount(1000, "WELCOME10", list);
    expect(r.ok).toBe(true);
    expect(r.discountAmount).toBe(100);
    expect(r.discountedTotal).toBe(900);
  });

  it("applies a fixed discount", () => {
    const r = applyPromoDiscount(1000, "STAY300", list);
    expect(r.ok).toBe(true);
    expect(r.discountAmount).toBe(300);
    expect(r.discountedTotal).toBe(700);
  });

  it("falls back to the original total on an invalid code, with ok:false", () => {
    const r = applyPromoDiscount(1000, "NOTREAL", list);
    expect(r.ok).toBe(false);
    expect(r.discountAmount).toBe(0);
    expect(r.discountedTotal).toBe(1000);
    expect(r.message).toBeTruthy();
  });

  it("falls back to the original total on an expired/inactive code", () => {
    const inactive = applyPromoDiscount(1000, "OLDPROMO", list);
    expect(inactive.ok).toBe(false);
    expect(inactive.discountedTotal).toBe(1000);

    const expired = applyPromoDiscount(1000, "PASTDEAL", list);
    expect(expired.ok).toBe(false);
    expect(expired.discountedTotal).toBe(1000);
  });

  it("never lets the discounted total go negative (fixed discount larger than total)", () => {
    const r = applyPromoDiscount(100, "STAY300", list);
    expect(r.ok).toBe(true);
    expect(r.discountAmount).toBe(100);
    expect(r.discountedTotal).toBe(0);
  });

  it("clamps a huge percent discount to the total (never negative)", () => {
    const huge: PromoCode[] = [{ code: "MEGA", type: "percent", value: 500, active: true }];
    const r = applyPromoDiscount(200, "MEGA", huge);
    expect(r.ok).toBe(true);
    expect(r.discountAmount).toBe(200);
    expect(r.discountedTotal).toBe(0);
  });

  it("treats a zero/negative total as zero", () => {
    const r = applyPromoDiscount(-50, "WELCOME10", list);
    expect(r.discountedTotal).toBe(0);
    expect(r.discountAmount).toBe(0);
  });
});
