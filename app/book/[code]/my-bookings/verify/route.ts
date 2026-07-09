import { NextResponse, type NextRequest } from "next/server";
import {
  verifyGuestToken,
  createGuestSessionCookieToken,
  guestSessionCookiePath,
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/guest-session";

/**
 * Guest "My Bookings" magic-link verification.
 *
 * The emailed link (built in ./actions.ts's requestGuestLoginLinkAction)
 * points here with a short-lived, HMAC-signed token proving the click came
 * from the inbox that owns `email`. On success we mint a SEPARATE, longer-
 * lived token for the session cookie (never forward the short-lived link
 * token itself — see lib/guest-session.ts) and redirect to the dashboard.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const propertyCode = params.code;

  const payload = verifyGuestToken(token, propertyCode);
  if (!payload) {
    return NextResponse.redirect(
      new URL(`/book/${propertyCode}/my-bookings?error=invalid_link`, url.origin)
    );
  }

  const sessionToken = createGuestSessionCookieToken(payload.email, propertyCode);
  if (!sessionToken) {
    return NextResponse.redirect(
      new URL(`/book/${propertyCode}/my-bookings?error=unavailable`, url.origin)
    );
  }

  const response = NextResponse.redirect(
    new URL(`/book/${propertyCode}/my-bookings`, url.origin)
  );
  response.cookies.set(GUEST_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: guestSessionCookiePath(propertyCode),
    maxAge: GUEST_SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
