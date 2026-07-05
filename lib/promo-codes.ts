// Promo / discount codes for the public direct-booking checkout flow.
//
// This is a pure, DB-free seed list — no migration, no table. Property owners
// will eventually manage their own codes via a settings UI (a later
// milestone); until then this exported array IS the source of truth and can
// be edited directly. Kept framework-agnostic (no "server-only") so it can be
// imported from both the client CheckoutForm (for instant validation/preview)
// and server code (app/book/actions.ts / lib/book.ts) for the authoritative
// re-check — never trust a client-computed discount for money that actually
// gets written to a booking row.

export type PromoCodeType = "percent" | "fixed";

export interface PromoCode {
  /** Matched case-insensitively; store upper-case for display convenience. */
  code: string;
  type: PromoCodeType;
  /** percent: 0-100 off the total. fixed: flat currency amount off. */
  value: number;
  active: boolean;
  /** Optional ISO date (YYYY-MM-DD). Past this date the code is treated as expired. */
  expiresAt?: string;
}

// Seed list — property owners will manage their own via a settings UI later.
export const PROMO_CODES: PromoCode[] = [
  { code: "WELCOME10", type: "percent", value: 10, active: true },
  { code: "STAY300", type: "fixed", value: 300, active: true },
  { code: "SUMMER2025", type: "percent", value: 15, active: true, expiresAt: "2025-09-30" },
  { code: "OLDPROMO", type: "percent", value: 20, active: false },
];

export type PromoValidationResult =
  | { ok: true; promo: PromoCode }
  | { ok: false; message: string };

const INVALID_MESSAGE =
  "รหัสส่วนลดไม่ถูกต้อง / Invalid promo code.";
const EXPIRED_MESSAGE =
  "รหัสส่วนลดหมดอายุหรือไม่สามารถใช้งานได้แล้ว / This promo code has expired or is no longer active.";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Look up and validate a promo code (case-insensitive, trims whitespace).
 * Returns the matched PromoCode on success, or a bilingual TH/EN error
 * message for an unknown / inactive / expired code.
 */
export function validatePromoCode(
  code: string,
  list: PromoCode[] = PROMO_CODES
): PromoValidationResult {
  const normalized = (code || "").trim().toUpperCase();
  if (!normalized) {
    return { ok: false, message: INVALID_MESSAGE };
  }
  const promo = list.find((p) => p.code.toUpperCase() === normalized);
  if (!promo) {
    return { ok: false, message: INVALID_MESSAGE };
  }
  if (!promo.active) {
    return { ok: false, message: EXPIRED_MESSAGE };
  }
  if (promo.expiresAt && promo.expiresAt < todayISO()) {
    return { ok: false, message: EXPIRED_MESSAGE };
  }
  return { ok: true, promo };
}

export interface PromoDiscountResult {
  ok: boolean;
  /** Discount amount actually applied (always >= 0, never more than `total`). */
  discountAmount: number;
  /** total - discountAmount, clamped to a minimum of 0. */
  discountedTotal: number;
  /** Present when `ok` is false — bilingual TH/EN message to show the guest. */
  message?: string;
  /** The matched promo code, when valid. */
  promo?: PromoCode;
}

/**
 * Validate `promoCode` against `list` and compute the discounted total for
 * `total`. Always returns a usable total: on an invalid/expired code
 * `discountedTotal` falls back to the original `total` (no discount applied)
 * and `ok` is false with a message to surface to the guest.
 */
export function applyPromoDiscount(
  total: number,
  promoCode: string,
  list: PromoCode[] = PROMO_CODES
): PromoDiscountResult {
  const safeTotal = Math.max(0, Number(total) || 0);
  const result = validatePromoCode(promoCode, list);
  if (!result.ok) {
    return { ok: false, discountAmount: 0, discountedTotal: safeTotal, message: result.message };
  }
  const { promo } = result;
  const rawDiscount =
    promo.type === "percent" ? (safeTotal * promo.value) / 100 : promo.value;
  const discountAmount = Math.min(safeTotal, Math.max(0, rawDiscount));
  const discountedTotal = Math.max(0, safeTotal - discountAmount);
  return { ok: true, discountAmount, discountedTotal, promo };
}
