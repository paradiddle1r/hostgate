// Pure iCal (RFC 5545) parsing helper for OTA calendar IMPORT — the reverse of
// lib/ical.ts (which only builds/exports feeds). No DB, no React — same "pure
// helper" shape as booking-calc.ts / rooms-generator.ts / lib/ical.ts,
// testable with Vitest.
//
// Design notes for the import:
//   - We only need VEVENT/UID/DTSTART;VALUE=DATE/DTEND;VALUE=DATE — Booking.com
//     / Airbnb / Agoda all-day export feeds only ever carry that much for a
//     blocked-date VEVENT, and that's all callers (importOtaIcal) consume.
//   - Tolerant of RFC 5545 §3.1 line folding (a CRLF/LF followed by a single
//     space or tab continues the previous line) and of either CRLF or bare LF
//     line endings — real-world OTA feeds are inconsistent about this.
//   - DTSTART/DTEND may appear as `DTSTART;VALUE=DATE:20260710` or plain
//     `DTSTART:20260710` (some feeds omit the VALUE=DATE param for all-day
//     events) — both are accepted. Timestamp-form values (`...T120000Z`) are
//     truncated to their date portion since bookings.check_in/check_out are
//     `date` columns.
//   - A VEVENT missing UID, DTSTART, or DTEND is skipped rather than thrown —
//     one malformed block in a third-party feed shouldn't sink the whole sync.

export interface ICalImportEvent {
  uid: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
}

/** "20260705" or "20260705T120000Z" -> "2026-07-05". */
function toISODate(value: string): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Un-fold RFC 5545 continuation lines: a line starting with a single space or
 * tab is a continuation of the previous line (the leading whitespace is
 * removed and the content appended). Normalizes CRLF/LF first so the split is
 * simple.
 */
function unfoldLines(icsText: string): string[] {
  const rawLines = icsText.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const raw of rawLines) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1);
    } else {
      lines.push(raw);
    }
  }
  return lines;
}

/** Split one unfolded line into its property name (with params) and value. */
function splitProperty(line: string): { name: string; value: string } | null {
  const idx = line.indexOf(":");
  if (idx === -1) return null;
  return { name: line.slice(0, idx).trim().toUpperCase(), value: line.slice(idx + 1).trim() };
}

/**
 * Parse the VEVENT blocks of an .ics document into {uid, checkIn, checkOut}.
 * Tolerant of folded lines and CRLF/LF. Events missing a UID/DTSTART/DTEND are
 * silently skipped.
 */
export function parseICS(icsText: string): ICalImportEvent[] {
  const lines = unfoldLines(icsText);
  const events: ICalImportEvent[] = [];

  let inEvent = false;
  let uid: string | null = null;
  let dtstart: string | null = null;
  let dtend: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.toUpperCase() === "BEGIN:VEVENT") {
      inEvent = true;
      uid = null;
      dtstart = null;
      dtend = null;
      continue;
    }
    if (line.toUpperCase() === "END:VEVENT") {
      if (inEvent && uid && dtstart && dtend) {
        events.push({ uid, checkIn: dtstart, checkOut: dtend });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const prop = splitProperty(line);
    if (!prop) continue;

    if (prop.name === "UID") {
      uid = prop.value;
    } else if (prop.name.startsWith("DTSTART")) {
      dtstart = toISODate(prop.value);
    } else if (prop.name.startsWith("DTEND")) {
      dtend = toISODate(prop.value);
    }
  }

  return events;
}
