"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import {
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  MaintenanceInput,
  MaintenanceOrder,
} from "@/lib/db/operations";

export async function newMaintenance(input: MaintenanceInput): Promise<ActionResult<MaintenanceOrder>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createMaintenance(active.data.property.id, active.data.property.tenant_id, input);
  if (res.ok) revalidatePath("/app/maintenance");
  return res;
}

export async function saveMaintenance(
  id: string,
  patch: Partial<MaintenanceInput>
): Promise<ActionResult<MaintenanceOrder>> {
  const res = await updateMaintenance(id, patch);
  if (res.ok) revalidatePath("/app/maintenance");
  return res;
}

export async function removeMaintenance(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteMaintenance(id);
  if (res.ok) revalidatePath("/app/maintenance");
  return res;
}
