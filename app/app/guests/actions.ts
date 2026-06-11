"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
import {
  searchGuests,
  createGuest,
  updateGuest,
  Guest,
  GuestInput,
} from "@/lib/db/guests";
import { getActiveProperty } from "@/lib/active-property-server";

/**
 * Create or update a guest for the active property. With an `id` → patch;
 * without → create under the active property's tenant.
 */
export async function saveGuest(
  input: GuestInput & { id?: string }
): Promise<ActionResult<Guest>> {
  const { id, ...fields } = input;

  if (id) {
    const res = await updateGuest(id, fields);
    if (res.ok) revalidatePath("/app/guests");
    return res;
  }

  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createGuest(
    active.data.property.id,
    active.data.property.tenant_id,
    fields
  );
  if (res.ok) revalidatePath("/app/guests");
  return res;
}

/** Search guests within the active property (empty q → 50 most recent). */
export async function searchGuestsAction(
  q: string
): Promise<ActionResult<Guest[]>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await searchGuests(active.data.property.id, q);
  if (res.ok) revalidatePath("/app/guests");
  return res;
}
