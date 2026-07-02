// Dependency-free browser export for the Guests list page — same pattern as
// lib/bookings-export.ts. Runs in the browser only (touches `document` to
// trigger a download); guarded with a typeof check so importing it
// server-side is a no-op rather than a crash. CSV is UTF-8 + BOM so Excel
// renders Thai correctly.
//
// Columns are the guest identity fields plus the per-guest stay rollup
// (visits/nights/spend/lastStay) computed server-side in app/app/guests/page.tsx.
// Free-text cells are guarded against spreadsheet formula injection (a leading
// = + - @ can be executed by Excel/Sheets) by prefixing a single quote.

import type { Guest } from "@/lib/db/guests";

// Minimal shape of the per-guest stats this export needs — matches the
// `GuestStat` computed in app/app/guests/page.tsx and passed down to
// GuestsClient (visits/nights/spend/lastStay subset; inHouseRoomId unused here).
export interface GuestExportStat {
  visits: number;
  nights: number;
  spend: number;
  lastStay: string | null;
}

const EMPTY_STAT: GuestExportStat = { visits: 0, nights: 0, spend: 0, lastStay: null };

const COLUMNS = [
  "Name",
  "Thai name",
  "Phone",
  "Email",
  "Visits",
  "Nights",
  "Spend",
  "Last stay",
] as const;

/** The cell values for one guest row, in COLUMNS order. */
export function rowValues(
  g: Guest,
  statsByGuestId: Record<string, GuestExportStat>
): string[] {
  const st = statsByGuestId[g.id] ?? EMPTY_STAT;
  return [
    g.full_name ?? "",
    g.thai_name ?? "",
    g.phone ?? "",
    g.email ?? "",
    String(st.visits),
    String(st.nights),
    String(st.spend),
    st.lastStay ?? "",
  ];
}

// Neutralize spreadsheet formula injection: a cell whose first character is
// one of = + - @ (or a leading tab/CR) can run as a formula in Excel/Sheets.
// Prefix a single quote so it renders as literal text.
export function neutralize(v: string): string {
  if (v === "") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** RFC-4180 field escaping: quote everything, double internal quotes. */
export function csvField(v: string): string {
  return `"${neutralize(v).replace(/"/g, '""')}"`;
}

/** Build a filename with today's date, e.g. guests-2026-06-12.csv */
function fileName(ext: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `guests-${today}.${ext}`;
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

/** Download the visible guests as a UTF-8 (BOM) CSV. */
export function exportGuestsCsv(
  rows: Guest[],
  statsByGuestId: Record<string, GuestExportStat>
): void {
  const lines = [
    COLUMNS.map(csvField).join(","),
    ...rows.map((g) => rowValues(g, statsByGuestId).map(csvField).join(",")),
  ];
  // Leading BOM so Excel detects UTF-8 and Thai text isn't garbled.
  const content = "﻿" + lines.join("\r\n");
  triggerDownload(content, "text/csv;charset=utf-8", fileName("csv"));
}
