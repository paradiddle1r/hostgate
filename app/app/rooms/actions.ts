"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, ok, mapPgError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { bulkCreateRooms, updateRoom, deleteRoom, NewRoomRow, Room } from "@/lib/db/rooms";
import { getActiveProperty } from "@/lib/active-property-server";

/** Save a batch of generated rooms (with their assigned types) for the active property. */
export async function saveRooms(rows: NewRoomRow[]): Promise<ActionResult<{ count: number }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await bulkCreateRooms(active.data.property.id, active.data.property.tenant_id, rows);
  if (res.ok) revalidatePath("/app/rooms");
  return res;
}

export async function updateRoomAction(
  id: string,
  // monthly_available added (parity): updateRoom (lib/db) already accepts the
  // whole Partial<Room> patch, so widening this type here is enough.
  patch: Partial<Pick<Room, "number" | "floor" | "room_type_id" | "status" | "monthly_available">>
): Promise<ActionResult<Room>> {
  const res = await updateRoom(id, patch);
  if (res.ok) revalidatePath("/app/rooms");
  return res;
}

export async function deleteRoomAction(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteRoom(id);
  if (res.ok) revalidatePath("/app/rooms");
  return res;
}

/**
 * Add a single room to the active property. Written as an inline insert (not
 * via lib/db's bulkCreateRooms) because we need to carry `monthly_available`,
 * which that helper doesn't expose. tenant_id + property_id both come from the
 * active property so the assert_property_in_tenant() trigger is satisfied.
 */
export async function addRoomAction(input: {
  number: string;
  floor: number;
  room_type_id: string | null;
  monthly_available: boolean;
}): Promise<ActionResult<Room>> {
  try {
    const active = await getActiveProperty();
    if (!active.ok) return active;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        tenant_id: active.data.property.tenant_id,
        property_id: active.data.property.id,
        number: input.number.trim(),
        floor: input.floor,
        room_type_id: input.room_type_id,
        monthly_available: input.monthly_available,
      })
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/app/rooms");
    return ok(data as Room);
  } catch (e) {
    return mapPgError(e);
  }
}
