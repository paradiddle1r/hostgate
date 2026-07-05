// Pure iCal (RFC 5545) formatting helpers for the per-room-type OTA export
// feed (app/ical/[propertyCode]/[roomTypeId]/route.ts). No DB, no React —
// same "pure helper" shape as booking-calc.ts / rooms-generator.ts, testable
// with Vitest.
//
// Design notes for the export:
//   - One all-day VEVENT per booking: DTSTART=check_in, DTEND=check_out
//     (both dates, half-open — matches the booking model exactly).
//   - UID is stable per booking id, so re-polling the feed never creates
//     duplicate events on the OTA side (Booking.com/Agoda/Airbnb all key
//     off UID for de-dup on re-sync).
//   - SUMMARY is always the literal "Booked" — never guest name/phone/etc.
//     This feed has no auth (property code + room-type id are the shared
//     secret, like /book/[code]), so no guest PII may ever appear in it.

export interface ICalBookingEvent {
  id: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
}

/** "2026-07-05" -> "20260705" (VALUE=DATE form used by all-day VEVENTs). */
export function toICalDate(dateISO: string): string {
  return dateISO.replace(/-/g, "");
}

/** RFC 5545 §3.1: fold lines over 75 octets with CRLF + a leading space. */
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let out = "";
  let rest = line;
  let first = true;
  while (rest.length > 0) {
    const chunkLen = first ? 75 : 74;
    out += (first ? "" : "\r\n ") + rest.slice(0, chunkLen);
    rest = rest.slice(chunkLen);
    first = false;
  }
  return out;
}

/** Escape TEXT-value special characters per RFC 5545 §3.3.11. */
export function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** ISO timestamp -> iCal UTC DATE-TIME form, e.g. "20260705T120000Z". */
export function toICalTimestamp(isoTimestamp: string): string {
  return isoTimestamp.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

/**
 * Build a complete text/calendar body for one room type: one all-day VEVENT
 * per booking. `dtstamp` is caller-supplied (an ISO timestamp) purely so this
 * stays pure/testable — callers pass `new Date().toISOString()`.
 */
export function buildBookingsICS(
  calendarName: string,
  events: ICalBookingEvent[],
  dtstamp: string
): string {
  const stamp = toICalTimestamp(dtstamp);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HostGate//iCal Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICalText(calendarName)}`,
  ];
  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:booking-${ev.id}@hostgate.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toICalDate(ev.checkIn)}`,
      `DTEND;VALUE=DATE:${toICalDate(ev.checkOut)}`,
      "SUMMARY:Booked",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
