// Direct-Booking Upsells epic — milestone m1.
//
// Pure, DB-free seed list, same precedent as lib/promo-codes.ts: no migration,
// no table — this exported array IS the source of truth for now. Property
// owners will eventually manage their own add-ons via a settings UI (a later
// milestone, mirroring how promo codes are meant to grow); until then this
// module is what both the POS "Bookable add-on" toggle (m1,
// components/app/pos/ProductsClient.tsx) and the public booking widget cart
// (m2, components/book/*) import.
//
// An add-on is matched to an existing pos_products row by NAME (case-
// insensitive substring against `matchNames`), never by a DB foreign key —
// there is no schema change in this milestone. `key` is the stable identifier
// the public cart / Stripe Checkout line items (m2) will reference, so it
// must never be renamed once shipped.
//
// Kept framework-agnostic (no "server-only") so it can be imported from a
// client component (ProductsClient's toggle, the future public cart) as well
// as server code (a future app/book/actions.ts add-on re-check), exactly like
// lib/promo-codes.ts.

export interface BookableAddonText {
  th: string;
  en: string;
}

export interface BookableAddon {
  /** Stable id — referenced by the public cart / Stripe line items in m2. Never rename once shipped. */
  id: string;
  name: BookableAddonText;
  description: BookableAddonText;
  /** Fallback price in the property's currency, used only when no matching POS product is found. */
  price: number;
  /**
   * Case-insensitive substring match against pos_products.name, used to
   * auto-suggest which POS product this add-on corresponds to. Not a DB FK —
   * no migration, no pos_products schema change.
   */
  matchNames: string[];
  /**
   * Whether this add-on is currently offered as a bookable extra. Toggled
   * from ProductsClient. m1 keeps this purely client-side/local (component
   * state seeded from this array) — no per-tenant DB persistence yet; that is
   * left for a later milestone once a real table exists.
   */
  active: boolean;
}

// Seed list — property owners will manage their own via a settings UI later,
// same as PROMO_CODES.
export const BOOKABLE_ADDONS: BookableAddon[] = [
  {
    id: "breakfast",
    name: { th: "อาหารเช้า", en: "Breakfast" },
    description: {
      th: "อาหารเช้าต่อผู้เข้าพักหนึ่งคนต่อวัน",
      en: "Breakfast per guest, per day.",
    },
    price: 150,
    matchNames: ["breakfast", "อาหารเช้า"],
    active: true,
  },
  {
    id: "airport_transfer",
    name: { th: "รถรับส่งสนามบิน", en: "Airport transfer" },
    description: {
      th: "บริการรถรับ-ส่งระหว่างสนามบินกับที่พัก (เที่ยวเดียว)",
      en: "One-way transfer between the airport and the property.",
    },
    price: 500,
    matchNames: ["airport transfer", "airport pickup", "รถรับส่งสนามบิน", "รับส่งสนามบิน"],
    active: true,
  },
  {
    id: "late_checkout",
    name: { th: "เช็คเอาต์ล่าช้า", en: "Late checkout" },
    description: {
      th: "ขยายเวลาเช็คเอาต์ถึง 14:00 น. (ขึ้นอยู่กับห้องว่าง)",
      en: "Extend checkout to 2 PM, subject to availability.",
    },
    price: 300,
    matchNames: ["late checkout", "late check-out", "เช็คเอาต์ล่าช้า", "เช็คเอาท์ล่าช้า"],
    active: true,
  },
];

export type BookableAddonValidationResult =
  | { ok: true; addon: BookableAddon }
  | { ok: false; message: string };

const NOT_FOUND_MESSAGE = "ไม่พบบริการเสริมนี้ / Add-on not found.";
const INACTIVE_MESSAGE = "บริการเสริมนี้ไม่พร้อมให้บริการในขณะนี้ / This add-on is not currently offered.";

/**
 * Look up and validate a bookable add-on by its stable `id` (case-insensitive,
 * trims whitespace). Mirrors validatePromoCode's shape/behaviour so callers
 * (m2's cart/checkout) can follow the same pattern.
 */
export function validateBookableAddon(
  id: string,
  list: BookableAddon[] = BOOKABLE_ADDONS
): BookableAddonValidationResult {
  const normalized = (id || "").trim().toLowerCase();
  if (!normalized) {
    return { ok: false, message: NOT_FOUND_MESSAGE };
  }
  const addon = list.find((a) => a.id.toLowerCase() === normalized);
  if (!addon) {
    return { ok: false, message: NOT_FOUND_MESSAGE };
  }
  if (!addon.active) {
    return { ok: false, message: INACTIVE_MESSAGE };
  }
  return { ok: true, addon };
}

/**
 * Find the add-on (if any) a POS product name corresponds to, by
 * case-insensitive substring match against each add-on's `matchNames`. Used
 * by ProductsClient to decide which product rows get the "Bookable add-on"
 * toggle.
 */
export function findAddonForProductName(
  productName: string,
  list: BookableAddon[] = BOOKABLE_ADDONS
): BookableAddon | undefined {
  const normalized = (productName || "").trim().toLowerCase();
  if (!normalized) return undefined;
  return list.find((addon) =>
    addon.matchNames.some((m) => normalized.includes(m.toLowerCase()))
  );
}

/**
 * Return a new list with the given add-on's `active` flag flipped. Pure /
 * immutable (never mutates `list`) so it's safe to call from client state:
 * `setAddons((prev) => toggleBookableAddon(id, prev))`. Unknown ids return
 * `list` unchanged.
 */
export function toggleBookableAddon(
  id: string,
  list: BookableAddon[] = BOOKABLE_ADDONS
): BookableAddon[] {
  const normalized = (id || "").trim().toLowerCase();
  return list.map((a) => (a.id.toLowerCase() === normalized ? { ...a, active: !a.active } : a));
}

/**
 * The add-ons a guest should actually see in the public booking widget cart
 * (m2) — active ones only. Exported now so m2 can import it directly without
 * re-deriving the filter.
 */
export function listActiveBookableAddons(list: BookableAddon[] = BOOKABLE_ADDONS): BookableAddon[] {
  return list.filter((a) => a.active);
}
