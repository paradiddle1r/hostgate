// lib/accounting/depreciation.ts
// ────────────────────────────────────────────────────────────────────────────
// Fixed-asset straight-line depreciation — pure math (TS side).
//
// The projection/preview twin of the DB run_depreciation() (migration 23). The
// DB is the AUTHORITY for what actually gets posted (asset_depreciation_lines +
// the monthly draft journal entry); this module reproduces the SAME formula so
// the /assets page can render a full projected schedule and reconcile it against
// the actually-posted lines.
//
// Method: straight-line, monthly.
//   base    = round(cost − salvage, 2)
//   monthly = round(base / useful_life_months, 2)
//   month 1 = prorated by acquisition day, days-in-month basis
//   final   = clamped so accumulated never exceeds `base` (book value floors at salvage)
//
// Rounding uses the SAME integer-cents, ties-away-from-zero core as money.ts.
// ────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { _internal } from "./money";

const { toHundredths } = _internal;

/** Tenant + property scope every DB-touching accounting helper takes. */
export interface TenantScope {
  tenantId: string;
  propertyId: string;
}

/** The subset of a fixed_assets row the schedule math reads. */
export interface AssetLike {
  cost?: unknown;
  salvage?: unknown;
  useful_life_months?: unknown;
  acquired_date?: string | null;
  accum_depreciation?: unknown;
}

export interface ScheduleRow {
  period: string;
  amount: number;
  accumulated: number;
  bookValue: number;
}

/** Round to 2dp, ties away from zero (parity with Postgres round(numeric,2)). */
export function round2(n: unknown): number {
  return Number(toHundredths(n)) / 100;
}

// ── period ('YYYY-MM') helpers ───────────────────────────────────────────────

/** Days in a 1-based (year, month) — e.g. daysInMonth(2026, 2) === 28. */
export function daysInMonth(year: unknown, month1: unknown): number {
  return new Date(Date.UTC(Number(year), Number(month1), 0)).getUTCDate();
}

/** Days in the month of a 'YYYY-MM' period string. */
export function periodDaysInMonth(period: string): number {
  const [y, m] = String(period).split("-").map(Number);
  return daysInMonth(y, m);
}

/** Next month: nextPeriod('2026-12') === '2027-01'. */
export function nextPeriod(period: string): string {
  const parts = String(period).split("-").map(Number);
  let y = parts[0];
  let m = parts[1] + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
}

/** Last calendar day of a period as 'YYYY-MM-DD' (the JE entry_date). */
export function periodEndDate(period: string): string {
  return `${period}-${String(periodDaysInMonth(period)).padStart(2, "0")}`;
}

/** 'YYYY-MM' month key of a 'YYYY-MM-DD' (or ISO) date string. */
export function monthKeyOf(dateStr: unknown): string {
  return String(dateStr).slice(0, 7);
}

// ── core straight-line math ──────────────────────────────────────────────────

/** Depreciable base = round(cost − salvage, 2), floored at 0. */
export function depreciableBase(asset: AssetLike | null | undefined): number {
  const base = round2((Number(asset?.cost) || 0) - (Number(asset?.salvage) || 0));
  return base > 0 ? base : 0;
}

/** Standard monthly straight-line charge = round(base / useful_life_months, 2). */
export function monthlyDepreciation(asset: AssetLike | null | undefined): number {
  const base = depreciableBase(asset);
  const life = Number(asset?.useful_life_months) || 0;
  if (base <= 0 || life <= 0) return 0;
  return round2(base / life);
}

/**
 * First-month (acquisition-month) prorated charge. Proration factor is
 * held/daysInMonth where held = daysInMonth − acquisitionDay + 1. When `period`
 * is supplied and is NOT the acquisition month, the full monthly charge is
 * returned (proration only applies in the acquisition month).
 */
export function prorateFirstMonth(
  asset: AssetLike | null | undefined,
  period: string | null = null,
): number {
  const monthly = monthlyDepreciation(asset);
  if (monthly <= 0) return 0;
  const acq = monthKeyOf(asset?.acquired_date);
  if (period && period !== acq) return monthly;
  const day = Number(String(asset?.acquired_date).slice(8, 10)) || 1;
  const dim = periodDaysInMonth(acq);
  const held = Math.max(0, dim - day + 1);
  return round2((monthly * held) / dim);
}

/**
 * Clamp a proposed charge so that `accumulated + charge` never exceeds `base`.
 * Returns 0 once fully depreciated (floors book value at salvage).
 */
export function clampFinal(amount: number, accumulated: number, base: number): number {
  const remaining = round2(base - accumulated);
  if (remaining <= 0) return 0;
  return amount > remaining ? remaining : amount;
}

/**
 * Full projected schedule from the acquisition month onward.
 *   accumulated = running Σ charges (never exceeds base)
 *   bookValue   = round(cost − accumulated, 2)  (floors at salvage)
 * Empty for non-depreciable inputs (base ≤ 0 or life ≤ 0 or no acquired_date).
 */
export function scheduleFor(
  asset: AssetLike | null | undefined,
  { maxMonths = 1200 }: { maxMonths?: number } = {},
): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  const base = depreciableBase(asset);
  const life = Number(asset?.useful_life_months) || 0;
  if (base <= 0 || life <= 0 || !asset?.acquired_date) return rows;

  const monthly = monthlyDepreciation(asset);
  const cost = round2(Number(asset.cost) || 0);
  let period = monthKeyOf(asset.acquired_date);
  let accumulated = 0;
  let first = true;
  let guard = 0;

  while (round2(base - accumulated) > 0 && guard < maxMonths) {
    guard++;
    let amount = first ? prorateFirstMonth(asset, period) : monthly;
    amount = clampFinal(amount, accumulated, base);
    if (amount <= 0) break;
    accumulated = round2(accumulated + amount);
    rows.push({
      period,
      amount,
      accumulated,
      bookValue: round2(cost - accumulated),
    });
    first = false;
    period = nextPeriod(period);
  }
  return rows;
}

/**
 * Charge for ONE specific period, given how much is already accumulated —
 * mirrors exactly what the DB runner computes for that period. Returns 0 when
 * nothing is due (before acquisition, or already fully depreciated).
 */
export function chargeForPeriod(
  asset: AssetLike | null | undefined,
  period: string,
  accumulated = 0,
): number {
  const base = depreciableBase(asset);
  const life = Number(asset?.useful_life_months) || 0;
  if (base <= 0 || life <= 0 || !asset?.acquired_date) return 0;
  const acq = monthKeyOf(asset.acquired_date);
  if (period < acq) return 0;
  const raw = period === acq ? prorateFirstMonth(asset, period) : monthlyDepreciation(asset);
  return clampFinal(raw, accumulated, base);
}

/** True once the asset has no depreciable value left. */
export function isFullyDepreciated(
  asset: AssetLike | null | undefined,
  accumulated: number | null = null,
): boolean {
  const base = depreciableBase(asset);
  const acc = accumulated == null ? Number(asset?.accum_depreciation) || 0 : accumulated;
  return base > 0 ? round2(base - acc) <= 0 : true;
}

/** Current book value = round(cost − accum_depreciation, 2). */
export function bookValue(
  asset: AssetLike | null | undefined,
  accumulated: number | null = null,
): number {
  const acc = accumulated == null ? Number(asset?.accum_depreciation) || 0 : accumulated;
  return round2((Number(asset?.cost) || 0) - acc);
}

// ── supabase action ───────────────────────────────────────────────────────────

/**
 * Run the monthly depreciation posting for a period (tenant+property scoped).
 * Thin wrapper over the DB run_depreciation() runner (migration 23), which posts
 * one combined DRAFT general-journal entry per period. Returns the runner's
 * jsonb summary ({ period, status, assets_processed, lines_created, entry_id, ... }).
 */
export async function runDepreciation(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  period: string,
): Promise<unknown> {
  const { data, error } = await supabase.rpc("run_depreciation", {
    p_tenant: tenantId,
    p_property: propertyId,
    p_period: period,
  });
  if (error) throw error;
  return data;
}
