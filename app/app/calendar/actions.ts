"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
import {
  createBooking,
  updateBooking,
  setBookingStatus,
  listBookings,
  BookingInput,
  Booking,
  BookingStatus,
} from "@/lib/db/bookings";
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
