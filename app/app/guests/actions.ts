"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";
import {
  searchGuests,
  createGuest,
  updateGuest,
  guestStays,
  Guest,
  GuestInput,
  GuestStays,
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
    if (res.ok) {
      revalidatePath("/app/guests");
      revalidatePath(`/app/guests/${id}`);
    }
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

/**
 * Patch an existing guest by id (used by the inline-editable detail page).
 * updateGuest is RLS-scoped, so the active property isn't needed here.
 */
export async function updateGuestFields(
  id: string,
  patch: Partial<GuestInput>
): Promise<ActionResult<Guest>> {
  const res = await updateGuest(id, patch);
  if (res.ok) {
    revalidatePath("/app/guests");
    revalidatePath(`/app/guests/${id}`);
  }
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

/**
 * Flip the VIP / blacklist flags on a guest by id. updateGuest is RLS-scoped,
 * so the active property isn't needed here.
 */
export async function toggleGuestFlag(
  id: string,
  patch: { is_vip?: boolean; is_blacklisted?: boolean }
): Promise<ActionResult<Guest>> {
  const res = await updateGuest(id, patch);
  if (res.ok) {
    revalidatePath("/app/guests");
    revalidatePath(`/app/guests/${id}`);
  }
  return res;
}

/**
 * Hard-delete a guest. No lib/db helper exists for deletes, so this is an
 * inline RLS-scoped query (the guest's RLS policy already restricts it to the
 * caller's tenant/property). Linked bookings keep their snapshot fields; only
 * the guest_id FK is cleared by the DB.
 */
export async function deleteGuestAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("guests").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/app/guests");
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}

/** Stay-history summary for one guest within the active property. */
export async function guestStaysAction(
  guestId: string
): Promise<ActionResult<GuestStays>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  return guestStays(active.data.property.id, guestId);
}
