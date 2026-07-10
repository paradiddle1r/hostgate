import "server-only";

// Public booking-engine data layer. Guests are anonymous, so every call goes
// through the anon-granted SECURITY DEFINER RPCs (migration 14) — anon has no
// table RLS access. Uses the standard server client; with no auth cookie it
// acts as the `anon` role.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listRatePlans, listRatePlanRates } from "@/lib/db/rate-plans";
import { applyPromoDiscount } from "@/lib/promo-codes";

export interface PublicProperty {
  id: string;
  name: string;
  currency: string;
  city: string | null;
  country: string | null;
}

export interface AvailabilityRow {
  room_type_id: string;
  name: string;
  daily_rate: number | null;
  quantity: number;
  available: number;
}

export async function getPublicProperty(code: string): Promise<PublicProperty | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("public_property_by_code", { p_code: code });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as PublicProperty | null;
}

export async function getAvailability(
  propertyId: string,
  checkIn: string,
  checkOut: string
): Promise<AvailabilityRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("public_availability", {
    p_property: propertyId,
    p_check_in: checkIn,
    p_check_out: checkOut,
  });
  if (error) return [];
  return (data ?? []) as AvailabilityRow[];
}

export async function getQuote(
  propertyId: string,
  roomTypeId: string,
  checkIn: string,
  checkOut: string
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("public_quote", {
    p_property: propertyId,
    p_room_type: roomTypeId,
    p_check_in: checkIn,
    p_check_out: checkOut,
  });
  if (error) return 0;
  return Number(data) || 0;
}

// ── guest-facing rate plans ───────────────────────────────────────────────
// Rate plans are staff data (rate_plans / rate_plan_rates are RLS-locked to
// `authenticated`), so listRatePlans/listRatePlanRates return an empty list
// for the anonymous `anon` role the public booking flow runs as. We still
// call them here (rather than duplicate the query) so this picks up
// automatically if that RLS is ever opened to anon/a public RPC — until
// then a property with no visible plans just falls back to its single base
// price, i.e. today's behaviour.
export interface PublicRatePlan {
  id: string;
  name: string;
  color: string;
  description: string | null;
  daily_rate: number | null;
}

export async function getPublicRatePlans(
  propertyId: string
): Promise<{ plans: PublicRatePlan[]; overridesByPlan: Record<string, Record<string, number>> }> {
  const plansRes = await listRatePlans(propertyId);
  if (!plansRes.ok) return { plans: [], overridesByPlan: {} };
  const active = plansRes.data.filter((p) => p.active);

  const overridesByPlan: Record<string, Record<string, number>> = {};
  await Promise.all(
    active.map(async (p) => {
      const ratesRes = await listRatePlanRates(p.id);
      const overrides: Record<string, number> = {};
      if (ratesRes.ok) {
        for (const r of ratesRes.data) overrides[r.room_type_id] = Number(r.price);
      }
      overridesByPlan[p.id] = overrides;
    })
  );

  return {
    plans: active.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      description: p.description,
      daily_rate: p.daily_rate,
    })),
    overridesByPlan,
  };
}

/**
 * Nightly price a plan quotes for a room type: its per-room-type override
 * (rate_plan_rates) → else the plan's flat daily_rate → else the room
 * type's own base price.
 */
export function planNightlyPrice(
  plan: PublicRatePlan,
  roomTypeId: string,
  overridesByPlan: Record<string, Record<string, number>>,
  baseNightly: number
): number {
  const override = overridesByPlan[plan.id]?.[roomTypeId];
  if (override != null) return override;
  if (plan.daily_rate != null) return Number(plan.daily_rate);
  return baseNightly;
}

// ── multi-item cart checkout (milestone m1) ─────────────────────────────────
// A cart line is IDENTIFIERS ONLY (room_type_id, rate-plan id, quantity) —
// see lib/book-cart.ts. Every price below is derived server-side from
// getAvailability/getQuote/getPublicRatePlans, never trusted from the client.

export interface CartLineItemInput {
  roomTypeId: string;
  // Display-only — used for the itemized summary + confirmation page, never
  // for money. The authoritative name comes from getAvailability() at
  // checkout-recompute time; this is just what the guest actually saw there.
  roomTypeName?: string;
  qty: number;
  // Guest-selected rate plan (guest-facing booking widget). The public
  // create-booking RPC (migration 14) doesn't accept a plan id or a
  // client-supplied total — it always recomputes the total from
  // room_types/daily_rates server-side — so this is threaded through for
  // display/reporting today; making the DB row itself store rate_plan_id
  // and honour the plan price needs `public_create_booking` extended with
  // a `p_rate_plan_id` param (a small migration, out of scope here).
  ratePlanId?: string | null;
  ratePlanName?: string | null;
}

export interface CreateCartBookingInput {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  phone?: string;
  email?: string;
  adults?: number;
  children?: number;
  items: CartLineItemInput[];
  // Promo/discount code applied at checkout (lib/promo-codes.ts). Re-validated
  // and re-priced server-side against the cart's grand total — never trust a
  // client-computed discount for money that gets written to the booking rows.
  promoCode?: string | null;
  // Display currency for the promo redemption note only (e.g. "THB"). Purely
  // cosmetic — the authoritative discount math never depends on it.
  currency?: string;
}

export interface CartBookingResultItem {
  roomTypeId: string;
  roomTypeName: string;
  ratePlanName?: string | null;
  qty: number;
  /** One booking code per room unit created for this line. */
  bookingCodes: string[];
  /** This line's total across its qty, after any promo discount share. */
  total: number;
}

export type CreateCartBookingResult =
  | { ok: true; items: CartBookingResultItem[]; total: number; bookingCodes: string[] }
  | { ok: false; message: string };

// ── guest self-service: manage my booking (migration 20) ───────────────────
// Anon has no table RLS access, so lookup/cancel go through the same
// SECURITY DEFINER RPC pattern as the rest of this file. Both require
// booking_code AND guest email to match — never look a booking up by code
// alone (that would let anyone enumerate other guests' stays).

export interface PublicBookingDetails {
  id: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  roomTypeName: string;
  totalAmount: number;
  currency: string;
  nights: number;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = Date.parse(checkOut + "T00:00:00Z") - Date.parse(checkIn + "T00:00:00Z");
  return Math.max(1, Math.round(ms / 86_400_000));
}

/** Look up a guest's own booking. Returns null unless code+email BOTH match. */
export async function lookupPublicBooking(
  propertyId: string,
  code: string,
  email: string
): Promise<PublicBookingDetails | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("public_lookup_booking", {
    p_property: propertyId,
    p_code: code,
    p_email: email,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const checkIn = row.check_in as string;
  const checkOut = row.check_out as string;
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    checkIn,
    checkOut,
    roomTypeName: row.room_type_name ?? "Room",
    totalAmount: Number(row.total_amount) || 0,
    currency: row.currency,
    nights: nightsBetween(checkIn, checkOut),
  };
}

export interface GuestBookingHistoryItem {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  roomTypeName: string;
}

/**
 * A guest's OTHER bookings (past + upcoming) at this same property, shown on
 * the manage-booking page below the booking they just looked up.
 *
 * IMPORTANT — email alone is NOT proof of ownership: this function (and the
 * public_guest_booking_history RPC it calls, migration 23) accepts only an
 * email, not a booking code, so it must NEVER be called directly off a bare
 * client-supplied email. The caller (getGuestBookingHistoryAction in
 * app/book/actions.ts) is responsible for re-running lookupPublicBooking()
 * with a matching code+email FIRST — the same proof gate every other guest
 * self-service action in this file requires — and only calling this once
 * that succeeds. The RPC also never returns a booking `code`, so this list
 * itself can't be used to harvest a code that would unlock full detail /
 * cancel via lookupPublicBooking / cancelPublicBookingRpc.
 * excludeBookingId omits the booking just looked up so it isn't duplicated.
 */
export async function getGuestBookingHistory(
  propertyId: string,
  email: string,
  excludeBookingId?: string
): Promise<GuestBookingHistoryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("public_guest_booking_history", {
    p_property: propertyId,
    p_email: email,
    p_exclude_id: excludeBookingId ?? null,
  });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    status: row.status as string,
    checkIn: row.check_in as string,
    checkOut: row.check_out as string,
    roomTypeName: (row.room_type_name as string) ?? "Room",
  }));
}

export interface ReturningGuestInfo {
  name: string;
}

/**
 * Returning-guest recognition for the checkout form (migration 22). Requires
 * BOTH an exact email AND phone match against an existing `guests` row
 * scoped to this property — matching on either field alone would let a
 * stranger who merely guesses/knows someone's email leak their name. Returns
 * ONLY the guest's name (nothing else — no id, no booking history) so the
 * client can auto-fill an empty name field and show a "welcome back" note.
 * No match (or either field blank) → null, silently — never an error.
 */
export async function lookupReturningGuest(
  propertyId: string,
  email: string,
  phone: string
): Promise<ReturningGuestInfo | null> {
  if (!email.trim() || !phone.trim()) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("public_lookup_guest", {
    p_property: propertyId,
    p_email: email,
    p_phone: phone,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.full_name) return null;
  return { name: row.full_name as string };
}

// ── guest self-service: post-stay review (roadmap m1, DB-free) ─────────────
// No `reviews` table exists yet (no migration in this milestone), so a
// submitted review is emailed straight to the property owner rather than
// persisted — see app/book/[code]/review/[bookingId]/actions.ts. Both
// lookups below go through the service-role client: the review link's
// signed token (verifyPostStayReviewRequestToken, lib/guest-session.ts) is
// the proof of ownership here, not a client-supplied email, so there is no
// anon-safe RPC to reuse the way the rest of this file does.

export interface PublicBookingForReview {
  id: string;
  code: string;
  guestName: string;
  status: string;
  checkIn: string;
  checkOut: string;
  roomTypeName: string;
  propertyName: string;
  tenantId: string;
}

/**
 * Look up a booking for the post-stay review page/action. Scoped by BOTH id
 * and code (matching the pair the signed token already committed to) so
 * this can never be used to fetch an arbitrary booking off a bare id.
 * Callers MUST verify the token before calling this.
 */
export async function getBookingForReview(
  bookingId: string,
  code: string
): Promise<PublicBookingForReview | null> {
  const id = (bookingId || "").trim();
  const trimmedCode = (code || "").trim();
  if (!id || !trimmedCode) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("id, code, guest_name, status, check_in, check_out, tenant_id, room_types(name), properties(name)")
    .eq("id", id)
    .eq("code", trimmedCode)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as {
    id: string;
    code: string;
    guest_name: string;
    status: string;
    check_in: string;
    check_out: string;
    tenant_id: string;
    room_types: { name: string } | null;
    properties: { name: string } | null;
  };
  return {
    id: row.id,
    code: row.code,
    guestName: row.guest_name,
    status: row.status,
    checkIn: row.check_in,
    checkOut: row.check_out,
    roomTypeName: row.room_types?.name ?? "Room",
    propertyName: row.properties?.name ?? "",
    tenantId: row.tenant_id,
  };
}

/**
 * The email address to notify with a guest-submitted review: the tenant's
 * `owner` member if one exists, else any member. Reads auth.users via the
 * admin auth API (tenant_members carries no email column itself). Returns
 * null (never throws) if the tenant has no members or the lookup fails —
 * callers must treat that as "review can't be delivered right now".
 */
export async function getTenantOwnerEmail(tenantId: string): Promise<string | null> {
  const id = (tenantId || "").trim();
  if (!id) return null;
  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  let userId = (owner as { user_id: string } | null)?.user_id ?? null;
  if (!userId) {
    const { data: anyMember } = await admin
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", id)
      .limit(1)
      .maybeSingle();
    userId = (anyMember as { user_id: string } | null)?.user_id ?? null;
  }
  if (!userId) return null;

  const { data: userRes, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userRes?.user?.email) return null;
  return userRes.user.email;
}

/** Cancel a guest's own booking. Server re-verifies code+email before cancelling. */
export async function cancelPublicBookingRpc(
  propertyId: string,
  code: string,
  email: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("public_cancel_booking", {
    p_property: propertyId,
    p_code: code,
    p_email: email,
  });
  if (error) {
    const m = error.message || "Cancel failed";
    const clean = m.replace(/^.*?(HG-[A-Z]+-\d{3}:\s*)/, "$1");
    return { ok: false, message: clean };
  }
  return { ok: true };
}

/** Create exactly ONE booking row via public_create_booking (the RPC always
 * creates one row per call — a cart line with qty N calls this N times). No
 * promo math here — that's applied once, on the cart's grand total, by
 * createPublicBookingCart below. */
async function createOneBookingUnit(
  supabase: ReturnType<typeof createClient>,
  input: {
    propertyId: string;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    guestName: string;
    phone?: string;
    email?: string;
    adults?: number;
    children?: number;
  }
): Promise<{ ok: true; id: string; code: string; total: number } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("public_create_booking", {
    p_property: input.propertyId,
    p_room_type: input.roomTypeId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_guest_name: input.guestName,
    p_phone: input.phone ?? null,
    p_email: input.email ?? null,
    p_adults: input.adults ?? 1,
    p_children: input.children ?? 0,
  });
  if (error) {
    const m = error.message || "Booking failed";
    const clean = m.replace(/^.*?(HG-[A-Z]+-\d{3}:\s*)/, "$1");
    return { ok: false, message: clean };
  }
  const r = data as { id: string; code: string; total: number };
  return { ok: true, id: r.id, code: r.code, total: Number(r.total) || 0 };
}

/** Best-effort rollback: cancel the bookings created earlier in THIS SAME
 * cart submission, scoped strictly by their own ids (never a client-supplied
 * id — same scoping discipline as the promo patch below). Used when a later
 * item in the cart fails (e.g. HG-BOOK-409 because someone else booked that
 * room type in the meantime) so the guest never ends up with a silent
 * partial booking — either the whole cart is booked, or none of it is. */
async function rollbackBookingUnits(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.from("bookings").update({ status: "cancelled" }).in("id", ids);
  } catch {
    /* best-effort — the failure is already surfaced to the guest via the
       ok:false result; a booking row stuck as 'pending' is still visible
       and cancellable by staff even if this cleanup write fails. */
  }
}

/**
 * Create every line item of a guest's cart as one coherent operation, for a
 * shared check_in/check_out date range. Creates bookings sequentially (one
 * row per unit of quantity); if any unit fails partway through, everything
 * already created in this submission is rolled back (cancelled) so the
 * confirmation page can never show a partial cart as a full success.
 */
export async function createPublicBookingCart(
  input: CreateCartBookingInput
): Promise<CreateCartBookingResult> {
  const supabase = createClient();
  const createdIds: string[] = [];
  const createdRows: {
    id: string;
    code: string;
    rpcTotal: number;
    roomTypeId: string;
    roomTypeName: string;
    ratePlanName?: string | null;
  }[] = [];

  for (const item of input.items) {
    const qty = Math.max(1, Math.min(50, Math.round(item.qty) || 0));
    for (let i = 0; i < qty; i++) {
      const res = await createOneBookingUnit(supabase, {
        propertyId: input.propertyId,
        roomTypeId: item.roomTypeId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guestName: input.guestName,
        phone: input.phone,
        email: input.email,
        adults: input.adults,
        children: input.children,
      });
      if (!res.ok) {
        await rollbackBookingUnits(createdIds);
        return {
          ok: false,
          message:
            createdIds.length > 0
              ? `${res.message} — รายการอื่นในตะกร้าถูกยกเลิกแล้ว ยังไม่มีการจองใดสำเร็จ / the rest of the cart was rolled back, nothing was booked.`
              : res.message,
        };
      }
      createdIds.push(res.id);
      createdRows.push({
        id: res.id,
        code: res.code,
        rpcTotal: res.total,
        roomTypeId: item.roomTypeId,
        roomTypeName: item.roomTypeName || "Room",
        ratePlanName: item.ratePlanName ?? null,
      });
    }
  }

  const grandRpcTotal = createdRows.reduce((sum, row) => sum + row.rpcTotal, 0);

  // ── promo code (no migration path) — see the original single-item note
  // this replaces: public_create_booking(...) has a fixed 9-arg signature,
  // doesn't accept a promo code, and always writes the full undiscounted
  // total. Applied ONCE here on the cart's grand total (never per-row — a
  // fixed-amount code must not be multiplied by cart size), then the
  // discount is distributed across the created rows proportionally to each
  // row's own share of the grand total, through the same scoped
  // service-role follow-up write pattern (each update scoped by its own
  // freshly-created id). Best-effort: if this patch fails the bookings
  // themselves have already succeeded, so we swallow the error rather than
  // fail the whole checkout over a promo code.
  let grandTotal = grandRpcTotal;
  if (input.promoCode && input.promoCode.trim() && createdRows.length > 0) {
    const discount = applyPromoDiscount(grandRpcTotal, input.promoCode);
    if (discount.ok && discount.discountAmount > 0) {
      grandTotal = discount.discountedTotal;
      try {
        const admin = createAdminClient();
        const currencyPrefix = input.currency ? `${input.currency} ` : "";
        const promoNote = `Promo: ${discount.promo!.code.toUpperCase()} (-${currencyPrefix}${discount.discountAmount.toLocaleString()})`;
        let allocated = 0;
        for (let i = 0; i < createdRows.length; i++) {
          const row = createdRows[i];
          const isLast = i === createdRows.length - 1;
          const share = grandRpcTotal > 0 ? row.rpcTotal / grandRpcTotal : 0;
          const rowDiscount = isLast
            ? Math.round((discount.discountAmount - allocated) * 100) / 100
            : Math.round(discount.discountAmount * share * 100) / 100;
          allocated += rowDiscount;
          const rowTotal = Math.max(0, row.rpcTotal - rowDiscount);
          const { data: existing } = await admin
            .from("bookings")
            .select("notes")
            .eq("id", row.id)
            .single();
          const baseNotes = (existing?.notes as string | null) ?? "";
          const notes = baseNotes ? `${baseNotes} · ${promoNote}` : promoNote;
          await admin.from("bookings").update({ total_amount: rowTotal, notes }).eq("id", row.id);
          row.rpcTotal = rowTotal; // reflect the discounted amount in the returned summary
        }
      } catch {
        /* best-effort — the bookings themselves already succeeded */
      }
    }
  }

  // Group the created rows back into itemized cart lines (by room type +
  // rate plan) for the checkout/confirmation UI.
  const byKey = new Map<string, CartBookingResultItem>();
  for (const row of createdRows) {
    const key = `${row.roomTypeId}::${row.ratePlanName ?? ""}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.qty += 1;
      existing.bookingCodes.push(row.code);
      existing.total += row.rpcTotal;
    } else {
      byKey.set(key, {
        roomTypeId: row.roomTypeId,
        roomTypeName: row.roomTypeName,
        ratePlanName: row.ratePlanName,
        qty: 1,
        bookingCodes: [row.code],
        total: row.rpcTotal,
      });
    }
  }

  return {
    ok: true,
    items: Array.from(byKey.values()),
    total: grandTotal,
    bookingCodes: createdRows.map((row) => row.code),
  };
}
