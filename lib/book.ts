import "server-only";

// Public booking-engine data layer. Guests are anonymous, so every call goes
// through the anon-granted SECURITY DEFINER RPCs (migration 14) — anon has no
// table RLS access. Uses the standard server client; with no auth cookie it
// acts as the `anon` role.

import { createClient } from "@/lib/supabase/server";
import { listRatePlans, listRatePlanRates } from "@/lib/db/rate-plans";

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
  return { ok: true, id: r.id, code: r.code, total: Number(r.total) || 0 };
}
