import { describe, it, expect } from "vitest";
import { computeTotals, _internal } from "../money";

// Every expected value below is computed the way Postgres `numeric` +
// round(v,2) [ties AWAY from zero] would, matching recompute_*_totals().
// If these pass, the JS core and the DB agree.

const near = (got: number, want: number) => expect(got).toBeCloseTo(want, 2);

function expectTotals(
  res: { subtotal: number; discount: number; net: number; vat: number; total: number },
  { subtotal, discount, net, vat, total }: { subtotal: number; discount: number; net: number; vat: number; total: number },
) {
  near(res.subtotal, subtotal);
  near(res.discount, discount);
  near(res.net, net);
  near(res.vat, vat);
  near(res.total, total);
}

describe("computeTotals — VAT-exclusive", () => {
  it("simple 3 nights × 1000, 7% added on top", () => {
    const r = computeTotals({ lines: [{ qty: 3, unit_price: 1000 }], vatRate: 7, vatInclusive: false });
    expectTotals(r, { subtotal: 3000, discount: 0, net: 3000, vat: 210, total: 3210 });
  });

  it("header discount is applied BEFORE vat (net = lines − discount)", () => {
    const r = computeTotals({ lines: [{ qty: 1, unit_price: 1000 }], discount: 100, vatRate: 7, vatInclusive: false });
    expectTotals(r, { subtotal: 1000, discount: 100, net: 900, vat: 63, total: 963 });
  });

  it("rate 0 is a clean pass-through (monthly rental-bill case)", () => {
    const r = computeTotals({ lines: [{ qty: 1, unit_price: 4500 }], vatRate: 0, vatInclusive: false });
    expectTotals(r, { subtotal: 4500, discount: 0, net: 4500, vat: 0, total: 4500 });
  });

  it("accepts pre-computed numeric line totals too", () => {
    const r = computeTotals({ lines: [3000], vatRate: 7, vatInclusive: false });
    expectTotals(r, { subtotal: 3000, discount: 0, net: 3000, vat: 210, total: 3210 });
  });
});

describe("computeTotals — VAT-inclusive (hotel policy)", () => {
  it("strips 7% out of a tax-inclusive 3000 line", () => {
    // 3000 / 1.07 = 2803.7383… → 2803.74 ; vat = 196.26
    const r = computeTotals({ lines: [{ qty: 3, unit_price: 1000 }], vatRate: 7, vatInclusive: true });
    expectTotals(r, { subtotal: 3000, discount: 0, net: 2803.74, vat: 196.26, total: 3000 });
  });

  it("discount lowers the gross first, then vat is stripped", () => {
    // gross 1070 − 70 = 1000 ; 1000/1.07 = 934.58 ; vat = 65.42
    const r = computeTotals({ lines: [{ qty: 1, unit_price: 1070 }], discount: 70, vatRate: 7, vatInclusive: true });
    expectTotals(r, { subtotal: 1070, discount: 70, net: 934.58, vat: 65.42, total: 1000 });
  });

  it("exact 1.07 multiple divides cleanly", () => {
    const r = computeTotals({ lines: [{ qty: 1, unit_price: 10700 }], vatRate: 7, vatInclusive: true });
    expectTotals(r, { subtotal: 10700, discount: 0, net: 10000, vat: 700, total: 10700 });
  });
});

describe("computeTotals — line-level discount (negative unit_price row)", () => {
  it("sums the signed line totals, DB-style, then applies vat", () => {
    // 2×1500 = 3000 ; discount line −500 ; net 2500 ; vat 175
    const r = computeTotals({
      lines: [
        { qty: 2, unit_price: 1500 },
        { qty: 1, unit_price: -500, is_discount: true },
      ],
      vatRate: 7,
      vatInclusive: false,
    });
    expectTotals(r, { subtotal: 2500, discount: 0, net: 2500, vat: 175, total: 2675 });
  });
});

describe("computeTotals — half-away-from-zero rounding parity", () => {
  it("rounds a .xx5 line the way Postgres does (Math.round would under-round)", () => {
    // 1.5 × 1000.05 = 1500.075 → Postgres round() = 1500.08 (ties away).
    const r = computeTotals({ lines: [{ qty: 1.5, unit_price: 1000.05 }], vatRate: 0, vatInclusive: false });
    near(r.subtotal, 1500.08);
    near(r.total, 1500.08);
  });

  it("negative amounts round away from zero (credit-note direction)", () => {
    // −1070 inclusive 7% → net −1000, vat −70, total −1070
    const r = computeTotals({ lines: [{ qty: 1, unit_price: -1070 }], vatRate: 7, vatInclusive: true });
    expectTotals(r, { subtotal: -1070, discount: 0, net: -1000, vat: -70, total: -1070 });
  });
});

describe("computeTotals — structural invariants (mirror the DB)", () => {
  const cases = [
    { lines: [{ qty: 2, unit_price: 850 }], discount: 0, vatRate: 7, vatInclusive: false },
    { lines: [{ qty: 4, unit_price: 1234.5 }], discount: 250, vatRate: 7, vatInclusive: true },
    { lines: [{ qty: 1, unit_price: 999.99 }], discount: 0, vatRate: 7, vatInclusive: true },
  ];
  it("exclusive: net = subtotal − discount, total = net + vat", () => {
    const c = cases[0];
    const r = computeTotals(c);
    near(r.net, r.subtotal - r.discount);
    near(r.total, r.net + r.vat);
  });
  it("inclusive: total = subtotal − discount, subtotal = net + vat", () => {
    for (const c of [cases[1], cases[2]]) {
      const r = computeTotals(c);
      near(r.total, r.subtotal - r.discount);
      near(r.total, r.net + r.vat);
    }
  });
});

describe("computeTotals — defensive defaults", () => {
  it("empty / missing args → all zeros", () => {
    expectTotals(computeTotals(), { subtotal: 0, discount: 0, net: 0, vat: 0, total: 0 });
    expectTotals(computeTotals({ lines: [] }), { subtotal: 0, discount: 0, net: 0, vat: 0, total: 0 });
  });
  it("missing vatRate is treated as 0 (mirrors DB coalesce)", () => {
    const r = computeTotals({ lines: [{ qty: 1, unit_price: 100 }] });
    expectTotals(r, { subtotal: 100, discount: 0, net: 100, vat: 0, total: 100 });
  });
});

describe("_internal exact-integer helpers", () => {
  it("roundDivAway ties away from zero", () => {
    const { roundDivAway } = _internal;
    expect(roundDivAway(5n, 2n)).toBe(3n); // 2.5 → 3
    expect(roundDivAway(-5n, 2n)).toBe(-3n); // −2.5 → −3
    expect(roundDivAway(4n, 2n)).toBe(2n);
    expect(roundDivAway(149n, 100n)).toBe(1n); // 1.49 → 1
    expect(roundDivAway(150n, 100n)).toBe(2n); // 1.50 → 2
  });
  it("lineCents mirrors round(qty*unit_price, 2)", () => {
    const { lineCents } = _internal;
    expect(lineCents(1.5, 1000.05)).toBe(150008n); // 1500.08
    expect(lineCents(3, 1000)).toBe(300000n);
  });
});
