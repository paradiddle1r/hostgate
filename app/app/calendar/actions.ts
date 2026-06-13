"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, ok } from "@/lib/errors";
import {
  createBooking,
  updateBooking,
  setBookingStatus,
  listBookings,
  BookingInput,
  Booking,
  BookingStatus,
} from "@/lib/db/bookings";
import { listRooms } from "@/lib/db/rooms";
import { applyManualRateToRange } from "@/lib/db/rates";
import { getActiveProperty } from "@/lib/active-property-server";

/**
 * Bookings overlapping a [from, to) window for the active property. Used by the
 * BookingModal room picker to hide rooms already occupied during the chosen
 * stay. Tenant-scoped via getActiveProperty(); reuses the existing
 * listBookings() reader (window-overlap + tenant RLS handled there).
 */
export async function bookingsInRangeAction(
  fromISO: string,
  toISO: string
): Promise<ActionResult<Booking[]>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  return listBookings(active.data.property.id, fromISO, toISO);
}

/** Apply a flat manual nightly price to room types across a date range. */
export async function bulkManualRateAction(
  roomTypeIds: string[],
  fromISO: string,
  toISO: string,
  price: number
): Promise<ActionResult<{ count: number }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await applyManualRateToRange(
    active.data.property.id,
    active.data.property.tenant_id,
    roomTypeIds,
    fromISO,
    toISO,
    price
  );
  if (res.ok) revalidatePath("/app/calendar");
  return res;
}

export async function createBookingAction(input: BookingInput): Promise<ActionResult<Booking>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createBooking(active.data.property.id, active.data.property.tenant_id, input);
  if (res.ok) revalidatePath("/app/calendar");
  return res;
}

/**
 * Multi-room booking: insert the primary booking plus one booking per extra
 * room, ALL sharing a freshly-minted booking_group_id (shared lease). Each row
 * carries its own room_id + room_type_id but the same guest / dates / financial
 * fields as the primary input. Mirrors hotel-pms's "extra rooms" chip picker.
 * Returns the number of booking rows created.
 */
export async function createMultiRoomBooking(
  primaryInput: BookingInput,
  extraRoomIds: string[]
): Promise<ActionResult<{ count: number }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const { id: propertyId, tenant_id: tenantId } = active.data.property;

  // One shared lease id across the primary row and every extra room.
  const groupId = crypto.randomUUID();

  // Resolve each extra room's room_type_id so per-room booking rows are
  // self-consistent (rate/type may differ from the primary room).
  const roomsRes = await listRooms(propertyId);
  if (!roomsRes.ok) return roomsRes;
  const roomTypeById = new Map(roomsRes.data.map((r) => [r.id, r.room_type_id]));

  // Primary booking carries the shared group id.
  const primaryRes = await createBooking(propertyId, tenantId, {
    ...primaryInput,
    booking_group_id: groupId,
  });
  if (!primaryRes.ok) return primaryRes;

  let count = 1;
  for (const roomId of extraRoomIds) {
    const res = await createBooking(propertyId, tenantId, {
      ...primaryInput,
      room_id: roomId,
      room_type_id: roomTypeById.get(roomId) ?? primaryInput.room_type_id ?? null,
      booking_group_id: groupId,
    });
    if (!res.ok) return res;
    count += 1;
  }

  revalidatePath("/app/calendar");
  return ok({ count });
}

export async function updateBookingAction(
  id: string,
  patch: Partial<BookingInput>
): Promise<ActionResult<Booking>> {
  const res = await updateBooking(id, patch);
  if (res.ok) revalidatePath("/app/calendar");
  return res;
}

export async function setStatusAction(
  id: string,
  status: BookingStatus
): Promise<ActionResult<Booking>> {
  const res = await setBookingStatus(id, status);
  if (res.ok) revalidatePath("/app/calendar");
  return res;
}
