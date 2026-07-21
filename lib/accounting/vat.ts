// lib/accounting/vat.ts
// ────────────────────────────────────────────────────────────────────────────
// VAT reports — TS side (Phase 4). Two kinds of export:
//   1. PURE helpers (unit-tested): report summarisers, the ภ.พ.30 (PP30)
//      summary math, Buddhist-era date formatting, month labels, and the
//      RD-format CSV builders (รายงานภาษีขาย / รายงานภาษีซื้อ).
//   2. supabase fetch helpers that call the SECURITY DEFINER report functions
//      vat_sales_report / vat_purchase_report (migration 24) — both take
//      (tenant, property, year, month).
//
// The authority for the numbers is the DB: the report RPCs already do
// net = total − vat_amount and stamp credit-notes NEGATIVE. These helpers only
// total / shape / format — they never re-derive VAT. Money totals use the exact
// integer-cents core from money.ts so a CSV total never drifts by a satang.
// ────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { _internal } from "./money";

const { toHundredths } = _internal;

/** Tenant + property scope every DB-touching accounting helper takes. */
export interface TenantScope {
  tenantId: string;
  propertyId: string;
}

/** A report row as returned by the RPCs / passed to the shapers. Loosely typed
 *  because PostgREST returns numerics as strings; the helpers coerce. */
export type ReportRow = Record<string, unknown>;

// ── exact money helpers (parity with money.ts / the DB) ──────────────────────

/** Round half-away-from-zero to 2dp via the shared integer core. */
export function round2(n: unknown): number {
  return Number(toHundredths(n)) / 100;
}

/** Sum a numeric field across rows using exact integer cents (no float drift). */
function sumCents(rows: readonly ReportRow[] | null | undefined, field: string): bigint {
  let c = 0n;
  for (const r of rows || []) c += toHundredths(r?.[field] ?? 0);
  return c;
}

// ── calendar helpers ─────────────────────────────────────────────────────────

export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
export const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Human month label. th → "กรกฎาคม 2569" (Buddhist era), en → "July 2026". */
export function monthLabel(year: unknown, month: unknown, lang: "th" | "en" = "th"): string {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return "";
  return lang === "th" ? `${THAI_MONTHS[m - 1]} ${y + 543}` : `${EN_MONTHS[m - 1]} ${y}`;
}

/**
 * Format a yyyy-mm-dd date string as Thai RD "DD/MM/YYYY" with a Buddhist-era
 * year (Gregorian + 543). e.g. "2026-07-15" → "15/07/2569". Returns '' for null.
 */
export function formatBEDate(iso: unknown): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${Number(y) + 543}`;
}

// ── report summarisers ───────────────────────────────────────────────────────

export interface ReportSummary {
  count: number;
  net: number;
  vat: number;
}

/**
 * Total a VAT report's rows. `net_amount` / `vat_amount` already carry the sign
 * from the DB (credit-notes are negative), so a plain sum is correct.
 */
export function summarizeReport(rows: readonly ReportRow[] = []): ReportSummary {
  return {
    count: (rows || []).length,
    net: Number(sumCents(rows, "net_amount")) / 100,
    vat: Number(sumCents(rows, "vat_amount")) / 100,
  };
}
export const summarizeSalesReport = summarizeReport;
export const summarizePurchaseReport = summarizeReport;

export interface PhoPho30 {
  salesTotal: number;
  outputVat: number;
  purchaseTotal: number;
  inputVat: number;
  vatPayable: number;
  vatCreditCarry: number;
}

/**
 * ภ.พ.30 (PP30) summary math.
 *   vatPayable     = max(0, outputVat − inputVat)   (VAT owed to the RD)
 *   vatCreditCarry = max(0, inputVat − outputVat)   (credit carried forward)
 * Exactly one of the two is non-zero (or both zero when they net out).
 */
export function computePhoPho30({
  salesTotal = 0,
  outputVat = 0,
  purchaseTotal = 0,
  inputVat = 0,
}: Partial<Pick<PhoPho30, "salesTotal" | "outputVat" | "purchaseTotal" | "inputVat">> = {}): PhoPho30 {
  const out = round2(outputVat);
  const inp = round2(inputVat);
  const diff = round2(out - inp);
  return {
    salesTotal: round2(salesTotal),
    outputVat: out,
    purchaseTotal: round2(purchaseTotal),
    inputVat: inp,
    vatPayable: diff > 0 ? diff : 0,
    vatCreditCarry: diff < 0 ? round2(-diff) : 0,
  };
}

/** Convenience: derive the ภ.พ.30 summary straight from the two report row sets. */
export function pho30FromReports(
  salesRows: readonly ReportRow[] = [],
  purchaseRows: readonly ReportRow[] = [],
): PhoPho30 {
  const s = summarizeReport(salesRows);
  const p = summarizeReport(purchaseRows);
  return computePhoPho30({ salesTotal: s.net, outputVat: s.vat, purchaseTotal: p.net, inputVat: p.vat });
}

// ── CSV builders (Thai Revenue Dept column layout) ───────────────────────────

// รายงานภาษีขาย — sales VAT report columns.
export const SALES_CSV_HEADERS = [
  "ลำดับ", "วัน/เดือน/ปี", "เลขที่ใบกำกับภาษี", "ชื่อผู้ซื้อสินค้า/ผู้รับบริการ",
  "เลขประจำตัวผู้เสียภาษี", "สาขา", "มูลค่าสินค้า/บริการ", "จำนวนเงินภาษีมูลค่าเพิ่ม",
];
// รายงานภาษีซื้อ — purchase VAT report columns.
export const PURCHASE_CSV_HEADERS = [
  "ลำดับ", "วัน/เดือน/ปี", "เลขที่ใบกำกับภาษี", "ชื่อผู้ขายสินค้า/ผู้ให้บริการ",
  "เลขประจำตัวผู้เสียภาษี", "สาขา", "มูลค่าสินค้า/บริการ", "จำนวนเงินภาษีมูลค่าเพิ่ม",
];

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}
function amt(n: unknown): string {
  return round2(n).toFixed(2);
}

function buildReportCsv(
  headers: string[],
  rows: readonly ReportRow[] | null | undefined,
  { docField, nameField }: { docField: string; nameField: string },
): string {
  const totalNet = Number(sumCents(rows, "net_amount")) / 100;
  const totalVat = Number(sumCents(rows, "vat_amount")) / 100;
  const lines = [csvRow(headers)];
  for (const r of rows || []) {
    lines.push(
      csvRow([
        r.seq, formatBEDate(r.doc_date), r[docField] || "", r[nameField] || "",
        r.tax_id || "", r.branch || "", amt(r.net_amount), amt(r.vat_amount),
      ]),
    );
  }
  lines.push(csvRow(["รวม", "", "", "", "", "", amt(totalNet), amt(totalVat)]));
  return lines.join("\r\n");
}

/** Sales VAT report → CSV text (no BOM; the caller prepends ﻿ for Excel). */
export function buildSalesReportCsv(rows: readonly ReportRow[] = []): string {
  return buildReportCsv(SALES_CSV_HEADERS, rows, { docField: "doc_number", nameField: "customer_name" });
}
/** Purchase VAT report → CSV text (no BOM; the caller prepends ﻿ for Excel). */
export function buildPurchaseReportCsv(rows: readonly ReportRow[] = []): string {
  return buildReportCsv(PURCHASE_CSV_HEADERS, rows, { docField: "doc_ref", nameField: "vendor_name" });
}

// ── supabase fetch helpers ───────────────────────────────────────────────────

// PostgREST returns numeric as strings; coerce so shapers/CSV get real numbers.
function normNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function normSalesRow(r: ReportRow): ReportRow {
  return { ...r, seq: Number(r.seq), net_amount: normNum(r.net_amount), vat_amount: normNum(r.vat_amount) };
}

export async function fetchVatSalesReport(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  year: number,
  month: number,
): Promise<ReportRow[]> {
  const { data, error } = await supabase.rpc("vat_sales_report", {
    p_tenant: tenantId,
    p_property: propertyId,
    p_year: Number(year),
    p_month: Number(month),
  });
  if (error) throw error;
  return ((data as ReportRow[]) || []).map(normSalesRow);
}

export async function fetchVatPurchaseReport(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  year: number,
  month: number,
): Promise<ReportRow[]> {
  const { data, error } = await supabase.rpc("vat_purchase_report", {
    p_tenant: tenantId,
    p_property: propertyId,
    p_year: Number(year),
    p_month: Number(month),
  });
  if (error) throw error;
  return ((data as ReportRow[]) || []).map(normSalesRow);
}
