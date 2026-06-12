// Dependency-free browser exports for the Bookings list page. Both functions
// run in the browser (they touch `document` to trigger a download) — guarded
// with a typeof check so importing them server-side is a no-op rather than a
// crash. CSV is UTF-8 + BOM so Excel renders Thai; the "Excel" export is a
// simple HTML table saved as .xls (Excel opens HTML tables natively), which
// keeps us off any spreadsheet library.

import type { Booking } from "@/lib/db/bookings";

const COLUMNS = [
  "Code",
  "Guest",
  "Phone",
  "Room",
  "Check-in",
  "Check-out",
  "Nights",
  "Status",
  "Source",
  "Total",
] as const;

/** Whole-day diff using UTC anchors so +07 dates don't drift. */
function nights(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn + "T00:00:00Z");
  const b = Date.parse(checkOut + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** The ten cell values for one booking row, in COLUMNS order. */
function rowValues(b: Booking, roomNumberById: Record<string, string>): string[] {
  const room = b.room_id ? roomNumberById[b.room_id] ?? "—" : "—";
  const total = b.total_amount == null ? "" : String(b.total_amount);
  return [
    b.code,
    b.guest_name,
    b.phone ?? "",
    room,
    b.check_in,
    b.check_out,
    String(nights(b.check_in, b.check_out)),
    b.status,
    b.source,
    total,
  ];
}

/** RFC-4180 field escaping: quote everything, double internal quotes. */
function csvField(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

/** Minimal HTML escaping for the .xls HTML-table variant. */
function htmlEscape(v: string): string {
  return v
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
    COLUMNS.map(csvField).join(","),
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
  const head = COLUMNS.map((c) => `<th>${htmlEscape(c)}</th>`).join("");
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
