"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, fail } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { getActiveProperty } from "@/lib/active-property-server";
import {
  createHousekeepingTask,
  setHousekeepingStatus,
  updateHousekeepingTask,
  deleteHousekeepingTask,
  HousekeepingInput,
  HousekeepingStatus,
  HousekeepingTask,
} from "@/lib/db/operations";

async function uid(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function newHousekeepingTask(input: HousekeepingInput): Promise<ActionResult<HousekeepingTask>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createHousekeepingTask(active.data.property.id, active.data.property.tenant_id, input);
  if (res.ok) revalidatePath("/app/housekeeping");
  return res;
}

export async function setTaskStatus(id: string, status: HousekeepingStatus): Promise<ActionResult<HousekeepingTask>> {
  const res = await setHousekeepingStatus(id, status, await uid());
  if (res.ok) revalidatePath("/app/housekeeping");
  return res;
}

export async function assignTaskToMe(id: string): Promise<ActionResult<HousekeepingTask>> {
  const me = await uid();
  if (!me) return fail("HG-AUTH-401", "You are not signed in.");
  const res = await updateHousekeepingTask(id, { assigned_to: me });
  if (res.ok) revalidatePath("/app/housekeeping");
  return res;
}

export async function patchTask(
  id: string,
  patch: {
    priority?: HousekeepingTask["priority"];
    notes?: string | null;
    assigned_to?: string | null;
    task_type?: HousekeepingTask["task_type"];
    due_date?: string;
  }
): Promise<ActionResult<HousekeepingTask>> {
  const res = await updateHousekeepingTask(id, patch);
  if (res.ok) revalidatePath("/app/housekeeping");
  return res;
}

export async function removeTask(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteHousekeepingTask(id);
  if (res.ok) revalidatePath("/app/housekeeping");
  return res;
}
