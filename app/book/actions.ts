"use server";

// Public booking submission — no auth. Calls the anon-granted RPC via the
// data layer and returns a plain result the client redirects on.

import {
  createPublicBooking,
  CreateBookingInput,
  getPublicProperty,
  lookupPublicBooking,
  cancelPublicBookingRpc,
  PublicBookingDetails,
} from "@/lib/book";
import { ActionResult, ok, fail } from "@/lib/errors";

export async function submitPublicBooking(
  input: CreateBookingInput
): Promise<{ ok: true; id: string; code: string; total: number } | { ok: false; message: string }> {
  if (!input.propertyId || !input.roomTypeId || !input.checkIn || !input.checkOut) {
    return { ok: false, message: "Missing booking details." };
  }
  if (!input.guestName || !input.guestName.trim()) {
    return { ok: false, message: "Please enter your name." };
  }
  // Guard against a crafted request bypassing the date-picker's min= — never
  // trust the client to have enforced check_in >= today (see BookSearchForm).
  const today = new Date().toISOString().slice(0, 10);
  if (input.checkIn < today) {
    return {
      ok: false,
      message: "วันที่เข้าพักต้องไม่ใช่วันที่ผ่านมาแล้ว / Check-in date cannot be in the past.",
    };
  }
  return createPublicBooking(input);
}

/**
 * Guest self-service lookup ("manage my booking"). Requires the property
 * code (from the URL), the booking code, AND the guest's own email to ALL
 * match — never resolves a booking by code alone, so a code can't be used to
 * enumerate someone else's stay.
 */
export async function lookupPublicBookingAction(
  propertyCode: string,
  bookingCode: string,
  email: string
): Promise<ActionResult<PublicBookingDetails>> {
  const code = (bookingCode || "").trim();
  const mail = (email || "").trim();
  if (!code) {
    return fail("HG-VALIDATION-422", "กรุณากรอกหมายเลขการจอง / Please enter your booking code.");
  }
  if (!mail) {
    return fail("HG-VALIDATION-422", "กรุณากรอกอีเมล / Please enter your email.");
  }

  const property = await getPublicProperty(propertyCode);
  if (!property) {
    return fail("HG-PROP-404", "ไม่พบที่พักนี้ / Property not found.");
  }

  const booking = await lookupPublicBooking(property.id, code, mail);
  if (!booking) {
    return fail(
      "HG-BOOK-404",
      "ไม่พบการจอง กรุณาตรวจสอบหมายเลขการจองและอีเมลอีกครั้ง / Booking not found — check the code and email and try again."
    );
  }
  return ok(booking);
}

/**
 * Cancel a guest's own booking. Re-verifies property + code + email
 * server-side (same guard as the lookup — never trusts a client-held id)
 * before calling setBookingStatus(...,'cancelled') under the hood via the
 * public_cancel_booking RPC, which also refuses if already cancelled or
 * check_in has passed.
 */
export async function cancelPublicBookingAction(
  propertyCode: string,
  bookingCode: string,
  email: string
): Promise<ActionResult<{ status: "cancelled" }>> {
  const code = (bookingCode || "").trim();
  const mail = (email || "").trim();
  if (!code || !mail) {
    return fail("HG-VALIDATION-422", "ข้อมูลไม่ครบ / Missing booking code or email.");
  }

  const property = await getPublicProperty(propertyCode);
  if (!property) {
    return fail("HG-PROP-404", "ไม่พบที่พักนี้ / Property not found.");
  }

  const res = await cancelPublicBookingRpc(property.id, code, mail);
  if (!res.ok) {
    return fail("HG-BOOK-422", res.message);
  }
  return ok({ status: "cancelled" as const });
}
