"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import { createShift, deleteShift, ShiftInput, ShiftAssignment } from "@/lib/db/operations";

export async function newShift(input: ShiftInput): Promise<ActionResult<ShiftAssignment>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createShift(active.data.property.id, active.data.property.tenant_id, input);
  if (res.ok) revalidatePath("/app/shifts");
  return res;
}

export async function removeShift(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteShift(id);
  if (res.ok) revalidatePath("/app/shifts");
  return res;
}
