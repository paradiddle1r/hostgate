import { describe, it, expect } from "vitest";
import {
  round2, daysInMonth, periodDaysInMonth, nextPeriod, periodEndDate, monthKeyOf,
  depreciableBase, monthlyDepreciation, prorateFirstMonth, clampFinal, scheduleFor,
  chargeForPeriod, isFullyDepreciated, bookValue,
} from "../depreciation";

const sum = (rows: { amount: number }[]) => round2(rows.reduce((s, r) => s + r.amount, 0));

describe("period helpers", () => {
  it("daysInMonth handles leap years and month lengths", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29); // leap
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
  it("periodDaysInMonth parses YYYY-MM", () => {
    expect(periodDaysInMonth("2026-02")).toBe(28);
    expect(periodDaysInMonth("2026-01")).toBe(31);
  });
  it("nextPeriod rolls the year over", () => {
    expect(nextPeriod("2026-01")).toBe("2026-02");
    expect(nextPeriod("2026-12")).toBe("2027-01");
  });
  it("periodEndDate is the last calendar day", () => {
    expect(periodEndDate("2026-02")).toBe("2026-02-28");
    expect(periodEndDate("2024-02")).toBe("2024-02-29");
    expect(periodEndDate("2026-11")).toBe("2026-11-30");
  });
  it("monthKeyOf slices a date", () => {
    expect(monthKeyOf("2026-01-15")).toBe("2026-01");
  });
});

describe("depreciableBase + monthlyDepreciation", () => {
  it("base is cost minus salvage, floored at 0", () => {
    expect(depreciableBase({ cost: 12000, salvage: 0 })).toBe(12000);
    expect(depreciableBase({ cost: 10000, salvage: 1 })).toBe(9999);
    expect(depreciableBase({ cost: 1000, salvage: 1000 })).toBe(0);
    expect(depreciableBase({ cost: 500, salvage: 1000 })).toBe(0); // never negative
  });
  it("standard monthly charge over 12 / 36 / 60 month lives", () => {
    expect(monthlyDepreciation({ cost: 12000, salvage: 0, useful_life_months: 12 })).toBe(1000);
    expect(monthlyDepreciation({ cost: 36000, salvage: 0, useful_life_months: 36 })).toBe(1000);
    expect(monthlyDepreciation({ cost: 60000, salvage: 0, useful_life_months: 60 })).toBe(1000);
  });
  it("rounds half away from zero like Postgres round()", () => {
    // 9999 / 7 = 1428.42857… → 1428.43
    expect(monthlyDepreciation({ cost: 10000, salvage: 1, useful_life_months: 7 })).toBe(1428.43);
  });
  it("zero / invalid life or base yields zero", () => {
    expect(monthlyDepreciation({ cost: 12000, salvage: 0, useful_life_months: 0 })).toBe(0);
    expect(monthlyDepreciation({ cost: 1000, salvage: 1000, useful_life_months: 12 })).toBe(0);
  });
});

describe("prorateFirstMonth — acquisition-day proration", () => {
  it("acquired on the 1st ⇒ full monthly charge", () => {
    const a = { cost: 12000, salvage: 0, useful_life_months: 12, acquired_date: "2026-06-01" };
    expect(prorateFirstMonth(a, "2026-06")).toBe(1000);
  });
  it("acquired mid-month prorates by held days / days-in-month", () => {
    // monthly 1000, Jan (31d), acquired 15th → held 17 → 1000·17/31 = 548.39
    const a = { cost: 12000, salvage: 0, useful_life_months: 12, acquired_date: "2026-01-15" };
    expect(prorateFirstMonth(a, "2026-01")).toBe(548.39);
  });
  it("acquired on the last day ⇒ one day of the month", () => {
    // Feb 2026 (28d), acquired 28th → held 1 → 1000·1/28 = 35.71
    const a = { cost: 12000, salvage: 0, useful_life_months: 12, acquired_date: "2026-02-28" };
    expect(prorateFirstMonth(a, "2026-02")).toBe(35.71);
  });
  it("a non-acquisition period returns the full monthly charge", () => {
    const a = { cost: 12000, salvage: 0, useful_life_months: 12, acquired_date: "2026-01-15" };
    expect(prorateFirstMonth(a, "2026-05")).toBe(1000);
  });
});

describe("clampFinal — never exceed the depreciable base", () => {
  it("passes the charge through when room remains", () => {
    expect(clampFinal(1000, 5000, 12000)).toBe(1000);
  });
  it("clamps to the remainder in the final month", () => {
    expect(clampFinal(1000, 11548.39, 12000)).toBe(451.61);
  });
  it("returns 0 once fully depreciated", () => {
    expect(clampFinal(1000, 12000, 12000)).toBe(0);
    expect(clampFinal(1000, 12500, 12000)).toBe(0);
  });
});

describe("scheduleFor — full projected schedule", () => {
  it("standard: acquired on the 1st, even division ⇒ exactly `life` rows summing to base", () => {
    for (const life of [12, 36, 60]) {
      const a = { cost: 1000 * life, salvage: 0, useful_life_months: life, acquired_date: "2026-01-01" };
      const rows = scheduleFor(a);
      expect(rows).toHaveLength(life);
      expect(sum(rows)).toBe(1000 * life);
      expect(rows.every((r) => r.amount === 1000)).toBe(true);
      // book value floors at salvage (0 here)
      expect(rows[rows.length - 1].bookValue).toBe(0);
    }
  });

  it("first-month proration pushes a remainder into an extra final month", () => {
    const a = { cost: 12000, salvage: 0, useful_life_months: 12, acquired_date: "2026-01-15" };
    const rows = scheduleFor(a);
    expect(rows).toHaveLength(13); // 12 full months + prorated head spills a 13th
    expect(rows[0].amount).toBe(548.39); // prorated acquisition month
    expect(rows[rows.length - 1].amount).toBe(451.61); // clamped remainder
    expect(sum(rows)).toBe(12000); // total is exactly the base
    expect(rows[rows.length - 1].bookValue).toBe(0);
    expect(rows[0].period).toBe("2026-01");
    expect(rows[rows.length - 1].period).toBe("2027-01");
  });

  it("salvage floor: book value ends exactly at salvage, uneven division clamps last month", () => {
    const a = { cost: 10000, salvage: 1, useful_life_months: 7, acquired_date: "2026-03-01" };
    const rows = scheduleFor(a);
    expect(rows).toHaveLength(7);
    expect(rows[0].amount).toBe(1428.43);
    expect(rows[6].amount).toBe(1428.42); // clamped remainder (7·1428.43 would overshoot)
    expect(sum(rows)).toBe(9999); // exactly cost − salvage
    expect(rows[6].bookValue).toBe(1); // floors at salvage
  });

  it("non-depreciable inputs ⇒ empty schedule", () => {
    expect(scheduleFor({ cost: 1000, salvage: 1000, useful_life_months: 12, acquired_date: "2026-01-01" })).toEqual([]);
    expect(scheduleFor({ cost: 12000, salvage: 0, useful_life_months: 0, acquired_date: "2026-01-01" })).toEqual([]);
    expect(scheduleFor({ cost: 12000, salvage: 0, useful_life_months: 12 })).toEqual([]); // no acquired_date
  });

  it("accumulated never exceeds the base at any row", () => {
    const a = { cost: 10000, salvage: 1, useful_life_months: 7, acquired_date: "2026-03-15" };
    const base = depreciableBase(a);
    const rows = scheduleFor(a);
    for (const r of rows) expect(r.accumulated).toBeLessThanOrEqual(base);
    expect(rows[rows.length - 1].accumulated).toBe(base);
  });
});

describe("chargeForPeriod — mirrors the DB runner per period", () => {
  const a = { cost: 12000, salvage: 0, useful_life_months: 12, acquired_date: "2026-01-15" };

  it("returns 0 before the acquisition month", () => {
    expect(chargeForPeriod(a, "2025-12", 0)).toBe(0);
  });
  it("prorates the acquisition month", () => {
    expect(chargeForPeriod(a, "2026-01", 0)).toBe(548.39);
  });
  it("charges the standard monthly amount thereafter", () => {
    expect(chargeForPeriod(a, "2026-05", 548.39 + 3 * 1000)).toBe(1000);
  });
  it("clamps the final month to the remainder", () => {
    expect(chargeForPeriod(a, "2027-01", 11548.39)).toBe(451.61);
  });
  it("returns 0 once fully depreciated", () => {
    expect(chargeForPeriod(a, "2027-02", 12000)).toBe(0);
  });

  it("re-running a period is idempotent by construction (charge depends on accumulated)", () => {
    const rows = scheduleFor(a);
    let acc = 0;
    for (const r of rows) {
      const c = chargeForPeriod(a, r.period, acc);
      expect(c).toBe(r.amount);
      acc = round2(acc + c);
    }
    expect(acc).toBe(depreciableBase(a));
  });
});

describe("status helpers", () => {
  it("isFullyDepreciated tracks the base vs accumulated", () => {
    expect(isFullyDepreciated({ cost: 12000, salvage: 0 }, 12000)).toBe(true);
    expect(isFullyDepreciated({ cost: 12000, salvage: 0 }, 11999.99)).toBe(false);
    expect(isFullyDepreciated({ cost: 12000, salvage: 0, accum_depreciation: 12000 })).toBe(true);
  });
  it("bookValue = cost − accumulated", () => {
    expect(bookValue({ cost: 12000, salvage: 0 }, 3000)).toBe(9000);
    expect(bookValue({ cost: 12000, salvage: 0, accum_depreciation: 12000 })).toBe(0);
  });
});
