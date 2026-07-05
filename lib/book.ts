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

export interface CreateBookingInput {
  propertyId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  phone?: string;
  email?: string;
  adults?: number;
  children?: number;
  // Guest-selected rate plan (guest-facing booking widget). The public
  // create-booking RPC (migration 14) doesn't accept a plan id or a
  // client-supplied total — it always recomputes the total from
  // room_types/daily_rates server-side — so this is threaded through for
  // display/reporting today; making the DB row itself store rate_plan_id
  // and honour the plan price needs `public_create_booking` extended with
  // a `p_rate_plan_id` param (a small migration, out of scope here).
  ratePlanId?: string | null;
  ratePlanName?: string | null;
  // Promo/discount code applied at checkout (lib/promo-codes.ts). Re-validated
  // and re-priced server-side in createPublicBooking — never trust a
  // client-computed discount for money that gets written to the booking row.
  promoCode?: string | null;
  // Display currency for the promo redemption note only (e.g. "THB"). Purely
  // cosmetic — the authoritative discount math never depends on it.
  currency?: string;
}

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

export async function createPublicBooking(
  input: CreateBookingInput
): Promise<{ ok: true; id: string; code: string; total: number } | { ok: false; message: string }> {
  const supabase = createClient();
  // NOTE: input.ratePlanId / ratePlanName are intentionally NOT sent below —
  // the deployed public_create_booking(uuid,uuid,date,date,text,text,text,int,int)
  // signature doesn't have a rate-plan param, and PostgREST rejects RPC calls
  // whose arg names don't match a function overload. Sending them would break
  // every guest booking. They're kept on the input for the caller (the plan
  // choice + plan-priced total already flow through the guest UI end to end;
  // only the DB row's rate_plan_id/total_amount still come from this RPC's
  // own base-price calc until it's extended — see CreateBookingInput above).
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
  const rpcTotal = Number(r.total) || 0;

  // ── promo code (no migration path) ──────────────────────────────────────
  // public_create_booking(...) has a fixed 9-arg signature (see NOTE above) —
  // it doesn't accept a promo code or a client-supplied total, and always
  // writes the full, undiscounted total + its own generic notes ("Web
  // booking..."). Extending the RPC itself would mean a new migration, out of
  // scope for this milestone. Instead — following the exact precedent
  // lib/supabase/admin.ts documents for the public checkout's invoice writes
  // (and app/ical/.../route.ts's read side) — we do a scoped follow-up write
  // through the service-role client: re-validate the promo code server-side
  // (never trust the client's discount math), recompute the discount off the
  // RPC's own authoritative total, and patch ONLY the row we just created
  // (scoped by its own id — never a client-supplied id) so the discounted
  // total and a redemption note land on the real booking row without any new
  // column. Best-effort: if this patch fails for any reason the booking
  // itself has already succeeded, so we swallow the error rather than fail
  // the whole checkout over a promo code.
  let total = rpcTotal;
  if (input.promoCode && input.promoCode.trim()) {
    const discount = applyPromoDiscount(rpcTotal, input.promoCode);
    if (discount.ok && discount.discountAmount > 0) {
      total = discount.discountedTotal;
      try {
        const admin = createAdminClient();
        const { data: existing } = await admin
          .from("bookings")
          .select("notes")
          .eq("id", r.id)
          .single();
        const baseNotes = (existing?.notes as string | null) ?? "";
        const currencyPrefix = input.currency ? `${input.currency} ` : "";
        const promoNote = `Promo: ${discount.promo!.code.toUpperCase()} (-${currencyPrefix}${discount.discountAmount.toLocaleString()})`;
        const notes = baseNotes ? `${baseNotes} · ${promoNote}` : promoNote;
        await admin
          .from("bookings")
          .update({ total_amount: discount.discountedTotal, notes })
          .eq("id", r.id);
      } catch {
        /* best-effort — the booking itself already succeeded */
      }
    }
  }

  return { ok: true, id: r.id, code: r.code, total };
}
