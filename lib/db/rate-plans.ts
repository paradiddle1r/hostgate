import "server-only";

// Rate plans — named nightly-price presets (Standard / Weekend / High season…)
// a property can apply across a date range. Applying a plan stamps every
// (room_type, date) in the range into daily_rates with the plan's price and
// plan_id, so the calendar shows the plan colour and a later plan-rate edit
// cascades (sync_daily_rates_from_plan trigger).

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";

export interface RatePlan {
  id: string;
  tenant_id: string;
  property_id: string;
  name: string;
  daily_rate: number | null;
  color: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface RatePlanInput {
  name: string;
  daily_rate: number | null;
  color?: string;
  active?: boolean;
}

export async function listRatePlans(propertyId: string): Promise<ActionResult<RatePlan[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("rate_plans")
      .select("*")
      .eq("property_id", propertyId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ok((data ?? []) as RatePlan[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function createRatePlan(
  propertyId: string,
  tenantId: string,
  input: RatePlanInput
): Promise<ActionResult<RatePlan>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("rate_plans")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        name: input.name,
        daily_rate: input.daily_rate,
        color: input.color ?? "#0a84ff",
        active: input.active ?? true,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as RatePlan);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function updateRatePlan(
  id: string,
  patch: Partial<RatePlanInput>
): Promise<ActionResult<RatePlan>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("rate_plans").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as RatePlan);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function deleteRatePlan(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("rate_plans").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}

/** Inclusive list of YYYY-MM-DD dates between two dates. */
function datesInRange(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const start = Date.parse(fromISO + "T00:00:00Z");
  const end = Date.parse(toISO + "T00:00:00Z");
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return out;
  for (let t = start; t <= end; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/**
 * Apply a plan to [fromISO, toISO] (inclusive) for every room type of the
 * property: upserts daily_rates with the plan price + plan_id. Returns how many
 * (room_type × date) cells were written.
 */
export async function applyPlanToRange(
  propertyId: string,
  tenantId: string,
  planId: string,
  fromISO: string,
  toISO: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const supabase = createClient();

    const { data: plan, error: planErr } = await supabase
      .from("rate_plans")
      .select("id, daily_rate")
      .eq("id", planId)
      .single();
    if (planErr) throw planErr;
    if (plan.daily_rate == null) return ok({ count: 0 });

    const { data: types, error: typesErr } = await supabase
      .from("room_types")
      .select("id")
      .eq("property_id", propertyId);
    if (typesErr) throw typesErr;

    const dates = datesInRange(fromISO, toISO);
    const typeIds = (types ?? []).map((t) => t.id as string);
    if (dates.length === 0 || typeIds.length === 0) return ok({ count: 0 });

    const rows = typeIds.flatMap((room_type_id) =>
      dates.map((date) => ({
        tenant_id: tenantId,
        property_id: propertyId,
        room_type_id,
        date,
        price: plan.daily_rate as number,
        plan_id: planId,
      }))
    );

    const { error } = await supabase.from("daily_rates").upsert(rows, { onConflict: "room_type_id,date" });
    if (error) throw error;
    return ok({ count: rows.length });
  } catch (e) {
    return mapPgError(e);
  }
}
