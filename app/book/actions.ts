"use server";

// Public booking submission — no auth. Calls the anon-granted RPC via the
// data layer and returns a plain result the client redirects on.

import { createPublicBooking, CreateBookingInput } from "@/lib/book";

export async function submitPublicBooking(
  input: CreateBookingInput
): Promise<{ ok: true; id: string; code: string; total: number } | { ok: false; message: string }> {
  if (!input.propertyId || !input.roomTypeId || !input.checkIn || !input.checkOut) {
    return { ok: false, message: "Missing booking details." };
  }
  if (!input.guestName || !input.guestName.trim()) {
    return { ok: false, message: "Please enter your name." };
  }
  return createPublicBooking(input);
}
