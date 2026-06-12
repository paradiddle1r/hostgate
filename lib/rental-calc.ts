// Pure math for monthly rentals — no DB, no React. Unit-tested.

/** Open-ended lease sentinel: a monthly tenant with no fixed move-out date. */
export const OPEN_ENDED_DATE = "2099-12-31";

export function isOpenEnded(checkOut: string): boolean {
  return checkOut >= OPEN_ENDED_DATE;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Meter usage between two cumulative readings (never negative). */
export function meterUsage(prev: number | null | undefined, curr: number | null | undefined): number {
  const p = Number(prev) || 0;
  const c = Number(curr) || 0;
  return Math.max(0, r2(c - p));
}

export interface BillParts {
  rent: number;
  electricUnits: number;
  electricRate: number;
  waterUnits: number;
  waterRate: number;
  other: number;
}

export interface BillResult {
  rent: number;
  electric_units: number;
  electric_amount: number;
  water_units: number;
  water_amount: number;
  other: number;
  total: number;
}

/** Compose a monthly bill from rent + metered utilities + other fees. */
export function calculateBill(p: BillParts): BillResult {
  const rent = r2(p.rent);
  const electric_units = r2(p.electricUnits);
  const water_units = r2(p.waterUnits);
  const electric_amount = r2(electric_units * (Number(p.electricRate) || 0));
  const water_amount = r2(water_units * (Number(p.waterRate) || 0));
  const other = r2(p.other);
  const total = r2(rent + electric_amount + water_amount + other);
  return { rent, electric_units, electric_amount, water_units, water_amount, other, total };
}

export interface SettlementParts {
  deposit: number;
  advance_rent: number;
  electric: number;
  water: number;
  other: number;
}

export interface SettlementResult {
  held: number; // deposit + advance held
  deductions: number; // advance + utilities + other
  refund: number; // held - deductions  (= deposit - utilities - other)
}

/**
 * Move-out settlement. `held = deposit + advance_rent`. The advance rent is
 * consumed (counts as a deduction), so the net refund is
 * `deposit - electric - water - other`. Can go negative (tenant owes).
 */
export function moveOutSettlement(p: SettlementParts): SettlementResult {
  const held = r2((Number(p.deposit) || 0) + (Number(p.advance_rent) || 0));
  const deductions = r2(
    (Number(p.advance_rent) || 0) + (Number(p.electric) || 0) + (Number(p.water) || 0) + (Number(p.other) || 0)
  );
  const refund = r2(held - deductions);
  return { held, deductions, refund };
}
