// HostGate error-code system.
//
// Every server action returns ActionResult<T> instead of throwing to the
// client. Each failure carries a stable HG-* code the user can quote in a
// support ticket, plus a human message (localized at the UI layer). Postgres
// exceptions raised by our triggers embed the same code in their message
// (e.g. "HG-BOOK-409: ..."), which mapPgError() recovers.

export type HGErrorCode =
  | "HG-AUTH-401" // not signed in
  | "HG-AUTH-403" // signed in but not allowed
  | "HG-PROP-403" // plan property limit reached
  | "HG-PROP-404" // property not found / not in tenant
  | "HG-ROOM-409" // room number already exists
  | "HG-ROOM-404" // room not found
  | "HG-BOOK-409" // room/date conflict
  | "HG-BOOK-422" // invalid booking input
  | "HG-BOOK-404" // booking not found
  | "HG-GUEST-422" // invalid guest input
  | "HG-PLAN-403" // feature not on this plan
  | "HG-VALIDATION-422" // generic input validation
  | "HG-MAIL-500" // email send failed / not configured
  | "HG-UNKNOWN-500"; // anything unmapped

export type ActionOk<T> = { ok: true; data: T };
export type ActionErr = { ok: false; code: HGErrorCode; message: string };
export type ActionResult<T> = ActionOk<T> | ActionErr;

export function ok<T>(data: T): ActionOk<T> {
  return { ok: true, data };
}

export function fail(code: HGErrorCode, message: string): ActionErr {
  return { ok: false, code, message };
}

/** Error subclass that carries an HG code — for throw/catch within server code. */
export class HGError extends Error {
  hgCode: HGErrorCode;
  constructor(code: HGErrorCode, message: string) {
    super(message);
    this.name = "HGError";
    this.hgCode = code;
  }
}

export function hgError(code: HGErrorCode, message: string): HGError {
  return new HGError(code, message);
}

const ALL_CODES: HGErrorCode[] = [
  "HG-AUTH-401", "HG-AUTH-403", "HG-PROP-403", "HG-PROP-404",
  "HG-ROOM-409", "HG-ROOM-404", "HG-BOOK-409", "HG-BOOK-422",
  "HG-BOOK-404", "HG-GUEST-422", "HG-PLAN-403", "HG-VALIDATION-422",
  "HG-MAIL-500", "HG-UNKNOWN-500",
];

/**
 * Map an unknown thrown value (Supabase/PostgREST error, HGError, Error) to a
 * typed ActionErr. Recognizes:
 *   - HGError instances (use their code)
 *   - any message containing an "HG-XXX-NNN" token (our trigger exceptions)
 *   - Postgres unique-violation (23505) → a 409-style code by table hint
 */
export function mapPgError(e: unknown, fallbackMessage = "Something went wrong"): ActionErr {
  if (e instanceof HGError) return fail(e.hgCode, e.message);

  const message =
    (typeof e === "object" && e && "message" in e && typeof (e as { message: unknown }).message === "string"
      ? (e as { message: string }).message
      : String(e)) || fallbackMessage;

  // Our trigger exceptions prefix the code: "HG-BOOK-409: room already booked"
  const token = message.match(/HG-[A-Z]+-\d{3}/)?.[0] as HGErrorCode | undefined;
  if (token && ALL_CODES.includes(token)) {
    return fail(token, message.replace(/^.*?(HG-[A-Z]+-\d{3}:\s*)/, "$1"));
  }

  // Postgres unique_violation
  const pgCode =
    typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
  if (pgCode === "23505") {
    if (/rooms?_/.test(message)) return fail("HG-ROOM-409", "That room number already exists.");
    if (/bookings?_/.test(message)) return fail("HG-BOOK-409", "Booking conflict.");
    return fail("HG-VALIDATION-422", "Duplicate value.");
  }

  return fail("HG-UNKNOWN-500", message);
}
