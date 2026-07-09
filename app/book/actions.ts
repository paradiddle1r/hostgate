"use server";

// Public booking submission — no auth. Calls the anon-granted RPC via the
// data layer and returns a plain result the client redirects on.

import {
  createPublicBookingCart,
  CreateCartBookingInput,
  CreateCartBookingResult,
  getPublicProperty,
  lookupPublicBooking,
  lookupReturningGuest,
  ReturningGuestInfo,
  cancelPublicBookingRpc,
  PublicBookingDetails,
} from "@/lib/book";
import { ActionResult, ok, fail } from "@/lib/errors";
import { sendBookingConfirmationEmail } from "@/lib/mailer";

/**
 * Submit a guest's whole cart (one or more room-type line items, same
 * check_in/check_out) as ONE coherent operation — see createPublicBookingCart
 * in lib/book.ts for the sequential-create + rollback-on-partial-failure
 * behavior. Money is never trusted from the client: every item's price is
 * recomputed server-side in app/book/[code]/checkout/page.tsx before this is
 * called, and the RPC itself always recomputes the authoritative total again.
 */
export async function submitPublicBooking(
  input: CreateCartBookingInput
): Promise<CreateCartBookingResult> {
  if (!input.propertyId || !input.checkIn || !input.checkOut) {
    return { ok: false, message: "Missing booking details." };
  }
  if (!input.items || input.items.length === 0) {
    return { ok: false, message: "ตะกร้าว่างเปล่า / Your cart is empty." };
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
  return createPublicBookingCart(input);
}

/**
 * Returning-guest recognition for the checkout form. Requires BOTH an email
 * AND a phone number (see lookupReturningGuest in lib/book.ts for why) —
 * called debounced, from the client, as the guest types. Silent by design:
 * any failure (bad property id, RPC error) just resolves to null, never an
 * error the guest would see.
 */
export async function lookupReturningGuestAction(
  propertyId: string,
  email: string,
  phone: string
): Promise<ReturningGuestInfo | null> {
  if (!propertyId || !email.trim() || !phone.trim()) return null;
  try {
    return await lookupReturningGuest(propertyId, email, phone);
  } catch {
    return null;
  }
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

/**
 * Resend the booking-confirmation receipt to the guest's own email. Re-runs
 * the exact same property + code + email validation as lookupPublicBookingAction
 * (never trusts a client-held id / email — the email typed here must match
 * the one captured at checkout) before sending anything, then reuses the
 * same sendBookingConfirmationEmail() sender the booking-confirmation flow
 * uses so the resend can never drift from the original receipt.
 */
export async function resendPublicBookingConfirmationAction(
  propertyCode: string,
  bookingCode: string,
  email: string
): Promise<ActionResult<{ sent: true }>> {
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
  if (booking.status === "cancelled") {
    return fail(
      "HG-BOOK-422",
      "การจองนี้ถูกยกเลิกแล้ว ไม่สามารถส่งอีเมลยืนยันซ้ำได้ / This booking is cancelled — a confirmation can't be resent."
    );
  }

  const sendRes = await sendBookingConfirmationEmail({
    to: mail,
    propertyName: property.name,
    bookingCode: booking.code,
    roomTypeName: booking.roomTypeName,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    nights: booking.nights,
    totalAmount: booking.totalAmount,
    currency: booking.currency,
  });
  if (!sendRes.ok) {
    return fail("HG-MAIL-500", sendRes.message || "ส่งอีเมลไม่สำเร็จ / Failed to send email.");
  }
  return ok({ sent: true as const });
}
