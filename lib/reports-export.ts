// Dependency-free browser export for the Reports "Direct vs OTA" tab — same
// pattern as lib/guests-export.ts / lib/bookings-export.ts. Runs in the
// browser only (touches `document` to trigger a download); guarded with a
// typeof check so importing it server-side is a no-op rather than a crash.
// CSV is UTF-8 + BOM so Excel renders Thai correctly.
//
// One row per month (direct vs OTA+walk-in revenue/bookings, the same
// `summary` rows ReportsClient's directOta charts read), plus a totals row
// and an estimated-commission-savings row sourced from the same `kpis`
// object the KPI cards use. Free-text cells are guarded against spreadsheet
// formula injection (a leading = + - @ can be executed by Excel/Sheets) by
// prefixing a single quote.

import type { MonthRow, Kpis } from "@/components/app/reports/ReportsClient";

const COLUMNS = [
  "Month",
  "Direct revenue",
  "OTA + walk-in revenue",
  "Direct bookings",
  "OTA + walk-in bookings",
] as const;

/** The cell values for one month row, in COLUMNS order. */
export function rowValues(r: MonthRow): string[] {
  return [
    r.month,
    String(r.directRevenue),
    String(r.otaRevenue),
    String(r.directBookings),
    String(r.otaBookings),
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

/** Build a filename with today's date, e.g. direct-vs-ota-2026-07-05.csv */
function fileName(ext: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `direct-vs-ota-${today}.${ext}`;
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

/**
 * Download the per-month Direct vs OTA+walk-in rows, plus a totals row and
 * an estimated commission-savings row (see lib/commission-savings.ts — an
 * illustrative estimate, not a real contracted OTA rate), as a UTF-8 (BOM) CSV.
 */
export function exportDirectOtaCsv(rows: MonthRow[], kpis: Kpis, currency: string): void {
  const lines = [
    COLUMNS.map(csvField).join(","),
    ...rows.map((r) => rowValues(r).map(csvField).join(",")),
    "",
    [
      "Total",
      String(kpis.directRevenue),
      String(kpis.otaRevenue),
      String(kpis.directBookings),
      String(kpis.otaBookings),
    ]
      .map(csvField)
      .join(","),
    [`Est. commission savings (${currency})`, String(kpis.commissionSavings), "", "", ""]
      .map(csvField)
      .join(","),
  ];
  // Leading BOM so Excel detects UTF-8 and Thai text isn't garbled.
  const content = "﻿" + lines.join("\r\n");
  triggerDownload(content, "text/csv;charset=utf-8", fileName("csv"));
}
