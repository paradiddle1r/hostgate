// lib/accounting/posting.ts
// ────────────────────────────────────────────────────────────────────────────
// GL engine — TS side. Two kinds of export:
//   1. PURE helpers (unit-tested): double-entry validation, the inclusive-VAT
//      split (parity with money.ts), and the three financial-statement shapers
//      (trial balance / P&L / balance sheet) that turn gl_trial_balance() rows +
//      chart_of_accounts into display structures.
//   2. supabase action/fetch helpers (tenant+property scoped) used by the
//      /accounting page.
//
// The authority for posted numbers is the DB (migration 22 guard trigger +
// auto-posting). These helpers never invent money — they read stored aggregates
// and shape them, or hand balanced payloads to the DB which re-checks balance on
// approval. gl_trial_balance(tenant, property, from, to, includeDrafts) and the
// per-(tenant,property,period) accounting_periods lock are HG-specific.
// ────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTotals, _internal } from "./money";

const { toHundredths } = _internal;

/** Tenant + property scope every DB-touching accounting helper takes. */
export interface TenantScope {
  tenantId: string;
  propertyId: string;
}

export type AccountCategory = "asset" | "liability" | "equity" | "revenue" | "expense";
export type JournalBook = "general" | "sales" | "purchase" | "payment" | "receipt";

export interface Account {
  code: string;
  name_th: string;
  name_en?: string | null;
  category: AccountCategory;
  parent_code?: string | null;
  is_system?: boolean;
  active?: boolean;
  sort_order?: number;
}

export interface TbRow {
  account_code: string;
  opening?: unknown;
  period_debit?: unknown;
  period_credit?: unknown;
}

export interface JournalLineInput {
  account_code?: string;
  debit?: unknown;
  credit?: unknown;
  memo?: string | null;
  sort_order?: number;
}

// ── static metadata ──────────────────────────────────────────────────────────

export const JOURNAL_BOOKS = [
  { v: "general", prefix: "JV", th: "สมุดรายวันทั่วไป", en: "General journal" },
  { v: "sales", prefix: "SV", th: "สมุดรายวันขาย", en: "Sales journal" },
  { v: "purchase", prefix: "PUV", th: "สมุดรายวันซื้อ", en: "Purchase journal" },
  { v: "payment", prefix: "PV", th: "สมุดรายวันจ่ายเงิน", en: "Payment journal" },
  { v: "receipt", prefix: "RV", th: "สมุดรายวันรับเงิน", en: "Receipt journal" },
];
export function bookMeta(v: string) {
  return JOURNAL_BOOKS.find((b) => b.v === v) || { v, prefix: "", th: v, en: v };
}

export const ENTRY_STATUSES = [
  { v: "draft", th: "ร่าง", en: "Draft", color: "#d97706" },
  { v: "approved", th: "อนุมัติแล้ว", en: "Approved", color: "#059669" },
  { v: "void", th: "ยกเลิก", en: "Void", color: "#6b7280" },
];
export function entryStatusMeta(v: string) {
  return ENTRY_STATUSES.find((s) => s.v === v) || { v, th: v, en: v, color: "#6b7280" };
}

// category → normal balance side. asset/expense are debit-normal; the rest are
// credit-normal.
export const ACCOUNT_CATEGORIES = [
  { v: "asset", th: "สินทรัพย์", en: "Assets", normal: "debit" },
  { v: "liability", th: "หนี้สิน", en: "Liabilities", normal: "credit" },
  { v: "equity", th: "ส่วนของเจ้าของ", en: "Equity", normal: "credit" },
  { v: "revenue", th: "รายได้", en: "Revenue", normal: "credit" },
  { v: "expense", th: "ค่าใช้จ่าย", en: "Expenses", normal: "debit" },
] as const;
export function categoryMeta(v: string) {
  return ACCOUNT_CATEGORIES.find((c) => c.v === v) || { v, th: v, en: v, normal: "debit" as const };
}
export function categoryNormal(v: string): "debit" | "credit" {
  return categoryMeta(v).normal;
}

// The posting_account_map keys the auto-posting engine resolves.
export const POSTING_KEYS = [
  "cash", "bank", "ar", "ap", "vat-input", "vat-output", "wht-payable", "deposit-held",
  "revenue-daily", "revenue-monthly", "revenue-service", "revenue-pos", "revenue-utilities",
  "revenue-other", "expense-misc",
];

// ── pure money helpers ───────────────────────────────────────────────────────

/** Round half-away-from-zero to 2dp via the shared integer core. */
export function round2(n: unknown): number {
  return Number(toHundredths(n)) / 100;
}

/**
 * Split a VAT-inclusive gross into {net, vat}. Byte-for-byte parity with
 * money.ts computeTotals. This is what the auto-posting engine does in SQL as
 * `net = total − vat_amount`.
 */
export function netVatFromInclusive(total: number, rate = 7): { net: number; vat: number } {
  const { net, vat } = computeTotals({ lines: [total], vatRate: rate, vatInclusive: true });
  return { net, vat };
}

/** Sum debit / credit sides of a set of lines using exact integer cents. */
export function sumSides(
  lines: ReadonlyArray<{ debit?: unknown; credit?: unknown } | null | undefined> = [],
): { debit: number; credit: number; debitCents: bigint; creditCents: bigint } {
  let dr = 0n;
  let cr = 0n;
  for (const l of lines) {
    if (!l) continue;
    dr += toHundredths(l.debit || 0);
    cr += toHundredths(l.credit || 0);
  }
  return { debit: Number(dr) / 100, credit: Number(cr) / 100, debitCents: dr, creditCents: cr };
}

export interface EntryValidation {
  ok: boolean;
  balanced: boolean;
  totalDebit: number;
  totalCredit: number;
  errors: string[];
}

/**
 * Validate a manual journal entry's lines the same way the DB guard trigger does
 * on approval: ≥2 real lines, each a debit XOR credit, no negatives, and
 * Σdebit = Σcredit > 0.
 */
export function validateEntryLines(
  lines: ReadonlyArray<JournalLineInput | null | undefined> = [],
): EntryValidation {
  const errors: string[] = [];
  const real = lines.filter(
    (l): l is JournalLineInput => !!l && !!(Number(l.debit) || Number(l.credit)),
  );
  if (real.length < 2) errors.push("need-two-lines");
  for (const l of real) {
    if (!l.account_code) errors.push("line-missing-account");
    const d = Number(l.debit) || 0;
    const c = Number(l.credit) || 0;
    if (d > 0 && c > 0) errors.push("line-both-sides");
    if (d < 0 || c < 0) errors.push("line-negative");
  }
  const { debit, credit, debitCents, creditCents } = sumSides(real);
  const balanced = debitCents === creditCents && debitCents > 0n;
  if (!balanced) errors.push("not-balanced");
  return { ok: errors.length === 0, balanced, totalDebit: debit, totalCredit: credit, errors: [...new Set(errors)] };
}

/** Natural (positive-when-normal) period amount for an account row. */
export function naturalAmount(category: string, debit: unknown, credit: unknown): number {
  return categoryNormal(category) === "debit"
    ? round2((Number(debit) || 0) - (Number(credit) || 0))
    : round2((Number(credit) || 0) - (Number(debit) || 0));
}

// ── statement shapers ────────────────────────────────────────────────────────

function indexAccounts(accounts: readonly Account[] = []): Map<string, Account> {
  const m = new Map<string, Account>();
  for (const a of accounts) m.set(a.code, a);
  return m;
}

export interface TrialBalanceRow {
  code: string;
  name_th: string;
  name_en?: string | null;
  category: AccountCategory;
  opening: number;
  period_debit: number;
  period_credit: number;
  closing: number;
}
export interface TrialBalanceTotals {
  openingDr: number;
  openingCr: number;
  debit: number;
  credit: number;
  closingDr: number;
  closingCr: number;
}

/**
 * Trial balance: one row per account with an opening balance or period movement.
 * closing = opening + period_debit − period_credit (signed dr−cr).
 */
export function summarizeTrialBalance(
  tbRows: readonly TbRow[] = [],
  accounts: readonly Account[] = [],
): { rows: TrialBalanceRow[]; totals: TrialBalanceTotals } {
  const acc = indexAccounts(accounts);
  const rows: TrialBalanceRow[] = [];
  const totals: TrialBalanceTotals = { openingDr: 0, openingCr: 0, debit: 0, credit: 0, closingDr: 0, closingCr: 0 };
  for (const r of tbRows) {
    const a: Account =
      acc.get(r.account_code) ||
      { code: r.account_code, name_th: r.account_code, name_en: r.account_code, category: "asset" };
    const opening = Number(r.opening) || 0;
    const pDebit = Number(r.period_debit) || 0;
    const pCredit = Number(r.period_credit) || 0;
    const closing = round2(opening + pDebit - pCredit);
    if (opening === 0 && pDebit === 0 && pCredit === 0) continue;
    rows.push({
      code: a.code, name_th: a.name_th, name_en: a.name_en, category: a.category,
      opening, period_debit: pDebit, period_credit: pCredit, closing,
    });
    totals.openingDr += opening > 0 ? opening : 0;
    totals.openingCr += opening < 0 ? -opening : 0;
    totals.debit += pDebit;
    totals.credit += pCredit;
    totals.closingDr += closing > 0 ? closing : 0;
    totals.closingCr += closing < 0 ? -closing : 0;
  }
  rows.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  (Object.keys(totals) as Array<keyof TrialBalanceTotals>).forEach((k) => {
    totals[k] = round2(totals[k]);
  });
  return { rows, totals };
}

export interface PlLine {
  code: string;
  name_th: string;
  name_en?: string | null;
  month: number;
  ytd: number;
}
export interface ProfitAndLoss {
  revenue: PlLine[];
  expense: PlLine[];
  totalRevenueMonth: number;
  totalRevenueYtd: number;
  totalExpenseMonth: number;
  totalExpenseYtd: number;
  netProfitMonth: number;
  netProfitYtd: number;
}

/** Profit & loss. `monthRows` cover the selected month, `ytdRows` the year-to-date. */
export function buildProfitAndLoss(
  monthRows: readonly TbRow[] = [],
  ytdRows: readonly TbRow[] = [],
  accounts: readonly Account[] = [],
): ProfitAndLoss {
  const acc = indexAccounts(accounts);
  const byCode = (rows: readonly TbRow[]) => {
    const m = new Map<string, TbRow>();
    for (const r of rows) m.set(r.account_code, r);
    return m;
  };
  const mMap = byCode(monthRows);
  const yMap = byCode(ytdRows);
  const codes = new Set([...mMap.keys(), ...yMap.keys()]);

  const revenue: PlLine[] = [];
  const expense: PlLine[] = [];
  let totRevM = 0;
  let totRevY = 0;
  let totExpM = 0;
  let totExpY = 0;
  for (const code of codes) {
    const a = acc.get(code);
    if (!a || (a.category !== "revenue" && a.category !== "expense")) continue;
    const m = mMap.get(code) || ({} as TbRow);
    const y = yMap.get(code) || ({} as TbRow);
    const month = naturalAmount(a.category, m.period_debit, m.period_credit);
    const ytd = naturalAmount(a.category, y.period_debit, y.period_credit);
    if (month === 0 && ytd === 0) continue;
    const line: PlLine = { code: a.code, name_th: a.name_th, name_en: a.name_en, month, ytd };
    if (a.category === "revenue") {
      revenue.push(line);
      totRevM += month;
      totRevY += ytd;
    } else {
      expense.push(line);
      totExpM += month;
      totExpY += ytd;
    }
  }
  revenue.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  expense.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  return {
    revenue,
    expense,
    totalRevenueMonth: round2(totRevM),
    totalRevenueYtd: round2(totRevY),
    totalExpenseMonth: round2(totExpM),
    totalExpenseYtd: round2(totExpY),
    netProfitMonth: round2(totRevM - totExpM),
    netProfitYtd: round2(totRevY - totExpY),
  };
}

export interface BsLine {
  code: string;
  name_th: string;
  name_en?: string | null;
  amount: number;
}
export interface BalanceSheet {
  assets: BsLine[];
  liabilities: BsLine[];
  equity: BsLine[];
  netProfit: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
  difference: number;
}

/**
 * Balance sheet as of a date. `asofRows` = gl_trial_balance(from='1900-01-01',
 * to=asof): period_debit/period_credit are then cumulative movements. Equity
 * carries the current-period profit so the sheet balances.
 */
export function buildBalanceSheet(
  asofRows: readonly TbRow[] = [],
  accounts: readonly Account[] = [],
): BalanceSheet {
  const acc = indexAccounts(accounts);
  const assets: BsLine[] = [];
  const liabilities: BsLine[] = [];
  const equity: BsLine[] = [];
  let totAssets = 0;
  let totLiab = 0;
  let totEquity = 0;
  let revenue = 0;
  let expense = 0;
  for (const r of asofRows) {
    const a = acc.get(r.account_code);
    if (!a) continue;
    const bal = naturalAmount(a.category, r.period_debit, r.period_credit);
    if (bal === 0) continue;
    const line: BsLine = { code: a.code, name_th: a.name_th, name_en: a.name_en, amount: bal };
    if (a.category === "asset") {
      assets.push(line);
      totAssets += bal;
    } else if (a.category === "liability") {
      liabilities.push(line);
      totLiab += bal;
    } else if (a.category === "equity") {
      equity.push(line);
      totEquity += bal;
    } else if (a.category === "revenue") revenue += bal;
    else if (a.category === "expense") expense += bal;
  }
  [assets, liabilities, equity].forEach((g) => g.sort((a, b) => String(a.code).localeCompare(String(b.code))));
  const netProfit = round2(revenue - expense);
  const totalAssets = round2(totAssets);
  const totalLiabilities = round2(totLiab);
  const totalEquity = round2(totEquity + netProfit);
  const difference = round2(totalAssets - (totalLiabilities + totalEquity));
  return {
    assets,
    liabilities,
    equity,
    netProfit,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: round2(totalLiabilities + totalEquity),
    balanced: Math.abs(difference) < 0.01,
    difference,
  };
}

export interface CoaCsvRow {
  code: string;
  name_th: string;
  name_en: string | null;
  category: AccountCategory;
  parent_code: string | null;
  is_system: boolean;
}

/** Parse a chart-of-accounts CSV (code,name[,name_en],category[,parent_code]). */
export function parseCoaCsv(text = ""): { rows: CoaCsvRow[]; errors: string[] } {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], errors: ["empty"] };
  const errors: string[] = [];
  const parseLine = (line: string): string[] => {
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
  };
  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (names: string[]): number => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const ci = {
    code: idx(["code", "รหัส"]),
    th: idx(["name", "name_th", "ชื่อ"]),
    en: idx(["name_en", "english"]),
    cat: idx(["category", "ประเภท"]),
    parent: idx(["parent", "parent_code"]),
  };
  const start = ci.code >= 0 ? 1 : 0;
  const catMap: Record<string, AccountCategory> = {
    asset: "asset", assets: "asset", สินทรัพย์: "asset",
    liability: "liability", liabilities: "liability", หนี้สิน: "liability",
    equity: "equity", ส่วนของเจ้าของ: "equity", ทุน: "equity",
    revenue: "revenue", income: "revenue", รายได้: "revenue",
    expense: "expense", expenses: "expense", ค่าใช้จ่าย: "expense",
  };
  const guessCat = (code: string): AccountCategory =>
    (({ 1: "asset", 2: "liability", 3: "equity", 4: "revenue", 5: "expense" } as Record<string, AccountCategory>)[
      String(code)[0]
    ] || "asset");
  const rows: CoaCsvRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const code = (ci.code >= 0 ? cells[ci.code] : cells[0]) || "";
    if (!code) continue;
    const name_th = (ci.th >= 0 ? cells[ci.th] : cells[1]) || code;
    const name_en = ci.en >= 0 ? cells[ci.en] : null;
    const category = catMap[(ci.cat >= 0 ? cells[ci.cat] : cells[3] || "").toLowerCase()] || guessCat(code);
    const parent_code = (ci.parent >= 0 ? cells[ci.parent] : "") || null;
    rows.push({ code: code.trim(), name_th, name_en: name_en || null, category, parent_code, is_system: false });
  }
  if (!rows.length) errors.push("no-rows");
  return { rows, errors };
}

// ── supabase actions / fetches ───────────────────────────────────────────────

export async function loadAccountMap(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("posting_account_map")
    .select("source_key, account_code")
    .eq("tenant_id", tenantId)
    .eq("property_id", propertyId);
  if (error) throw error;
  const m: Record<string, string> = {};
  for (const r of data || []) m[r.source_key] = r.account_code;
  return m;
}

export async function loadAccounts(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
): Promise<Account[]> {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("code, name_th, name_en, category, parent_code, is_system, active, sort_order")
    .eq("tenant_id", tenantId)
    .eq("property_id", propertyId)
    .order("sort_order");
  if (error) throw error;
  return (data as Account[]) || [];
}

/** Create a manual (general-journal) draft entry from validated balanced lines. */
export async function createManualEntry(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  {
    book = "general",
    entry_date,
    description = "",
    notes = null,
    source_type = "manual",
    lines = [],
  }: {
    book?: JournalBook;
    entry_date: string;
    description?: string;
    notes?: string | null;
    source_type?: string;
    lines?: JournalLineInput[];
  },
) {
  const v = validateEntryLines(lines);
  if (!v.ok) throw new Error("unbalanced: " + v.errors.join(", "));
  const { data: entry, error } = await supabase
    .from("journal_entries")
    .insert({
      tenant_id: tenantId,
      property_id: propertyId,
      book,
      entry_date,
      description: description || null,
      notes,
      source_type,
      status: "draft",
    })
    .select()
    .single();
  if (error) throw error;
  const payload = lines
    .filter((l): l is JournalLineInput => !!l && !!(Number(l.debit) || Number(l.credit)))
    .map((l, i) => ({
      tenant_id: tenantId,
      property_id: propertyId,
      entry_id: entry.id,
      account_code: l.account_code,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      memo: l.memo || null,
      sort_order: i,
    }));
  const { error: e2 } = await supabase.from("journal_lines").insert(payload);
  if (e2) {
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    throw e2;
  }
  return entry;
}

/** Approve a draft entry (DB guard re-checks balance + mints the running number). */
export async function approveEntry(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("journal_entries")
    .update({ status: "approved" })
    .eq("id", id)
    .eq("status", "draft")
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function bulkApproveEntries(supabase: SupabaseClient, ids: string[] = []): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("journal_entries")
    .update({ status: "approved" })
    .in("id", ids)
    .eq("status", "draft");
  if (error) throw error;
}

export async function voidEntry(supabase: SupabaseClient, id: string, reason: string | null = null): Promise<void> {
  const { error } = await supabase
    .from("journal_entries")
    .update({ status: "void", void_reason: reason })
    .eq("id", id)
    .neq("status", "void");
  if (error) throw error;
}

export async function deleteDraftEntry(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("journal_entries").delete().eq("id", id).eq("status", "draft");
  if (error) throw error;
}

export async function fetchTrialBalance(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  { from, to, includeDrafts = false }: { from: string; to: string; includeDrafts?: boolean },
): Promise<TbRow[]> {
  const { data, error } = await supabase.rpc("gl_trial_balance", {
    p_tenant: tenantId,
    p_property: propertyId,
    p_from: from,
    p_to: to,
    p_include_drafts: includeDrafts,
  });
  if (error) throw error;
  return (data as TbRow[]) || [];
}

/** Per-account ledger drill-down for a date range (tenant+property scoped). */
export async function fetchLedger(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  accountCode: string,
  { from, to, includeDrafts = false }: { from?: string; to?: string; includeDrafts?: boolean },
) {
  const { data, error } = await supabase
    .from("journal_lines")
    .select("id, debit, credit, memo, entry:entry_id(id, number, book, entry_date, description, status)")
    .eq("tenant_id", tenantId)
    .eq("property_id", propertyId)
    .eq("account_code", accountCode);
  if (error) throw error;
  const rows = ((data as any[]) || []).filter((r) => {
    const e = Array.isArray(r.entry) ? r.entry[0] : r.entry;
    if (!e) return false;
    if (e.status === "void") return false;
    if (!includeDrafts && e.status !== "approved") return false;
    if (from && e.entry_date < from) return false;
    if (to && e.entry_date > to) return false;
    r.entry = e;
    return true;
  });
  rows.sort(
    (a, b) => String(a.entry.entry_date).localeCompare(String(b.entry.entry_date)) || Number(a.id) - Number(b.id),
  );
  return rows;
}

/** True when an account already carries journal lines (blocks deactivation). */
export async function accountInUse(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  code: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("journal_lines")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("property_id", propertyId)
    .eq("account_code", code);
  if (error) throw error;
  return (count || 0) > 0;
}

export async function upsertAccount(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  account: Partial<Account> & { code: string },
): Promise<void> {
  const { error } = await supabase
    .from("chart_of_accounts")
    .upsert({ ...account, tenant_id: tenantId, property_id: propertyId }, { onConflict: "tenant_id,property_id,code" });
  if (error) throw error;
}

export async function setAccountActive(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  code: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("chart_of_accounts")
    .update({ active })
    .eq("tenant_id", tenantId)
    .eq("property_id", propertyId)
    .eq("code", code);
  if (error) throw error;
}

/** Import COA rows (skips blank codes; upsert by (tenant,property,code)). */
export async function importAccounts(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  rows: Array<Partial<CoaCsvRow>> = [],
): Promise<{ imported: number }> {
  const clean = rows
    .filter((r) => r.code && r.name_th)
    .map((r) => ({
      tenant_id: tenantId,
      property_id: propertyId,
      code: String(r.code).trim(),
      name_th: r.name_th,
      name_en: r.name_en || null,
      category: r.category,
      parent_code: r.parent_code || null,
      is_system: false,
    }));
  if (!clean.length) return { imported: 0 };
  const { error } = await supabase
    .from("chart_of_accounts")
    .upsert(clean, { onConflict: "tenant_id,property_id,code", ignoreDuplicates: false });
  if (error) throw error;
  return { imported: clean.length };
}

/** Close / reopen an accounting period (per tenant+property+month). */
export async function setPeriodStatus(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  period: string,
  status: "open" | "closed",
  uid: string | null = null,
): Promise<void> {
  const base = { tenant_id: tenantId, property_id: propertyId, period, status };
  const row: Record<string, unknown> =
    status === "closed"
      ? { ...base, closed_by: uid, closed_at: new Date().toISOString() }
      : { ...base, reopened_by: uid, reopened_at: new Date().toISOString() };
  const { error } = await supabase
    .from("accounting_periods")
    .upsert(row, { onConflict: "tenant_id,property_id,period" });
  if (error) throw error;
}
