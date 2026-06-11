"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
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
  patch: Partial<Pick<Room, "number" | "floor" | "room_type_id" | "status">>
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
