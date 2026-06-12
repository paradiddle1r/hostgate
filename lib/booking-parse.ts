// Heuristic parser for pasted OTA / email booking text → a booking draft.
// Pure: no DB, no React. Conservative — only fills a field when reasonably
// sure, leaving the rest for the operator to complete in the modal.
//
// Thai context: bare numeric dates (12/06/2026) are read as DD/MM/YYYY.

export interface ParsedBooking {
  guestName?: string;
  phone?: string;
  checkIn?: string; // YYYY-MM-DD
  checkOut?: string; // YYYY-MM-DD
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Reject impossible dates (e.g. 31 Feb rolled over).
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

interface Hit {
  pos: number;
  date: string;
}

/** Collect every date-like token with its position in the text. */
function findDates(text: string): Hit[] {
  const hits: Hit[] = [];
  const push = (pos: number, date: string | null) => {
    if (date) hits.push({ pos, date });
  };

  // 1. ISO 2026-06-12
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    push(m.index ?? 0, iso(+m[1], +m[2], +m[3]));
  }
  // 2. Numeric DD/MM/YYYY (or DD-MM-YYYY, DD.MM.YYYY), 2- or 4-digit year.
  for (const m of text.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/g)) {
    push(m.index ?? 0, iso(fullYear(+m[3]), +m[2], +m[1]));
  }
  // 3. "12 Jun 2026" / "12 June 2026"
  for (const m of text.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})\b/g)) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) push(m.index ?? 0, iso(+m[3], mon, +m[1]));
  }
  // 4. "Jun 12, 2026" / "June 12 2026"
  for (const m of text.matchAll(/\b([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon) push(m.index ?? 0, iso(+m[3], mon, +m[2]));
  }

  // De-dupe by position, keep document order.
  const seen = new Set<number>();
  return hits
    .sort((a, b) => a.pos - b.pos)
    .filter((h) => (seen.has(h.pos) ? false : (seen.add(h.pos), true)));
}

/** Pull a guest name from a labelled line, else undefined. */
function findName(text: string): string | undefined {
  const m = text.match(
    /(?:guest\s*name|guest|customer|name|ผู้เข้าพัก|ชื่อ(?:ผู้จอง)?)\s*[:：]\s*(.+)/i
  );
  if (m) {
    const v = m[1].trim().replace(/\s{2,}/g, " ");
    // Drop trailing junk after the name (e.g. "John Smith | 2 guests").
    const clean = v.split(/[|•·]/)[0].trim();
    if (clean.length >= 2 && clean.length <= 80) return clean;
  }
  return undefined;
}

/** First phone-like run of digits (≥9 digits, optional +). Avoids dates. */
function findPhone(text: string): string | undefined {
  for (const m of text.matchAll(/\+?\d[\d\s\-]{7,}\d/g)) {
    const raw = m[0];
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 9 && digits.length <= 15 && !raw.includes("/") && !raw.includes(".")) {
      return raw.trim().replace(/\s{2,}/g, " ");
    }
  }
  return undefined;
}

export function parseBookingText(text: string): ParsedBooking {
  const out: ParsedBooking = {};
  if (!text || !text.trim()) return out;

  const dates = findDates(text);
  if (dates.length >= 2) {
    let [a, b] = [dates[0].date, dates[1].date];
    if (b < a) [a, b] = [b, a];
    if (b > a) {
      out.checkIn = a;
      out.checkOut = b;
    }
  } else if (dates.length === 1) {
    out.checkIn = dates[0].date;
  }

  out.guestName = findName(text);
  out.phone = findPhone(text);
  return out;
}
