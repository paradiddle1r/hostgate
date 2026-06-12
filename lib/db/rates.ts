import "server-only";

// Data access for per-date rate overrides (daily_rates). The calendar reads a
// nested map of roomTypeId → date → price for a window, and writes a single
// override at a time. Upsert carries tenant_id + property_id (HG-PROP-404 guard).

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";

export interface DailyRate {
  id: string;
  tenant_id: string;
  property_id: string;
  room_type_id: string;
  date: string;
  price: number;
  created_at: string;
}

export type RateMap = Record<string, Record<string, number>>;

/**
 * Nested map of price overrides for the given room types over [fromISO, toISO).
 * Shape: { [roomTypeId]: { [YYYY-MM-DD]: price } }. Missing dates simply absent
 * (callers fall back to the room type's base rate).
 */
export async function rateMap(
  propertyId: string,
  roomTypeIds: string[],
  fromISO: string,
  toISO: string
): Promise<ActionResult<RateMap>> {
  try {
    const out: RateMap = {};
    if (roomTypeIds.length === 0) return ok(out);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("daily_rates")
      .select("room_type_id, date, price")
      .eq("property_id", propertyId)
      .in("room_type_id", roomTypeIds)
      .gte("date", fromISO)
      .lt("date", toISO);
    if (error) throw error;

    for (const r of data ?? []) {
      const rtId = r.room_type_id as string;
      (out[rtId] ??= {})[r.date as string] = Number(r.price);
    }
    return ok(out);
  } catch (e) {
    return mapPgError(e);
  }
}

/**
 * Set (or overwrite) the price override for one room type on one date.
 * Conflict target is the live unique index daily_rates_room_type_id_date_key
 * on (room_type_id, date) — a room type belongs to exactly one property, so
 * that pair is globally unique.
 */
export async function upsertRate(
  propertyId: string,
  tenantId: string,
  roomTypeId: string,
  date: string,
  price: number
): Promise<ActionResult<DailyRate>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("daily_rates")
      .upsert(
        {
          tenant_id: tenantId,
          property_id: propertyId,
          room_type_id: roomTypeId,
          date,
          price,
          // A manual override detaches the date from any rate plan, so a later
          // plan-rate edit won't clobber it via sync_daily_rates_from_plan.
          plan_id: null,
        },
        { onConflict: "room_type_id,date" }
      )
      .select()
      .single();
    if (error) throw error;
    return ok(data as DailyRate);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Inclusive list of YYYY-MM-DD between two dates. */
function datesInclusive(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const start = Date.parse(fromISO + "T00:00:00Z");
  const end = Date.parse(toISO + "T00:00:00Z");
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return out;
  for (let t = start; t <= end; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/**
 * Bulk manual price override for the given room types across [fromISO, toISO]
 * (inclusive). Every written cell gets plan_id=null so it detaches from any
 * rate plan (mirrors upsertRate). Returns how many cells were written.
 */
export async function applyManualRateToRange(
  propertyId: string,
  tenantId: string,
  roomTypeIds: string[],
  fromISO: string,
  toISO: string,
  price: number
): Promise<ActionResult<{ count: number }>> {
  try {
    const dates = datesInclusive(fromISO, toISO);
    if (roomTypeIds.length === 0 || dates.length === 0) return ok({ count: 0 });

    const rows = roomTypeIds.flatMap((room_type_id) =>
      dates.map((date) => ({
        tenant_id: tenantId,
        property_id: propertyId,
        room_type_id,
        date,
        price,
        plan_id: null,
      }))
    );

    const supabase = createClient();
    const { error } = await supabase.from("daily_rates").upsert(rows, { onConflict: "room_type_id,date" });
    if (error) throw error;
    return ok({ count: rows.length });
  } catch (e) {
    return mapPgError(e);
  }
}
