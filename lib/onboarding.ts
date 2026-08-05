/**
 * Onboarding validation shared by the wizard and `provisionTenant`.
 *
 * The two used to carry their own copies of the same predicate, which is how
 * the original defect got in: the client let an empty rate through and the
 * server never re-checked, so a tenant could be provisioned with
 * `room_types.daily_rate = null` — and the booking engine refuses to sell an
 * unpriced room (HG-BOOK-425), leaving the new owner a booking page that could
 * not take a single booking. One predicate, tested once, used by both.
 */

/** The rate field is a number in the action payload but `""` while typing. */
export interface RateRow {
  name: string;
  rate: number | string | null | undefined;
}

/** Rows the owner actually filled in — blank names are ignored, not errors. */
export function namedRoomTypes<T extends RateRow>(rows: T[]): T[] {
  return rows.filter((r) => (r.name ?? "").trim().length > 0);
}

/**
 * Named rows whose rate is missing, zero, negative, or not a number.
 * `Number("")` is 0 and `Number("abc")` is NaN, and `!(x > 0)` rejects both —
 * writing it as `<= 0` would let NaN through.
 */
export function unpricedRoomTypes<T extends RateRow>(rows: T[]): T[] {
  return namedRoomTypes(rows).filter((r) => !(Number(r.rate) > 0));
}

/**
 * Server-side counterpart. `provisionTenant` persists EVERY row it is given —
 * a blank name is backfilled to "Type N" rather than dropped — so on the
 * server an unnamed row is still a room type that needs a rate. Ignoring
 * unnamed rows here would leave exactly the hole this check exists to close.
 */
export function unpricedProvisionRows<T extends RateRow>(rows: T[]): T[] {
  return rows.filter((r) => !(Number(r.rate) > 0));
}
