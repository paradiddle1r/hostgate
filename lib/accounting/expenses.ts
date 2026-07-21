// lib/accounting/expenses.ts
// ────────────────────────────────────────────────────────────────────────────
// Expenses (AP) + withholding-tax core (Phase 2). One place for:
//   • computeExpenseTotals — the TS twin of recompute_expense_totals()
//     (migration 21). Same inclusive/exclusive VAT contract as the sales
//     documents, plus WHT on the pre-VAT net. Pure + unit-tested.
//   • WHT certificate helpers — prefill from a paid expense (or standalone),
//     Thai name split, RD-Prep (ภ.ง.ด.3/53) attachment text builder. Pure.
//   • supabase I/O — expenses CRUD + markPaid, WHT cert create/void
//     (tenant+property scoped; WHT number via issue_wht_number(tenant, property)).
//
// Money math for STORAGE is owned by the DB trigger; computeExpenseTotals is for
// live editor previews / reports only. Kept byte-for-byte compatible with the DB.
// ────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTotals, _internal, type MoneyLine } from "./money";

const { toHundredths, roundDivAway } = _internal;

// Re-export the money formatter surface for callers.
export { fmtBaht } from "./format";

/** Tenant + property scope every DB-touching accounting helper takes. */
export interface TenantScope {
  tenantId: string;
  propertyId: string;
}

// ── metadata (bilingual) ─────────────────────────────────────────────────────

// Standard Thai WHT rates offered in the editor (%). 0 = no withholding.
export const WHT_RATE_OPTIONS = [0, 1, 2, 3, 5, 10];

export const EXPENSE_STATUSES = [
  { v: "draft", en: "Draft", th: "ฉบับร่าง", color: "#d97706" },
  { v: "pending", en: "Pending", th: "รอจ่าย", color: "#7c3aed" },
  { v: "paid", en: "Paid", th: "จ่ายแล้ว", color: "#16a34a" },
  { v: "void", en: "Void", th: "ยกเลิก", color: "#6b7280" },
];
export function expenseStatusMeta(v: string) {
  return EXPENSE_STATUSES.find((s) => s.v === v) || EXPENSE_STATUSES[0];
}

// ภ.ง.ด.3 = บุคคลธรรมดา (individuals) · ภ.ง.ด.53 = นิติบุคคล (juristic persons)
export const PND_TYPES = [
  { v: "pnd3", en: "P.N.D.3 (individual)", th: "ภ.ง.ด.3 (บุคคลธรรมดา)" },
  { v: "pnd53", en: "P.N.D.53 (juristic)", th: "ภ.ง.ด.53 (นิติบุคคล)" },
];
export function pndTypeMeta(v: string) {
  return PND_TYPES.find((p) => p.v === v) || PND_TYPES[0];
}

// Common 50 ทวิ income categories (มาตรา 40) with a typical rate hint.
export const INCOME_TYPES = [
  { code: "1", th: "ค่าจ้าง/เงินเดือน (มาตรา 40(1))", en: "Salary/wages", rate: 0 },
  { code: "2", th: "ค่าธรรมเนียม/ค่านายหน้า (มาตรา 40(2))", en: "Fees/commission", rate: 3 },
  { code: "3", th: "ค่าลิขสิทธิ์ (มาตรา 40(3))", en: "Royalties", rate: 3 },
  { code: "4", th: "ดอกเบี้ย/เงินปันผล (มาตรา 40(4))", en: "Interest/dividend", rate: 1 },
  { code: "5", th: "ค่าเช่า (มาตรา 40(5))", en: "Rent", rate: 5 },
  { code: "6", th: "ค่าวิชาชีพอิสระ (มาตรา 40(6))", en: "Professional fees", rate: 3 },
  { code: "7", th: "ค่าจ้างทำของ/ค่าบริการ (มาตรา 40(7)(8))", en: "Contract/service work", rate: 3 },
  { code: "8", th: "ค่าโฆษณา", en: "Advertising", rate: 2 },
  { code: "9", th: "ค่าขนส่ง", en: "Transport", rate: 1 },
];

// ── small utils ──────────────────────────────────────────────────────────────
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clean = <T>(v: T): T | null => (v === undefined || (v as unknown) === "" ? null : v);

/** Local (Asia/Bangkok) YYYY-MM-DD, matching the +07 seam used across the app. */
export function todayBkk(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ── pure math ─────────────────────────────────────────────────────────────────

export interface ExpenseTotals {
  subtotal: number;
  net: number;
  vat: number;
  total: number;
  whtAmount: number;
  netPayable: number;
}

/**
 * Compute expense totals, byte-for-byte compatible with recompute_expense_totals()
 * (migration 21). wht = round(net * whtRate/100, 2) on the pre-VAT base.
 * netPayable = total − whtAmount (cash actually paid to the vendor).
 */
export function computeExpenseTotals({
  lines = [],
  vatRate = 0,
  vatInclusive = false,
  whtRate = 0,
}: {
  lines?: readonly MoneyLine[];
  vatRate?: number | string | null;
  vatInclusive?: boolean;
  whtRate?: number | string | null;
} = {}): ExpenseTotals {
  const base = computeTotals({ lines, discount: 0, vatRate, vatInclusive });
  const netCents = toHundredths(base.net);
  const rateCents = toHundredths(whtRate); // whtRate × 100
  const whtCents = roundDivAway(netCents * rateCents, 10000n);
  const totalCents = toHundredths(base.total);
  return {
    subtotal: base.subtotal,
    net: base.net,
    vat: base.vat,
    total: base.total,
    whtAmount: Number(whtCents) / 100,
    netPayable: Number(totalCents - whtCents) / 100,
  };
}

// ── WHT helpers (pure) ────────────────────────────────────────────────────────

const THAI_TITLES = ["นางสาว", "นาง", "นาย", "ด.ช.", "ด.ญ."];

/**
 * Split a Thai personal name into { title, first, last } for the RD-Prep file.
 * Companies keep the whole legal name in `first` (title/last blank).
 */
export function splitThaiName(
  name: unknown,
  isCompany = false,
): { title: string; first: string; last: string } {
  const full = String(name || "").trim();
  if (!full) return { title: "", first: "", last: "" };
  if (isCompany) return { title: "", first: full, last: "" };
  let title = "";
  let rest = full;
  for (const t of THAI_TITLES) {
    if (rest.startsWith(t)) {
      title = t;
      rest = rest.slice(t.length).trim();
      break;
    }
  }
  const parts = rest.split(/\s+/).filter(Boolean);
  const first = parts.shift() || "";
  const last = parts.join(" ");
  return { title, first, last };
}

/** ISO YYYY-MM-DD → DD/MM/YYYY with a Buddhist-era year (RD-Prep convention). */
export function formatRdDate(iso: unknown): string {
  const s = String(iso || "").slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${Number(y) + 543}`;
}

const digitsOnly = (v: unknown): string => String(v || "").replace(/\D/g, "");
const oneLine = (v: unknown): string => String(v || "").replace(/[\r\n|]+/g, " ").trim();
const money2 = (v: unknown): string => num(v).toFixed(2);
const rateStr = (v: unknown): string => {
  const n = num(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

export interface WhtRowInput {
  payee_name?: string | null;
  name?: string | null;
  is_company?: boolean;
  payee_tax_id?: string | null;
  tax_id?: string | null;
  payee_address?: string | null;
  address?: string | null;
  payment_date?: string | null;
  income_type_code?: string | null;
  income_type?: string | null;
  wht_rate?: unknown;
  amount_paid?: unknown;
  wht_amount?: unknown;
  tax_condition?: string | null;
}

/**
 * Build the RD-Prep (ภ.ง.ด.3 / ภ.ง.ด.53) attachment text file — best-effort,
 * pipe-delimited, one row per certificate, CRLF line endings. 12 columns:
 *   sequence | taxId(13) | title | firstName | lastName | address |
 *   paymentDate(DD/MM/BE) | incomeTypeCode | rate | amountPaid | whtAmount | condition
 */
export function buildRdPrepTxt(
  rows: readonly WhtRowInput[] = [],
  { pndType = "pnd3" }: { pndType?: "pnd3" | "pnd53" } = {},
): string {
  const isCompany = pndType === "pnd53";
  const cell = (v: unknown): string => String(v == null ? "" : v).replace(/[|\r\n]+/g, " ");
  const lines = (rows || []).map((r, i) => {
    const nm = splitThaiName(r.payee_name || r.name || "", isCompany || !!r.is_company);
    return [
      i + 1,
      digitsOnly(r.payee_tax_id || r.tax_id),
      nm.title,
      nm.first,
      nm.last,
      oneLine(r.payee_address || r.address),
      formatRdDate(r.payment_date),
      r.income_type_code || r.income_type || "",
      rateStr(r.wht_rate),
      money2(r.amount_paid),
      money2(r.wht_amount),
      r.tax_condition || "1",
    ]
      .map(cell)
      .join("|");
  });
  return lines.join("\r\n");
}

/** Compose a single-line address from a contact record. Pure. */
export function composeContactAddress(c: { address?: string | null; zipcode?: string | null } = {}): string {
  return [c.address, c.zipcode].filter(Boolean).join(" ").trim();
}

interface ContactLike {
  id?: string | number | null;
  is_company?: boolean;
  name?: string | null;
  tax_id?: string | null;
  branch?: string | null;
  address?: string | null;
  zipcode?: string | null;
}
interface ExpenseLike {
  id?: string | number | null;
  contact_id?: string | number | null;
  total?: unknown;
  vat_amount?: unknown;
  wht_rate?: unknown;
  wht_amount?: unknown;
  description?: string | null;
  paid_at?: string | null;
}

/**
 * Prefill a WHT certificate draft from an expense (+ its vendor contact). The
 * base amount is the expense's pre-VAT net (total − vat). pnd_type follows the
 * contact type (company → pnd53, else pnd3). Pure.
 */
export function whtCertPrefillFromExpense(expense: ExpenseLike = {}, contact: ContactLike | null = null) {
  const c: ContactLike = contact || {};
  const net = num(expense.total) - num(expense.vat_amount);
  return {
    expense_id: expense.id ?? null,
    contact_id: expense.contact_id ?? c.id ?? null,
    pnd_type: c.is_company ? "pnd53" : "pnd3",
    income_type: "",
    income_desc: expense.description || "",
    payee_name: c.name || "",
    payee_tax_id: c.tax_id || "",
    payee_branch: c.branch || "",
    payee_address: composeContactAddress(c),
    payment_date: expense.paid_at ? String(expense.paid_at).slice(0, 10) : todayBkk(),
    amount_paid: num(Number(net.toFixed(2))),
    wht_rate: num(expense.wht_rate),
    wht_amount: num(expense.wht_amount),
    tax_condition: "1",
  };
}

/** Blank standalone WHT certificate draft (optionally seeded by a contact). Pure. */
export function newWhtCertDraft(contact: ContactLike | null = null) {
  const c: ContactLike = contact || {};
  return {
    expense_id: null,
    contact_id: c.id ?? null,
    pnd_type: c.is_company ? "pnd53" : "pnd3",
    income_type: "",
    income_desc: "",
    payee_name: c.name || "",
    payee_tax_id: c.tax_id || "",
    payee_branch: c.branch || "",
    payee_address: composeContactAddress(c),
    payment_date: todayBkk(),
    amount_paid: 0,
    wht_rate: 3,
    wht_amount: 0,
    tax_condition: "1",
  };
}

/** WHT amount for a standalone cert = round(base * rate/100, 2). Pure, DB-exact. */
export function whtAmountFor(amountPaid: unknown, whtRate: unknown): number {
  const baseCents = toHundredths(amountPaid);
  const rateCents = toHundredths(whtRate);
  return Number(roundDivAway(baseCents * rateCents, 10000n)) / 100;
}

// Columns each table accepts on insert/update (drops editor-only bits).
const EXPENSE_COLS = [
  "expense_date", "contact_id", "category_account_code", "description", "doc_ref",
  "receipt_image_path", "currency", "vat_rate", "vat_inclusive", "wht_rate",
  "status", "paid_at", "payment_method", "payment_ref", "notes",
];
const WHT_COLS = [
  "number", "expense_id", "contact_id", "pnd_type", "income_type", "income_desc",
  "payee_name", "payee_tax_id", "payee_branch", "payee_address", "payment_date",
  "amount_paid", "wht_rate", "wht_amount", "tax_condition", "status",
];

function pick(cols: string[], obj: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of cols) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
export const pickExpenseColumns = (o: Record<string, unknown>) => pick(EXPENSE_COLS, o);
export const pickWhtColumns = (o: Record<string, unknown>) => pick(WHT_COLS, o);

/** Strip a line list down to the expense_items insert shape. Pure. */
export function mapExpenseItems(
  items: ReadonlyArray<Record<string, unknown>> = [],
): Array<{ sort_order: number; description: string; unit: string | null; qty: number; unit_price: number }> {
  return (items || []).map((it, i) => ({
    sort_order: (it.sort_order as number) ?? i,
    description: (it.description as string) || "",
    unit: clean(it.unit as string | null),
    qty: num(it.qty),
    unit_price: num(it.unit_price),
  }));
}

// ── supabase I/O ──────────────────────────────────────────────────────────────

/** Create an expense (+ optional items), tenant+property scoped. Returns id. */
export async function createExpense(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  header: Record<string, unknown> = {},
  items: Array<Record<string, unknown>> = [],
): Promise<string> {
  const row = { ...pickExpenseColumns({ status: "draft", ...header }), tenant_id: tenantId, property_id: propertyId };
  const { data, error } = await supabase.from("expenses").insert(row).select("id").single();
  if (error) throw error;
  const lines = mapExpenseItems(items);
  if (lines.length > 0) {
    const { error: e2 } = await supabase
      .from("expense_items")
      .insert(lines.map((l) => ({ ...l, tenant_id: tenantId, property_id: propertyId, expense_id: data.id })));
    if (e2) throw e2;
  }
  return data.id;
}

/** Update an expense header; if `items` is an array, replace them in place. */
export async function updateExpense(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  id: string,
  header: Record<string, unknown> = {},
  items?: Array<Record<string, unknown>>,
): Promise<void> {
  const patch = pickExpenseColumns(header);
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("expenses").update(patch).eq("id", id);
    if (error) throw error;
  }
  if (Array.isArray(items)) {
    const { error: dErr } = await supabase.from("expense_items").delete().eq("expense_id", id);
    if (dErr) throw dErr;
    const lines = mapExpenseItems(items);
    if (lines.length > 0) {
      const { error: iErr } = await supabase
        .from("expense_items")
        .insert(lines.map((l) => ({ ...l, tenant_id: tenantId, property_id: propertyId, expense_id: id })));
      if (iErr) throw iErr;
    }
  }
}

/** Mark an expense paid (records method + date + ref). */
export async function markPaid(
  supabase: SupabaseClient,
  id: string,
  { method, paidAt, ref }: { method?: string | null; paidAt?: string | null; ref?: string | null } = {},
): Promise<void> {
  const { error } = await supabase
    .from("expenses")
    .update({
      status: "paid",
      paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
      payment_method: clean(method),
      payment_ref: clean(ref),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Soft-void an expense (keeps it in the list with a reason). */
export async function voidExpense(supabase: SupabaseClient, id: string, reason?: string | null): Promise<void> {
  const { error } = await supabase
    .from("expenses")
    .update({ status: "void", voided_at: new Date().toISOString(), void_reason: clean(reason) })
    .eq("id", id);
  if (error) throw error;
}

/** Hard-delete a draft expense (cascades its items). */
export async function deleteExpense(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Create a WHT certificate. Mints the gapless WHT-YYYY-NNNNN number via the
 * issue_wht_number(tenant, property) RPC, then inserts the row. Returns the row.
 */
export async function createWhtCertificate(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  fields: Record<string, unknown> = {},
) {
  const { data: number, error: nErr } = await supabase.rpc("issue_wht_number", {
    p_tenant: tenantId,
    p_property: propertyId,
  });
  if (nErr) throw nErr;
  const row = {
    ...pickWhtColumns({ ...fields, number, status: "issued" }),
    tenant_id: tenantId,
    property_id: propertyId,
  };
  const { data, error } = await supabase.from("wht_certificates").insert(row).select("*").single();
  if (error) throw error;
  return data;
}

/** Void a WHT certificate (soft — keeps the number reserved). */
export async function voidWhtCertificate(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("wht_certificates").update({ status: "void" }).eq("id", id);
  if (error) throw error;
}
