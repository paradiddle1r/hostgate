"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, ok, mapPgError } from "@/lib/errors";
import {
  createRatePlan,
  updateRatePlan,
  deleteRatePlan,
  listRatePlanRates,
  upsertRatePlanRate,
  RatePlan,
  RatePlanInput,
} from "@/lib/db/rate-plans";
import { getActiveProperty } from "@/lib/active-property-server";
import { createClient } from "@/lib/supabase/server";

/** One per-room-type override carried by the edit form. */
export interface PlanRateEntry {
  room_type_id: string;
  price: number | null; // null = no override (fall back to plan.daily_rate)
}

/**
 * Create or update a rate plan AND its per-room-type override prices.
 * The plan row carries name/daily_rate/color/active/description; each
 * room-type override lands in rate_plan_rates (one row per (plan, type)).
 */
export async function saveRatePlan(
  input: RatePlanInput & { id?: string; rates?: PlanRateEntry[] }
): Promise<ActionResult<RatePlan>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const { property } = active.data;
  const { rates, ...planInput } = input;

  let saved: ActionResult<RatePlan>;
  if (planInput.id) {
    const { id, ...patch } = planInput;
    saved = await updateRatePlan(id, patch);
  } else {
    saved = await createRatePlan(property.id, property.tenant_id, planInput);
  }
  if (!saved.ok) return saved;

  // Persist per-room-type overrides. A null price clears the override.
  if (rates && rates.length) {
    for (const r of rates) {
      if (r.price == null) continue; // leave/clear handled below
      const res = await upsertRatePlanRate(
        property.id,
        property.tenant_id,
        saved.data.id,
        r.room_type_id,
        r.price
      );
      if (!res.ok) return res;
    }
    // Clear overrides the user blanked out (delete the row so it falls back).
    const toClear = rates.filter((r) => r.price == null).map((r) => r.room_type_id);
    if (toClear.length) {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from("rate_plan_rates")
          .delete()
          .eq("rate_plan_id", saved.data.id)
          .in("room_type_id", toClear);
        if (error) throw error;
      } catch (e) {
        return mapPgError(e);
      }
    }
  }

  revalidatePath("/app/rate-plans");
  revalidatePath("/app/calendar");
  return saved;
}

export async function removeRatePlan(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteRatePlan(id);
  if (res.ok) revalidatePath("/app/rate-plans");
  return res;
}

/**
 * Apply a plan to [fromISO, toISO] (inclusive) — PER ROOM TYPE. Each room type
 * gets its rate_plan_rates override if one exists, otherwise the plan's flat
 * daily_rate. Types with neither are skipped (no rate to write).
 *
 * Reimplemented inline (not via lib/db applyPlanToRange, which writes one
 * uniform price to every type) so this — and BulkRateModal's "Apply rate plan"
 * mode, which calls this same action — honours per-room-type pricing.
 */
export async function applyRatePlanAction(
  planId: string,
  fromISO: string,
  toISO: string
): Promise<ActionResult<{ count: number }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const { property } = active.data;

  try {
    const supabase = createClient();

    const [{ data: plan, error: planErr }, ratesRes, { data: types, error: typesErr }] =
      await Promise.all([
        supabase.from("rate_plans").select("id, daily_rate").eq("id", planId).single(),
        listRatePlanRates(planId),
        supabase.from("room_types").select("id").eq("property_id", property.id),
      ]);
    if (planErr) throw planErr;
    if (typesErr) throw typesErr;
    if (!ratesRes.ok) return ratesRes;

    const overrideByType: Record<string, number> = {};
    for (const r of ratesRes.data) overrideByType[r.room_type_id] = r.price;

    const dates = datesInclusive(fromISO, toISO);
    if (dates.length === 0) return ok({ count: 0 });

    const rows: Array<{
      tenant_id: string;
      property_id: string;
      room_type_id: string;
      date: string;
      price: number;
      plan_id: string;
    }> = [];
    for (const t of types ?? []) {
      const rtId = t.id as string;
      const price = overrideByType[rtId] ?? plan.daily_rate;
      if (price == null) continue; // no override + no flat rate → skip this type
      for (const date of dates) {
        rows.push({
          tenant_id: property.tenant_id,
          property_id: property.id,
          room_type_id: rtId,
          date,
          price,
          plan_id: planId,
        });
      }
    }
    if (rows.length === 0) return ok({ count: 0 });

    const { error } = await supabase
      .from("daily_rates")
      .upsert(rows, { onConflict: "room_type_id,date" });
    if (error) throw error;

    revalidatePath("/app/rate-plans");
    revalidatePath("/app/calendar");
    return ok({ count: rows.length });
  } catch (e) {
    return mapPgError(e);
  }
}

/**
 * Rate-calendar feed: daily_rates rows for [fromISO, toISO] (inclusive), used by
 * the month grid. Stays server-side (no client supabase reads) per the security
 * model. Shape: { date, room_type_id, plan_id, price }.
 */
export async function loadRateCalendar(
  fromISO: string,
  toISO: string
): Promise<
  ActionResult<Array<{ date: string; room_type_id: string; plan_id: string | null; price: number }>>
> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("daily_rates")
      .select("date, room_type_id, plan_id, price")
      .eq("property_id", active.data.property.id)
      .gte("date", fromISO)
      .lte("date", toISO);
    if (error) throw error;
    return ok(
      (data ?? []).map((r) => ({
        date: r.date as string,
        room_type_id: r.room_type_id as string,
        plan_id: (r.plan_id as string | null) ?? null,
        price: Number(r.price),
      }))
    );
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
