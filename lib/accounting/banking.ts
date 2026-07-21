// lib/accounting/banking.ts
// ────────────────────────────────────────────────────────────────────────────
// Bank reconciliation — TS side (Phase 5).
//   1. PURE helpers (unit-tested):
//      • parseStatementCsv — a forgiving bank-statement CSV parser. Detects
//        either a single signed `amount` column or separate debit/credit
//        columns; accepts DD/MM/YYYY, YYYY-MM-DD and dotted variants; converts
//        Buddhist-era years (>2400 ⇒ −543); strips thousands separators and
//        currency symbols; treats (parentheses) as negative.
//      • suggestMatches — greedy, no-double-match suggester.
//      • paymentCandidate / expenseCandidate — normalise PMS rows into the
//        signed-amount candidate shape (money IN = +, money OUT = −).
//   2. supabase action helpers (import + match/unmatch/ignore), tenant+property
//      scoped. A matched line only records a pointer (matched_type + matched_id)
//      back to the source row — it never invents money.
// ────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";

/** Tenant + property scope every DB-touching accounting helper takes. */
export interface TenantScope {
  tenantId: string;
  propertyId: string;
}

export interface StatementRow {
  txn_date: string;
  description: string;
  amount: number;
  balance: number | null;
}
export interface ParseResult {
  rows: StatementRow[];
  errors: string[];
  layout: string;
}

export interface Candidate {
  id: string | number;
  type: "payment" | "expense";
  amount: number;
  date: string | null;
  method?: string | null;
  label: string;
}

export interface MatchLine {
  id?: string | number;
  txn_date?: string | null;
  amount?: unknown;
  status?: string;
}
export interface MatchSuggestion {
  lineId: string | number | undefined;
  candidate: Candidate;
  dayDiff: number | null;
  sameSign: boolean;
}

// ── small utils ──────────────────────────────────────────────────────────────

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 'YYYY-MM-DD' from a timestamptz / date string (first 10 chars). */
export function dateOnly(ts: unknown): string | null {
  return ts ? String(ts).slice(0, 10) : null;
}

/** Whole-day difference a − b for two 'YYYY-MM-DD' strings (UTC, tz-safe). */
export function dayDiff(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(`${String(a).slice(0, 10)}T00:00:00Z`);
  const tb = Date.parse(`${String(b).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round((ta - tb) / 86400000);
}

/**
 * Parse a possibly-Thai date into 'YYYY-MM-DD'. Handles YYYY-MM-DD, DD/MM/YYYY,
 * DD-MM-YYYY, DD.MM.YYYY and 2-digit years. Buddhist-era years (> 2400) are
 * shifted back 543. Returns null on anything unparseable.
 */
export function parseThaiDate(input: unknown): string | null {
  const s = String(input == null ? "" : input).trim();
  if (!s) return null;
  let y: number;
  let mo: number;
  let d: number;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    y = +m[1];
    mo = +m[2];
    d = +m[3];
  } else {
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (!m) return null;
    d = +m[1];
    mo = +m[2];
    y = m[3].length <= 2 ? 2000 + +m[3] : +m[3];
  }
  if (y > 2400) y -= 543; // Buddhist era → Gregorian
  if (!(mo >= 1 && mo <= 12) || !(d >= 1 && d <= 31)) return null;
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

/**
 * Parse a money cell to a signed number. Strips commas / spaces / currency
 * symbols; treats a leading '-' or wrapping parentheses as negative. Returns
 * null for an empty / non-numeric cell.
 */
export function parseAmount(input: unknown): number | null {
  let s = String(input == null ? "" : input).trim();
  if (!s || s === "-") return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[฿$€£]|thb|บาท/gi, "").replace(/,/g, "").replace(/\s/g, "").trim();
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** Split one CSV line into cells (RFC-4180-ish: quoted fields + "" escape). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "txn date", "transaction date", "posting date", "value date", "date/time", "วันที่", "วันที่ทำรายการ"],
  description: ["description", "desc", "detail", "details", "narrative", "memo", "particulars", "remark", "remarks", "รายการ", "รายละเอียด"],
  debit: ["debit", "withdrawal", "withdrawals", "withdraw", "dr", "debit amount", "ถอน", "ถอนเงิน", "เดบิต", "เงินออก"],
  credit: ["credit", "deposit", "deposits", "cr", "credit amount", "ฝาก", "ฝากเงิน", "เครดิต", "เงินเข้า"],
  amount: ["amount", "value", "จำนวนเงิน", "จำนวน", "มูลค่า"],
  balance: ["balance", "running balance", "ยอดคงเหลือ", "คงเหลือ", "ยอดเงินคงเหลือ"],
};

/** Index of the first header cell matching one of the aliases (exact then substring). */
function findCol(header: string[], aliases: string[]): number {
  for (const a of aliases) {
    const i = header.indexOf(a);
    if (i >= 0) return i;
  }
  for (const a of aliases) {
    const i = header.findIndex((h) => h.includes(a));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Parse a bank-statement CSV. `amount` is signed (+ money in, − money out).
 * Rows with an unparseable date or a zero/empty movement are skipped
 * (headers, sub-totals, opening-balance).
 */
export function parseStatementCsv(text = ""): ParseResult {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], errors: ["empty"], layout: "none" };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = {
    date: findCol(header, HEADER_ALIASES.date),
    description: findCol(header, HEADER_ALIASES.description),
    debit: findCol(header, HEADER_ALIASES.debit),
    credit: findCol(header, HEADER_ALIASES.credit),
    amount: findCol(header, HEADER_ALIASES.amount),
    balance: findCol(header, HEADER_ALIASES.balance),
  };
  const hasHeader = col.date >= 0 || col.amount >= 0 || (col.debit >= 0 && col.credit >= 0);

  let layout: string;
  let start: number;
  let di: number;
  let descI: number;
  let amtI = -1;
  let debI = -1;
  let credI = -1;
  let balI: number;
  if (hasHeader) {
    start = 1;
    di = col.date >= 0 ? col.date : 0;
    descI = col.description;
    balI = col.balance;
    if (col.debit >= 0 && col.credit >= 0) {
      layout = "debit-credit";
      debI = col.debit;
      credI = col.credit;
    } else {
      layout = "amount";
      amtI = col.amount >= 0 ? col.amount : 2;
    }
  } else {
    // headerless positional guess: date, description, amount, balance
    layout = "positional";
    start = 0;
    di = 0;
    descI = 1;
    amtI = 2;
    balI = 3;
  }

  const rows: StatementRow[] = [];
  const errors: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const c = splitCsvLine(lines[i]);
    const txn_date = parseThaiDate(c[di]);
    if (!txn_date) continue; // skip junk / summary / header rows
    let amount: number | null;
    if (layout === "debit-credit") {
      const dr = parseAmount(c[debI]);
      const cr = parseAmount(c[credI]);
      if (dr == null && cr == null) continue;
      amount = (cr || 0) - (dr || 0);
    } else {
      amount = parseAmount(c[amtI]);
      if (amount == null) continue;
    }
    if (!amount) continue; // zero movement — nothing to reconcile
    const description = (descI != null && descI >= 0 ? c[descI] : "") || "";
    const balance = balI != null && balI >= 0 ? parseAmount(c[balI]) : null;
    rows.push({ txn_date, description, amount: round2(amount), balance });
  }
  if (!rows.length) errors.push("no-rows");
  return { rows, errors, layout };
}

/** round half-away-from-zero to 2dp (parser amounts are already ≤2dp). */
function round2(n: unknown): number {
  const x = Number(n) || 0;
  return (x >= 0 ? Math.round(x * 100) : -Math.round(-x * 100)) / 100;
}

// ── candidate builders ───────────────────────────────────────────────────────

/** A PMS payment (money IN) → positive-amount candidate. */
export function paymentCandidate(p: {
  id: string | number;
  amount?: unknown;
  paid_at?: unknown;
  method?: string | null;
  reference?: string | null;
  invoice_id?: string | number | null;
}): Candidate {
  return {
    id: p.id,
    type: "payment",
    amount: Number(p.amount) || 0,
    date: dateOnly(p.paid_at),
    method: p.method || null,
    label: p.reference || `#${p.invoice_id ?? ""}`,
  };
}

/** A paid expense (money OUT) → negative-amount candidate (net of WHT paid). */
export function expenseCandidate(e: {
  id: string | number;
  total?: unknown;
  wht_amount?: unknown;
  paid_at?: unknown;
  expense_date?: unknown;
  description?: string | null;
  doc_ref?: string | null;
}): Candidate {
  const paid = (Number(e.total) || 0) - (Number(e.wht_amount) || 0);
  return {
    id: e.id,
    type: "expense",
    amount: -round2(paid),
    date: dateOnly(e.paid_at || e.expense_date),
    label: e.description || e.doc_ref || `#${e.id}`,
  };
}

// ── matcher ──────────────────────────────────────────────────────────────────

/**
 * Suggest at most one candidate per unmatched line. Greedy + no-double-match:
 * a candidate suggested to one line is not offered to another. A match needs the
 * absolute amounts equal within `tolerance` and dates within ±windowDays;
 * same-sign (direction-correct) candidates are preferred, then the closest date.
 */
export function suggestMatches(
  lines: readonly MatchLine[] = [],
  candidates: readonly Candidate[] = [],
  { windowDays = 3, tolerance = 0.01 }: { windowDays?: number; tolerance?: number } = {},
): MatchSuggestion[] {
  const open = lines
    .filter((l) => (l.status ?? "unmatched") === "unmatched")
    .slice()
    .sort(
      (a, b) =>
        String(a.txn_date).localeCompare(String(b.txn_date)) ||
        (Number(a.id ?? 0) - Number(b.id ?? 0)),
    );
  const used = new Set<string>();
  const out: MatchSuggestion[] = [];
  for (const line of open) {
    const la = Math.abs(Number(line.amount) || 0);
    const ls = Math.sign(Number(line.amount) || 0);
    let best: { candidate: Candidate; dayDiff: number; sameSign: boolean; score: number } | null = null;
    for (const cand of candidates) {
      const key = `${cand.type}:${cand.id}`;
      if (used.has(key)) continue;
      const ca = Math.abs(Number(cand.amount) || 0);
      if (Math.abs(la - ca) > tolerance) continue;
      const dd = dayDiff(line.txn_date, cand.date);
      if (dd == null || Math.abs(dd) > windowDays) continue;
      const sameSign = ls === Math.sign(Number(cand.amount) || 0);
      const score = Math.abs(dd) * 2 + (sameSign ? 0 : 1);
      if (!best || score < best.score) best = { candidate: cand, dayDiff: dd, sameSign, score };
    }
    if (best) {
      used.add(`${best.candidate.type}:${best.candidate.id}`);
      out.push({ lineId: line.id, candidate: best.candidate, dayDiff: best.dayDiff, sameSign: best.sameSign });
    }
  }
  return out;
}

// ── supabase actions ─────────────────────────────────────────────────────────

/** Insert a statement + its lines (tenant+property scoped). period_from/to
 *  auto-derived from the rows. */
export async function importStatement(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  {
    bankAccountId,
    filename,
    rows = [],
    importedBy = null,
  }: {
    bankAccountId: string;
    filename?: string | null;
    rows?: StatementRow[];
    importedBy?: string | null;
  },
): Promise<{ statementId: string; count: number }> {
  if (!bankAccountId) throw new Error("no-bank-account");
  if (!rows.length) throw new Error("no-rows");
  const dates = rows.map((r) => r.txn_date).filter(Boolean).sort();
  const { data: stmt, error } = await supabase
    .from("bank_statements")
    .insert({
      tenant_id: tenantId,
      property_id: propertyId,
      bank_account_id: bankAccountId,
      filename: filename || null,
      period_from: dates[0] || null,
      period_to: dates[dates.length - 1] || null,
      imported_by: importedBy,
    })
    .select("id")
    .single();
  if (error) throw error;
  const payload = rows.map((r) => ({
    tenant_id: tenantId,
    property_id: propertyId,
    statement_id: stmt.id,
    txn_date: r.txn_date,
    description: r.description || null,
    amount: r.amount,
    balance: r.balance ?? null,
    status: "unmatched",
  }));
  const { error: e2 } = await supabase.from("bank_statement_lines").insert(payload);
  if (e2) {
    await supabase.from("bank_statements").delete().eq("id", stmt.id);
    throw e2;
  }
  return { statementId: stmt.id, count: payload.length };
}

export async function applyMatch(
  supabase: SupabaseClient,
  lineId: string,
  { type, id }: { type: "payment" | "expense" | "journal"; id: string },
): Promise<void> {
  const { error } = await supabase
    .from("bank_statement_lines")
    .update({ matched_type: type, matched_id: id, status: "matched" })
    .eq("id", lineId);
  if (error) throw error;
}

export async function unmatchLine(supabase: SupabaseClient, lineId: string): Promise<void> {
  const { error } = await supabase
    .from("bank_statement_lines")
    .update({ matched_type: null, matched_id: null, status: "unmatched" })
    .eq("id", lineId);
  if (error) throw error;
}

export async function ignoreLine(supabase: SupabaseClient, lineId: string): Promise<void> {
  const { error } = await supabase
    .from("bank_statement_lines")
    .update({ matched_type: null, matched_id: null, status: "ignored" })
    .eq("id", lineId);
  if (error) throw error;
}
