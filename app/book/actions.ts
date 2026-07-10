"use server";

// Public booking submission — no auth. Calls the anon-granted RPC via the
// data layer and returns a plain result the client redirects on.

import {
  createPublicBookingCart,
  CreateCartBookingInput,
  CreateCartBookingResult,
  getAvailability,
  getPublicProperty,
  getPublicRatePlans,
  getQuote,
  lookupPublicBooking,
  lookupReturningGuest,
  planNightlyPrice,
  ReturningGuestInfo,
  cancelPublicBookingRpc,
  PublicBookingDetails,
  getGuestBookingHistory,
  GuestBookingHistoryItem,
} from "@/lib/book";
import { ActionResult, ok, fail } from "@/lib/errors";
import { sendBookingConfirmationEmail } from "@/lib/mailer";
import { createOmiseCharge } from "@/lib/omise";
import { applyPromoDiscount } from "@/lib/promo-codes";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const validation = await validatePublicBookingInput(input);
  if (!validation.ok) return validation;
  return createPublicBookingCart(input);
}

async function validatePublicBookingInput(
  input: CreateCartBookingInput
): Promise<{ ok: true } | { ok: false; message: string }> {
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
  return { ok: true };
}

export type PayAndSubmitBookingInput = CreateCartBookingInput & {
  propertyCode: string;
  omiseToken: string;
};

async function computeAuthoritativeCheckoutTotal(
  input: CreateCartBookingInput
): Promise<{ ok: true; total: number } | { ok: false; message: string }> {
  const avail = await getAvailability(input.propertyId, input.checkIn, input.checkOut);
  const { plans, overridesByPlan } = await getPublicRatePlans(input.propertyId);
  const nights = Math.max(
    1,
    Math.round(
      (Date.parse(input.checkOut + "T00:00:00Z") - Date.parse(input.checkIn + "T00:00:00Z")) /
        86_400_000
    )
  );

  const requestedByType = new Map<string, number>();
  for (const item of input.items) {
    const qty = Math.max(1, Math.min(50, Math.round(item.qty) || 0));
    requestedByType.set(item.roomTypeId, (requestedByType.get(item.roomTypeId) ?? 0) + qty);
  }

  let total = 0;
  for (const item of input.items) {
    const type = avail.find((a) => a.room_type_id === item.roomTypeId);
    const qty = Math.max(1, Math.min(50, Math.round(item.qty) || 0));
    if (!type || type.available <= 0 || qty > type.available) {
      return {
        ok: false,
        message:
          "บางรายการในตะกร้าไม่ว่างแล้ว กรุณากลับไปแก้ไข / Some cart items are no longer available.",
      };
    }
    if ((requestedByType.get(item.roomTypeId) ?? 0) > type.available) {
      return {
        ok: false,
        message:
          "จำนวนห้องที่เลือกมากกว่าห้องว่าง กรุณากลับไปแก้ไข / Selected rooms exceed availability.",
      };
    }

    const baseTotal = await getQuote(input.propertyId, type.room_type_id, input.checkIn, input.checkOut);
    let unitTotal = baseTotal;
    if (item.ratePlanId) {
      const plan = plans.find((p) => p.id === item.ratePlanId);
      if (plan) {
        const basePrice = type.daily_rate ?? baseTotal / nights;
        unitTotal = planNightlyPrice(plan, type.room_type_id, overridesByPlan, basePrice) * nights;
      }
    }
    total += unitTotal * qty;
  }

  if (input.promoCode?.trim()) {
    const discount = applyPromoDiscount(total, input.promoCode);
    if (discount.ok) total = discount.discountedTotal;
  }

  return { ok: true, total: Math.max(0, total) };
}

async function appendOmiseChargeNote(
  propertyId: string,
  bookingCodes: string[],
  chargeId: string
): Promise<void> {
  if (bookingCodes.length === 0) return;
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("bookings")
    .select("id, notes")
    .eq("property_id", propertyId)
    .in("code", bookingCodes);
  const paymentNote = `Paid via Omise charge ${chargeId}`;
  for (const row of (rows ?? []) as { id: string; notes: string | null }[]) {
    const baseNotes = row.notes ?? "";
    const notes = baseNotes ? `${baseNotes} · ${paymentNote}` : paymentNote;
    await admin.from("bookings").update({ notes }).eq("id", row.id);
  }
}

export async function payAndSubmitBooking(
  input: PayAndSubmitBookingInput
): Promise<CreateCartBookingResult> {
  const validation = await validatePublicBookingInput(input);
  if (!validation.ok) return validation;

  const property = await getPublicProperty(input.propertyCode);
  if (!property || property.id !== input.propertyId) {
    return { ok: false, message: "ไม่พบที่พักนี้ / Property not found." };
  }
  if (property.currency.toUpperCase() !== "THB") {
    return {
      ok: false,
      message: "ตอนนี้รับชำระผ่าน Omise เฉพาะ THB / Omise checkout currently supports THB only.",
    };
  }

  const totalRes = await computeAuthoritativeCheckoutTotal(input);
  if (!totalRes.ok) return totalRes;
  const amountSatang = Math.round(totalRes.total * 100);
  if (amountSatang <= 0) {
    return { ok: false, message: "ยอดชำระไม่ถูกต้อง / Invalid payment amount." };
  }

  const charge = await createOmiseCharge({
    token: input.omiseToken,
    amount: amountSatang,
    currency: property.currency,
    description: `HostGate booking ${property.name} ${input.checkIn} to ${input.checkOut}`,
  });
  if (!charge.ok) return { ok: false, message: charge.message };
  if (charge.status !== "successful") {
    return {
      ok: false,
      message:
        "ชำระเงินยังไม่สำเร็จ จึงยังไม่สร้างการจอง / Payment was not successful, so no booking was created.",
    };
  }

  const booking = await createPublicBookingCart({
    ...input,
    currency: property.currency,
  });
  if (!booking.ok) return booking;

  try {
    await appendOmiseChargeNote(input.propertyId, booking.bookingCodes, charge.chargeId);
  } catch {
    /* The paid booking already exists; staff can still reconcile via Omise logs. */
  }

  return booking;
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
 * A guest's other stays at this property, shown below their looked-up
 * booking on the manage-booking page.
 *
 * SECURITY: this is a server action, i.e. a plain POST endpoint reachable
 * directly — a client calling it is NOT guaranteed to have gone through
 * lookupPublicBookingAction first. So this action re-derives the ownership
 * proof itself: it requires the SAME booking_code + email pair as lookup and
 * re-runs lookupPublicBooking() server-side before touching history at all.
 * An email alone is never sufficient — that would let anyone who merely
 * knows/guesses a guest's email enumerate their stay history without ever
 * proving a booking code. Only once that verification succeeds does it call
 * getGuestBookingHistory, excluding the just-verified booking by id (not a
 * client-supplied id). Silent by design otherwise: any failure just resolves
 * to an empty list, never an error the guest would see (matches
 * lookupReturningGuestAction's silent-fail pattern) — the history list is a
 * nice-to-have, not a blocker.
 */
export async function getGuestBookingHistoryAction(
  propertyCode: string,
  bookingCode: string,
  email: string
): Promise<GuestBookingHistoryItem[]> {
  const code = (bookingCode || "").trim();
  const mail = (email || "").trim();
  if (!code || !mail) return [];
  try {
    const property = await getPublicProperty(propertyCode);
    if (!property) return [];
    const verified = await lookupPublicBooking(property.id, code, mail);
    if (!verified) return [];
    return await getGuestBookingHistory(property.id, mail, verified.id);
  } catch {
    return [];
  }
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
