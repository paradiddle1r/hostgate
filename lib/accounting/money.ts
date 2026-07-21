// lib/accounting/money.ts
// ────────────────────────────────────────────────────────────────────────────
// Single source of truth for invoice / sales-document money math (TS side).
//
// The authority for stored totals is Postgres: recompute_sales_document_totals()
// / recompute_expense_totals() (migration 21) and the invoice recompute path.
// This module reproduces that formula EXACTLY so the app can preview / post
// totals without a round-trip, and so every phase (documents, credit/debit
// notes, GL, VAT) shares one tested implementation.
//
// Parity strategy — why BigInt and not `Math.round(x*100)/100`:
//   Postgres `numeric` is exact decimal and `round(v, 2)` rounds half AWAY FROM
//   ZERO. JS floats can't represent 0.1/1.07 exactly, and `Math.round` rounds
//   half toward +Infinity (disagreeing on negatives — credit-note territory).
//   We therefore work in integer minor units (satang / "cents") with BigInt and
//   round with explicit ties-away-from-zero integer division. Inputs are
//   numeric(12,2) in the DB, so scaling them to integer cents is exact.
//
//   Formula (mirror of recompute_*_totals):
//     v_lines = Σ line_total   (line_total = round(qty*unit_price, 2))
//     v_disc  = discount        (absolute amount, applied before VAT)
//     inclusive:  total = round(v_lines - v_disc, 2)
//                 net   = round(total / (1 + rate/100), 2)
//                 vat   = round(total - net, 2)
//     exclusive:  net   = round(v_lines - v_disc, 2)
//                 vat   = round(net * (rate/100), 2)
//                 total = round(net + vat, 2)
//   `subtotal` == v_lines (raw line sum, pre-discount).
// ────────────────────────────────────────────────────────────────────────────

// Re-export display formatters so callers have one money import surface.
export { fmtBaht, fmtBahtK } from "./format";

/** A line item — either a pre-computed numeric line_total, or an object the DB
 *  generated column `round(qty*unit_price, 2)` is reproduced from. Discount
 *  lines carry a negative unit_price, exactly as the DB stores them. */
export type MoneyLineObject = {
  qty?: unknown;
  unit_price?: unknown;
  line_total?: unknown;
  is_discount?: boolean;
};
export type MoneyLine = number | MoneyLineObject | null | undefined;

export interface Totals {
  subtotal: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
}

// ── exact integer helpers ────────────────────────────────────────────────────

/**
 * Convert a value in currency (or percentage) units — at most 2 dp, as stored
 * in numeric(12,2) — to integer hundredths (BigInt), rounding half away from
 * zero. e.g. toHundredths(12.34) → 1234n, toHundredths(-0.5) → -50n.
 */
function toHundredths(n: unknown): bigint {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0n;
  const scaled = x * 100;
  const r = scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled);
  return BigInt(r);
}

/** Round a/b (b > 0) to the nearest integer, ties AWAY from zero — the same
 *  rule Postgres `round(numeric, s)` uses. Pure BigInt so it is exact. */
function roundDivAway(a: bigint, b: bigint): bigint {
  const neg = a < 0n;
  const aa = neg ? -a : a;
  const q = aa / b;
  const r = aa % b;
  const rounded = r * 2n >= b ? q + 1n : q;
  return neg ? -rounded : rounded;
}

/** Integer cents (BigInt) → currency number with 2 dp. */
function fromCents(c: bigint): number {
  return Number(c) / 100;
}

/** Line total for one item, mirroring `line_total = round(qty * unit_price, 2)`.
 *  Returns integer cents (BigInt). unit_price is expected already-signed. */
function lineCents(qty: unknown, unitPrice: unknown): bigint {
  const qi = toHundredths(qty); // qty   × 100
  const pi = toHundredths(unitPrice); // price × 100
  // qi*pi is in 1e-4 units; divide by 100 (ties away) → cents.
  return roundDivAway(qi * pi, 100n);
}

/** Sum a `lines` array to integer cents. Elements may be numbers (a pre-computed
 *  line_total) or objects {qty, unit_price} (computed like the DB column). */
function sumLineCents(lines: readonly MoneyLine[] | null | undefined): bigint {
  let total = 0n;
  for (const ln of lines || []) {
    if (ln == null) continue;
    if (typeof ln === "number") {
      total += toHundredths(ln);
    } else if (typeof ln === "object") {
      if (ln.line_total != null && ln.qty == null && ln.unit_price == null) {
        total += toHundredths(ln.line_total);
      } else {
        const qty = ln.qty == null ? 1 : ln.qty;
        total += lineCents(qty, ln.unit_price);
      }
    }
  }
  return total;
}

// ── public API ───────────────────────────────────────────────────────────────

export interface ComputeTotalsArgs {
  lines?: readonly MoneyLine[];
  /** header-level discount, absolute amount, applied before VAT. */
  discount?: number | string | null;
  /** VAT rate as a PERCENTAGE (e.g. 7 == 7%). Coalesced to 0. */
  vatRate?: number | string | null;
  /** true ⇒ line prices already include VAT. */
  vatInclusive?: boolean;
}

/**
 * Compute invoice / sales-document totals, byte-for-byte compatible with the DB
 * recompute_*_totals() formula. `subtotal` is the raw line sum (pre-discount).
 */
export function computeTotals({
  lines = [],
  discount = 0,
  vatRate = 0,
  vatInclusive = false,
}: ComputeTotalsArgs = {}): Totals {
  const subtotalCents = sumLineCents(lines);
  const discCents = toHundredths(discount);
  const ri = toHundredths(vatRate); // rate × 100 (basis of 1e-4 as a fraction)

  let netCents: bigint;
  let vatCents: bigint;
  let totalCents: bigint;

  if (vatInclusive) {
    totalCents = subtotalCents - discCents;
    // net = total / (1 + rate/100) = total * 10000 / (10000 + rate*100)
    netCents = roundDivAway(totalCents * 10000n, 10000n + ri);
    vatCents = totalCents - netCents;
  } else {
    netCents = subtotalCents - discCents;
    // vat = net * rate/100 = net * (rate*100) / 10000
    vatCents = roundDivAway(netCents * ri, 10000n);
    totalCents = netCents + vatCents;
  }

  return {
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discCents),
    net: fromCents(netCents),
    vat: fromCents(vatCents),
    total: fromCents(totalCents),
  };
}

// Exported for unit tests / advanced callers that need the exact-integer pieces.
export const _internal = { toHundredths, roundDivAway, lineCents, sumLineCents };
