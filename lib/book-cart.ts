// Public booking-widget cart — shared by RoomsClient (adds lines, persists
// them across the rooms page) and the checkout page (decodes them from the
// URL to recompute money server-side).
//
// IMPORTANT: a cart line carries IDENTIFIERS ONLY (room_type_id, rate-plan
// id, quantity) — never a price. The checkout page is a server component and
// always re-derives every amount from getAvailability/getQuote/
// getPublicRatePlans (see app/book/[code]/checkout/page.tsx), exactly like
// the original single-item flow did. Client-held totals in this file (e.g.
// on the cart summary bar) are display-only estimates, never trusted for
// money.
//
// No "server-only" here — this module is imported by both the client
// RoomsClient/CheckoutForm and (for the pure encode/decode helpers) the
// server checkout page.

export interface CartLineItem {
  roomTypeId: string;
  planId: string | null;
  qty: number;
}

export interface StoredCart {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  items: CartLineItem[];
}

const MAX_QTY_PER_LINE = 50;

function cartStorageKey(propertyCode: string): string {
  return `hg_book_cart_${propertyCode}`;
}

/** Load the guest's in-progress cart for this property from sessionStorage.
 * Returns null on the server, when nothing is stored, or on any parse error. */
export function loadCart(propertyCode: string): StoredCart | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cartStorageKey(propertyCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed as StoredCart;
  } catch {
    return null;
  }
}

export function saveCart(propertyCode: string, cart: StoredCart): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(cartStorageKey(propertyCode), JSON.stringify(cart));
  } catch {
    /* best-effort — worst case the cart just doesn't survive a reload */
  }
}

export function clearCart(propertyCode: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(cartStorageKey(propertyCode));
  } catch {
    /* best-effort */
  }
}

/** Encode one cart line as a compact `roomTypeId:planId:qty` token for a URL
 * query string — identifiers + quantity only, never a price. */
export function encodeCartItem(item: CartLineItem): string {
  return `${item.roomTypeId}:${item.planId ?? ""}:${item.qty}`;
}

export function decodeCartItem(token: string): CartLineItem | null {
  const parts = token.split(":");
  if (parts.length < 3) return null;
  const roomTypeId = parts[0];
  const planId = parts[1];
  const qtyRaw = parts.slice(2).join(":"); // tolerate stray ':' in the qty tail
  const qty = Math.max(1, Math.min(MAX_QTY_PER_LINE, Math.round(Number(qtyRaw)) || 0));
  if (!roomTypeId || qty <= 0) return null;
  return { roomTypeId, planId: planId ? planId : null, qty };
}

export function decodeCartItems(tokens: string[]): CartLineItem[] {
  return tokens.map(decodeCartItem).filter((x): x is CartLineItem => x !== null);
}

/** Build the checkout URL for a whole cart — shared dates + one repeated
 * `item` param per line (Next.js exposes repeated query keys as an array in
 * searchParams). */
export function buildCheckoutUrl(
  code: string,
  cart: { checkIn: string; checkOut: string; adults: number; children: number; items: CartLineItem[] }
): string {
  const qs = new URLSearchParams({
    check_in: cart.checkIn,
    check_out: cart.checkOut,
    adults: String(cart.adults),
    children: String(cart.children),
  });
  for (const item of cart.items) qs.append("item", encodeCartItem(item));
  return `/book/${code}/checkout?${qs.toString()}`;
}

export function emptyCart(checkIn: string, checkOut: string, adults: number, children: number): StoredCart {
  return { checkIn, checkOut, adults, children, items: [] };
}

/** Merge a new line into a cart — same room type + plan sums quantities
 * (capped at MAX_QTY_PER_LINE), otherwise it's appended as a new line. */
export function addCartLine(cart: StoredCart, line: CartLineItem): StoredCart {
  const items = cart.items.slice();
  const idx = items.findIndex((i) => i.roomTypeId === line.roomTypeId && i.planId === line.planId);
  if (idx >= 0) {
    items[idx] = { ...items[idx], qty: Math.min(MAX_QTY_PER_LINE, items[idx].qty + line.qty) };
  } else {
    items.push(line);
  }
  return { ...cart, items };
}

export function removeCartLine(cart: StoredCart, roomTypeId: string, planId: string | null): StoredCart {
  return { ...cart, items: cart.items.filter((i) => !(i.roomTypeId === roomTypeId && i.planId === planId)) };
}

export function cartItemCount(cart: StoredCart): number {
  return cart.items.reduce((sum, i) => sum + i.qty, 0);
}
