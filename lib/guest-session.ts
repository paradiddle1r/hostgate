import "server-only";

// Guest self-service session — stateless, HMAC-signed token (no new DB table).
//
// Two token lifetimes share the same {email, propertyCode, exp} shape and the
// same sign/verify code, just with different `exp` horizons:
//   - "login link" token: embedded in the emailed magic link, short-lived
//     (LOGIN_LINK_TTL_SECONDS) so an intercepted/forwarded email can't be
//     replayed indefinitely.
//   - "session cookie" token: minted fresh by the verify route AFTER the
//     login-link token checks out, long-lived (SESSION_TTL_SECONDS) and
//     stored in an httpOnly cookie scoped to this property's /book/<code>
//     path. Never just forward the short-lived link token into the cookie —
//     that would silently log the guest out ~15 minutes later.
//
// Verification is HMAC-signature + expiry only, matching lib/mailer.ts's
// graceful-degradation pattern: if GUEST_SESSION_SECRET isn't configured,
// signing returns null (logged, never throws) and every verification of a
// token signed under a missing secret necessarily fails closed.

import { createHmac, timingSafeEqual } from "node:crypto";

const LOGIN_LINK_TTL_SECONDS = 60 * 15; // 15 minutes — long enough to open the email
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const GUEST_SESSION_COOKIE = "hg_guest_session";
export const GUEST_SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_SECONDS;

export interface GuestSessionPayload {
  email: string;
  propertyCode: string;
  exp: number; // unix seconds
}

export interface PostStayReviewRequestPayload {
  bookingId: string;
  code: string;
}

function normalizeCode(code: string): string {
  return (code || "").trim().toLowerCase();
}

function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

/** HMAC-sign a base64url body with GUEST_SESSION_SECRET. Returns null (with a
 * server-side warning) if the secret isn't configured — callers must treat a
 * null return as "guest login is unavailable", never fall back to an
 * unsigned/insecure token. */
function sign(body: string): string | null {
  const secret = process.env.GUEST_SESSION_SECRET;
  if (!secret) {
    console.warn(
      "[guest-session] GUEST_SESSION_SECRET not set — guest self-service login is disabled."
    );
    return null;
  }
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function encodeToken(payload: GuestSessionPayload): string | null {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = sign(body);
  if (!sig) return null;
  return `${body}.${sig}`;
}

function encodeStringPayloadToken(payload: Record<string, string>): string | null {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = sign(body);
  if (!sig) return null;
  return `${body}.${sig}`;
}

/** Mint a short-lived token for the emailed magic link. */
export function createGuestLoginLinkToken(email: string, propertyCode: string): string | null {
  return encodeToken({
    email: normalizeEmail(email),
    propertyCode: normalizeCode(propertyCode),
    exp: Math.floor(Date.now() / 1000) + LOGIN_LINK_TTL_SECONDS,
  });
}

/** Mint a fresh, long-lived token for the session cookie. Only ever called by
 * the verify route AFTER a login-link token has itself verified. */
export function createGuestSessionCookieToken(email: string, propertyCode: string): string | null {
  return encodeToken({
    email: normalizeEmail(email),
    propertyCode: normalizeCode(propertyCode),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
}

/**
 * Mint a signed, DB-free post-stay review request token for the public review
 * URL. The token intentionally contains only {bookingId, code}; the follow-up
 * /review page can call verifyPostStayReviewRequestToken() with the URL params
 * to reject tampered links without needing a lookup table or raw guessable ID
 * alone.
 */
export function createPostStayReviewRequestToken(
  bookingId: string,
  code: string
): string | null {
  const normalizedBookingId = (bookingId || "").trim();
  const normalizedCode = normalizeCode(code);
  if (!normalizedBookingId || !normalizedCode) return null;
  return encodeStringPayloadToken({
    bookingId: normalizedBookingId,
    code: normalizedCode,
  });
}

/**
 * Verify a token (either the emailed link token or the session cookie token —
 * same format) against the current property code. Checks, in order: shape,
 * HMAC signature (constant-time compare), expiry, and that the token was
 * issued for THIS property — a token minted for property A must never
 * authenticate a request against property B's booking history.
 * Returns the payload on success, or null on any failure (never throws).
 */
export function verifyGuestToken(
  token: string | undefined | null,
  propertyCode: string
): GuestSessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  const expectedSig = sign(body);
  if (!expectedSig) return null;

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let payload: GuestSessionPayload;
  try {
    payload = JSON.parse(b64urlDecode(body));
  } catch {
    return null;
  }
  if (!payload || typeof payload.email !== "string" || typeof payload.propertyCode !== "string") {
    return null;
  }
  if (typeof payload.exp !== "number" || Math.floor(Date.now() / 1000) > payload.exp) {
    return null;
  }
  if (payload.propertyCode !== normalizeCode(propertyCode)) {
    return null;
  }
  return payload;
}

/**
 * Verify a post-stay review request token against the booking id and property
 * code carried in the public review URL. Returns the signed payload on
 * success, or null on any failure (never throws).
 */
export function verifyPostStayReviewRequestToken(
  token: string | undefined | null,
  bookingId: string,
  code: string
): PostStayReviewRequestPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  const expectedSig = sign(body);
  if (!expectedSig) return null;

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let payload: PostStayReviewRequestPayload;
  try {
    payload = JSON.parse(b64urlDecode(body));
  } catch {
    return null;
  }

  const expectedBookingId = (bookingId || "").trim();
  const expectedCode = normalizeCode(code);
  if (!payload || typeof payload.bookingId !== "string" || typeof payload.code !== "string") {
    return null;
  }
  if (payload.bookingId !== expectedBookingId || payload.code !== expectedCode) {
    return null;
  }
  return payload;
}

/**
 * Cookie path scopes the session to this property's booking routes only —
 * a session minted for property A is never even sent by the browser on
 * property B's /book/<code> routes.
 *
 * IMPORTANT: cookie `Path` matching is byte-wise case-sensitive (RFC 6265
 * §5.1.4), but property codes are normalized lowercase for the TOKEN's
 * internal propertyCode equality check (see verifyGuestToken) while the
 * actual URL segment (`params.code`) keeps its real case (e.g. `MMM-01`).
 * So this must NOT run the code through normalizeCode() — it has to match
 * the exact, as-served path the browser is on, or the browser will never
 * send the cookie back and the guest gets bounced to the login form forever.
 * Always call this with the raw `params.code` from the route, not a
 * lowercased copy.
 */
export function guestSessionCookiePath(propertyCode: string): string {
  return `/book/${(propertyCode || "").trim()}`;
}
