"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
import {
  createBooking,
  updateBooking,
  setBookingStatus,
  BookingInput,
  Booking,
  BookingStatus,
} from "@/lib/db/bookings";
import { getActiveProperty } from "@/lib/active-property-server";

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
