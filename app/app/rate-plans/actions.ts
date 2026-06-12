"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
import {
  createRatePlan,
  updateRatePlan,
  deleteRatePlan,
  applyPlanToRange,
  RatePlan,
  RatePlanInput,
} from "@/lib/db/rate-plans";
import { getActiveProperty } from "@/lib/active-property-server";

export async function saveRatePlan(
  input: RatePlanInput & { id?: string }
): Promise<ActionResult<RatePlan>> {
  if (input.id) {
    const { id, ...patch } = input;
    const res = await updateRatePlan(id, patch);
    if (res.ok) revalidatePath("/app/rate-plans");
    return res;
  }
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createRatePlan(active.data.property.id, active.data.property.tenant_id, input);
  if (res.ok) revalidatePath("/app/rate-plans");
  return res;
}

export async function removeRatePlan(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteRatePlan(id);
  if (res.ok) revalidatePath("/app/rate-plans");
  return res;
}

export async function applyRatePlanAction(
  planId: string,
  fromISO: string,
  toISO: string
): Promise<ActionResult<{ count: number }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await applyPlanToRange(active.data.property.id, active.data.property.tenant_id, planId, fromISO, toISO);
  if (res.ok) {
    revalidatePath("/app/rate-plans");
    revalidatePath("/app/calendar");
  }
  return res;
}
