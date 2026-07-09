"use server";

// Guest self-service "My Bookings" login — a magic-link alternative to the
// booking_code + email lookup in app/book/actions.ts (ManageBookingForm).
// See lib/guest-session.ts for the token mechanics and this file's
// getMyBookingsAction for the RPC-safety reasoning.

import { cookies, headers } from "next/headers";
import { getPublicProperty, getGuestBookingHistory, type GuestBookingHistoryItem } from "@/lib/book";
import { ActionResult, ok, fail } from "@/lib/errors";
import { sendMagicLinkEmail } from "@/lib/mailer";
import {
  createGuestLoginLinkToken,
  verifyGuestToken,
  guestSessionCookiePath,
  GUEST_SESSION_COOKIE,
} from "@/lib/guest-session";

function originFromHeaders(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "hostgate.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Request a "My Bookings" sign-in link, emailed via sendMagicLinkEmail.
 *
 * Deliberately does NOT check whether the email actually has any bookings at
 * this property before sending — doing so would let a stranger probe emails
 * against a property and learn who has stayed there from the response alone
 * (ok vs fail). Instead this always succeeds once the email is well-formed
 * and the property exists; the dashboard the link leads to simply renders
 * however many (zero or more) bookings public_guest_booking_history returns
 * for that address. The security boundary here is "can only the real inbox
 * owner reach the dashboard", not "does this email have bookings" — that's
 * exactly what the emailed link proves.
 */
export async function requestGuestLoginLinkAction(
  propertyCode: string,
  email: string
): Promise<ActionResult<{ sent: true }>> {
  const code = (propertyCode || "").trim();
  const mail = (email || "").trim();
  if (!mail) {
    return fail("HG-VALIDATION-422", "กรุณากรอกอีเมล / Please enter your email.");
  }

  const property = await getPublicProperty(code);
  if (!property) {
    return fail("HG-PROP-404", "ไม่พบที่พักนี้ / Property not found.");
  }

  const token = createGuestLoginLinkToken(mail, code);
  if (!token) {
    // GUEST_SESSION_SECRET isn't configured — lib/guest-session.ts already
    // logged a server-side warning. Degrade like a missing RESEND_API_KEY
    // would: a clear failure, never a silently-broken/insecure link.
    return fail(
      "HG-MAIL-500",
      "ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อที่พักโดยตรง / Sign-in isn't configured yet — please contact the property directly."
    );
  }

  const link = `${originFromHeaders()}/book/${code}/my-bookings/verify?token=${encodeURIComponent(token)}`;
  const sendRes = await sendMagicLinkEmail({
    to: mail,
    propertyName: property.name,
    propertyCode: code,
    link,
  });
  if (!sendRes.ok) {
    return fail("HG-MAIL-500", sendRes.message || "ส่งอีเมลไม่สำเร็จ / Failed to send email.");
  }
  return ok({ sent: true as const });
}

/**
 * The signed-in guest's bookings at this property, for the dashboard.
 *
 * SECURITY — why this is safe to call public_guest_booking_history with only
 * an email (no booking_code pre-check, unlike getGuestBookingHistoryAction in
 * app/book/actions.ts): migration 23's header explains that RPC is
 * email-only and therefore unsafe off a BARE client-supplied email, because
 * anyone who merely knows/guesses a guest's address could enumerate their
 * stays. That's why every other caller re-proves ownership with
 * booking_code + email first. Here there is no bare client-supplied email —
 * the only input this function trusts is the `hg_guest_session` cookie, and
 * it re-verifies that cookie's HMAC signature + expiry + property-code match
 * itself via verifyGuestToken() before reading anything out of it. That
 * cookie is only ever minted by app/book/[code]/my-bookings/verify/route.ts,
 * which only runs after the guest clicked a one-time link emailed to that
 * exact address — i.e. only the real inbox owner can ever get this far. So
 * "clicked a working magic link" stands in for "typed a matching booking
 * code" as the proof of ownership; it is a different but equally valid gate,
 * not a bypass of one. Do NOT lift this pattern to call the RPC off any
 * other email source (a query param, a form field, a cookie that isn't
 * verified here) — that would reopen the exact enumeration hole migration 23
 * warns about.
 */
export async function getMyBookingsAction(
  propertyCode: string
): Promise<ActionResult<GuestBookingHistoryItem[]>> {
  const code = (propertyCode || "").trim();
  const token = cookies().get(GUEST_SESSION_COOKIE)?.value;
  const session = verifyGuestToken(token, code);
  if (!session) {
    return fail("HG-AUTH-401", "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ / Session expired — please sign in again.");
  }

  const property = await getPublicProperty(code);
  if (!property) {
    return fail("HG-PROP-404", "ไม่พบที่พักนี้ / Property not found.");
  }

  try {
    const bookings = await getGuestBookingHistory(property.id, session.email);
    return ok(bookings);
  } catch (e) {
    return fail("HG-UNKNOWN-500", e instanceof Error ? e.message : "โหลดรายการจองไม่สำเร็จ / Failed to load bookings.");
  }
}

/** Clear the guest session cookie (best-effort sign-out). Must clear with the
 * EXACT SAME path the verify route set it with (see guestSessionCookiePath's
 * case-sensitivity note) — pass the raw route `params.code`, not a
 * lowercased copy, or the browser will keep the stale cookie around. */
export async function signOutGuestAction(propertyCode: string): Promise<void> {
  cookies().set(GUEST_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: guestSessionCookiePath(propertyCode),
    maxAge: 0,
  });
}
