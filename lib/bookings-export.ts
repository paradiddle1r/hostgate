// Dependency-free browser exports for the Bookings list page. Both functions
// run in the browser (they touch `document` to trigger a download) — guarded
// with a typeof check so importing them server-side is a no-op rather than a
// crash. CSV is UTF-8 + BOM so Excel renders Thai; the "Excel" export is a
// simple HTML table saved as .xls (Excel opens HTML tables natively), which
// keeps us off any spreadsheet library.
//
// Columns are accountant-grade: every operationally-relevant booking field
// plus two derived ones (nights, outstanding). Free-text cells are guarded
// against spreadsheet formula injection (a leading = + - @ can be executed by
// Excel/Sheets) by prefixing a single quote.

import type { Booking } from "@/lib/db/bookings";

// `key` is a Booking field (or a derived sentinel handled in `cellValue`);
// `label` is the column header. Order matches what an accountant reviewing
// the export expects: identity → dates → money → ID/contact → metadata.
const COLUMNS: { key: string; label: string }[] = [
  { key: "reservation_no", label: "Reservation No." },
  { key: "code", label: "Code" },
  { key: "ota", label: "Source / OTA" },
  { key: "source", label: "Source type" },
  { key: "booking_type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "room", label: "Room" },
  { key: "guest_name", label: "Guest name" },
  { key: "guest_first_name", label: "First name" },
  { key: "guest_last_name", label: "Last name" },
  { key: "thai_name", label: "Thai name" },
  { key: "phone", label: "Phone" },
  { key: "check_in", label: "Check-in" },
  { key: "check_out", label: "Check-out" },
  { key: "nights", label: "Nights" },
  { key: "booked_date", label: "Booked date" },
  { key: "total_amount", label: "Total amount" },
  { key: "amount_paid", label: "Amount paid" },
  { key: "outstanding", label: "Outstanding" },
  { key: "payment_method", label: "Payment method" },
  { key: "deposit_date", label: "Deposit date" },
  { key: "deposit_method", label: "Deposit method" },
  { key: "reservation_deposit", label: "Reservation deposit" },
  { key: "car_plate", label: "Car plate" },
  { key: "citizen_id", label: "Citizen ID" },
  { key: "id_dob", label: "DOB" },
  { key: "id_gender", label: "Gender" },
  { key: "id_address", label: "ID address" },
  { key: "notes", label: "Notes" },
  { key: "booking_group_id", label: "Group ID" },
  { key: "id", label: "Booking ID" },
  { key: "created_at", label: "Created at" },
];

/** Whole-day diff using UTC anchors so +07 dates don't drift. */
function nights(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn + "T00:00:00Z");
  const b = Date.parse(checkOut + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** One cell value (already stringified) for a given column key. */
function cellValue(
  b: Booking,
  key: string,
  roomNumberById: Record<string, string>
): string {
  if (key === "room") return b.room_id ? roomNumberById[b.room_id] ?? "—" : "—";
  if (key === "nights") return String(nights(b.check_in, b.check_out));
  if (key === "outstanding") {
    if (b.total_amount == null) return "";
    const out = Math.max(0, b.total_amount - (b.amount_paid ?? 0));
    return String(out);
  }
  const v = (b as unknown as Record<string, unknown>)[key];
  if (v === null || v === undefined) return "";
  return String(v);
}

/** The cell values for one booking row, in COLUMNS order. */
function rowValues(
  b: Booking,
  roomNumberById: Record<string, string>
): string[] {
  return COLUMNS.map((c) => cellValue(b, c.key, roomNumberById));
}

// Neutralize spreadsheet formula injection: a cell whose first character is
// one of = + - @ (or a leading tab/CR) can run as a formula in Excel/Sheets.
// Prefix a single quote so it renders as literal text.
function neutralize(v: string): string {
  if (v === "") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** RFC-4180 field escaping: quote everything, double internal quotes. */
function csvField(v: string): string {
  return `"${neutralize(v).replace(/"/g, '""')}"`;
}

/** Minimal HTML escaping for the .xls HTML-table variant. */
function htmlEscape(v: string): string {
  return neutralize(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build a filename with today's date, e.g. bookings-2026-06-12.csv */
function fileName(ext: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `bookings-${today}.${ext}`;
}

/** Stuff `content` into a Blob and click a temporary <a download>. */
function triggerDownload(content: string, mime: string, name: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Download the filtered bookings as a UTF-8 (BOM) CSV. */
export function exportBookingsCsv(
  rows: Booking[],
  roomNumberById: Record<string, string>
): void {
  const lines = [
    COLUMNS.map((c) => csvField(c.label)).join(","),
    ...rows.map((b) => rowValues(b, roomNumberById).map(csvField).join(",")),
  ];
  // Leading BOM so Excel detects UTF-8 and Thai text isn't garbled.
  const content = "﻿" + lines.join("\r\n");
  triggerDownload(content, "text/csv;charset=utf-8", fileName("csv"));
}

/** Download the filtered bookings as a .xls HTML table (no library). */
export function exportBookingsExcel(
  rows: Booking[],
  roomNumberById: Record<string, string>
): void {
  const head = COLUMNS.map((c) => `<th>${htmlEscape(c.label)}</th>`).join("");
  const body = rows
    .map(
      (b) =>
        `<tr>${rowValues(b, roomNumberById)
          .map((v) => `<td>${htmlEscape(v)}</td>`)
          .join("")}</tr>`
    )
    .join("");
  const html =
    `<html><head><meta charset="utf-8"></head><body>` +
    `<table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` +
    `</body></html>`;
  triggerDownload(html, "application/vnd.ms-excel;charset=utf-8", fileName("xls"));
}
