import "server-only";

// Expenses (AP) + withholding-tax (WHT) data layer. Mirrors lib/db/invoices.ts:
// totals (subtotal / vat_amount / wht_amount / total) are recomputed by the DB
// trigger recompute_expense_totals() (migration 21) whenever expense_items
// change, or vat_rate/vat_inclusive/wht_rate change on the header — so every
// write here re-selects the expense afterwards rather than computing totals in
// code (lib/accounting/expenses.ts::computeExpenseTotals is for live editor
// previews only). WHT certificate numbers are minted by the
// issue_wht_number(tenant, property) RPC (gapless, per-tenant). Every insert
// stamps tenant_id + property_id from the caller's active-property context —
// never trust a client-supplied tenant/property.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";

export type ExpenseStatus = "draft" | "pending" | "paid" | "void";
export type PndType = "pnd3" | "pnd53";

export interface Expense {
  id: string;
  tenant_id: string;
  property_id: string;
  expense_date: string;
  contact_id: string | null;
  category_account_code: string | null;
  description: string | null;
  doc_ref: string | null;
  receipt_image_path: string | null;
  currency: string;
  vat_rate: number;
  vat_inclusive: boolean;
  wht_rate: number;
  subtotal: number;
  vat_amount: number;
  wht_amount: number;
  total: number;
  status: ExpenseStatus;
  paid_at: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  notes: string | null;
  created_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseItem {
  id: string;
  tenant_id: string;
  property_id: string;
  expense_id: string;
  sort_order: number;
  description: string;
  unit: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface WhtCertificate {
  id: string;
  tenant_id: string;
  property_id: string;
  number: string | null;
  expense_id: string | null;
  contact_id: string | null;
  pnd_type: PndType;
  income_type: string | null;
  income_desc: string | null;
  payee_name: string | null;
  payee_tax_id: string | null;
  payee_branch: string | null;
  payee_address: string | null;
  payment_date: string | null;
  amount_paid: number;
  wht_rate: number;
  wht_amount: number;
  tax_condition: string;
  status: "issued" | "void";
  created_by: string | null;
  created_at: string;
}

export interface ExpenseItemInput {
  description: string;
  unit?: string | null;
  qty: number;
  unit_price: number;
}

export interface ExpenseHeaderInput {
  expense_date?: string;
  contact_id?: string | null;
  category_account_code?: string | null;
  description?: string | null;
  doc_ref?: string | null;
  receipt_image_path?: string | null;
  currency?: string;
  vat_rate?: number;
  vat_inclusive?: boolean;
  wht_rate?: number;
  notes?: string | null;
  payment_method?: string | null;
  payment_ref?: string | null;
}

// Allow-listed header columns — a client patch can never smuggle
// tenant_id/property_id/status/totals through this path.
const HEADER_COLS = [
  "expense_date",
  "contact_id",
  "category_account_code",
  "description",
  "doc_ref",
  "receipt_image_path",
  "currency",
  "vat_rate",
  "vat_inclusive",
  "wht_rate",
  "notes",
  "payment_method",
  "payment_ref",
] as const;

function pickHeader(input: ExpenseHeaderInput = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of HEADER_COLS) {
    if (Object.prototype.hasOwnProperty.call(input, k) && input[k] !== undefined) out[k] = input[k];
  }
  return out;
}

function itemRows(
  items: ExpenseItemInput[],
  tenantId: string,
  propertyId: string,
  expenseId: string
) {
  return (items || [])
    .filter((i) => (i.description?.trim() || i.unit_price))
    .map((i, idx) => ({
      tenant_id: tenantId,
      property_id: propertyId,
      expense_id: expenseId,
      description: i.description?.trim() || "",
      unit: i.unit?.trim() || null,
      qty: Number(i.qty) || 0,
      unit_price: Number(i.unit_price) || 0,
      sort_order: idx,
    }));
}

// ── reads ──────────────────────────────────────────────────────────────────
export async function listExpenses(
  propertyId: string,
  opts?: { status?: ExpenseStatus; q?: string }
): Promise<ActionResult<Expense[]>> {
  try {
    const supabase = createClient();
    let query = supabase.from("expenses").select("*").eq("property_id", propertyId);
    if (opts?.status) query = query.eq("status", opts.status);
    if (opts?.q && opts.q.trim()) {
      const q = `%${opts.q.trim()}%`;
      query = query.or(`description.ilike.${q},doc_ref.ilike.${q}`);
    }
    const { data, error } = await query.order("expense_date", { ascending: false }).limit(500);
    if (error) throw error;
    return ok((data ?? []) as Expense[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function getExpense(
  id: string
): Promise<ActionResult<{ expense: Expense; items: ExpenseItem[] }>> {
  try {
    const supabase = createClient();
    const { data: expense, error } = await supabase.from("expenses").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!expense) return fail("HG-BOOK-404", "Expense not found.");
    const { data: items, error: itemsErr } = await supabase
      .from("expense_items")
      .select("*")
      .eq("expense_id", id)
      .order("sort_order");
    if (itemsErr) throw itemsErr;
    return ok({ expense: expense as Expense, items: (items ?? []) as ExpenseItem[] });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── create / edit ────────────────────────────────────────────────────────
/** Create a draft expense (+ optional items). Re-selects for DB-computed totals. */
export async function createExpense(
  propertyId: string,
  tenantId: string,
  header: ExpenseHeaderInput,
  items: ExpenseItemInput[]
): Promise<ActionResult<Expense>> {
  try {
    const supabase = createClient();
    const { data: exp, error } = await supabase
      .from("expenses")
      .insert({ ...pickHeader(header), tenant_id: tenantId, property_id: propertyId, status: "draft" })
      .select()
      .single();
    if (error) throw error;

    const rows = itemRows(items, tenantId, propertyId, exp.id);
    if (rows.length) {
      const { error: itemsErr } = await supabase.from("expense_items").insert(rows);
      if (itemsErr) throw itemsErr;
    }
    const fresh = await supabase.from("expenses").select("*").eq("id", exp.id).single();
    if (fresh.error) throw fresh.error;
    return ok(fresh.data as Expense);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Patch the expense header (allow-listed columns only). */
export async function updateExpense(
  id: string,
  patch: ExpenseHeaderInput
): Promise<ActionResult<Expense>> {
  try {
    const supabase = createClient();
    const cols = pickHeader(patch);
    if (Object.keys(cols).length === 0) {
      const { data, error } = await supabase.from("expenses").select("*").eq("id", id).single();
      if (error) throw error;
      return ok(data as Expense);
    }
    const { data, error } = await supabase.from("expenses").update(cols).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as Expense);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Replace all line items for an expense (delete + reinsert), then re-select
 *  the header so the caller gets the DB-recomputed totals. */
export async function saveExpenseItems(
  expenseId: string,
  tenantId: string,
  propertyId: string,
  items: ExpenseItemInput[]
): Promise<ActionResult<Expense>> {
  try {
    const supabase = createClient();
    const { error: delErr } = await supabase.from("expense_items").delete().eq("expense_id", expenseId);
    if (delErr) throw delErr;
    const rows = itemRows(items, tenantId, propertyId, expenseId);
    if (rows.length) {
      const { error } = await supabase.from("expense_items").insert(rows);
      if (error) throw error;
    }
    const fresh = await supabase.from("expenses").select("*").eq("id", expenseId).single();
    if (fresh.error) throw fresh.error;
    return ok(fresh.data as Expense);
  } catch (e) {
    return mapPgError(e);
  }
}

/** draft ⇄ pending ⇄ paid. Stamps paid_at (+ optional method/ref) on → paid. */
export async function setExpenseStatus(
  id: string,
  status: Exclude<ExpenseStatus, "void">,
  extra?: { paymentMethod?: string | null; paymentRef?: string | null; paidAt?: string | null }
): Promise<ActionResult<Expense>> {
  try {
    const supabase = createClient();
    const patch: Record<string, unknown> = { status };
    if (status === "paid") {
      patch.paid_at = extra?.paidAt ? new Date(extra.paidAt).toISOString() : new Date().toISOString();
      if (extra?.paymentMethod !== undefined) patch.payment_method = extra.paymentMethod;
      if (extra?.paymentRef !== undefined) patch.payment_ref = extra.paymentRef || null;
    }
    const { data, error } = await supabase.from("expenses").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as Expense);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Soft-void an expense (keeps it in the list with a reason). */
export async function voidExpense(id: string, reason?: string): Promise<ActionResult<Expense>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("expenses")
      .update({ status: "void", void_reason: reason?.trim() || null, voided_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as Expense);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Short-lived signed URL for a private expense-receipts object. */
export async function getReceiptSignedUrl(path: string): Promise<ActionResult<{ url: string }>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(path, 3600);
    if (error) throw error;
    if (!data?.signedUrl) return fail("HG-UNKNOWN-500", "Could not sign the receipt URL.");
    return ok({ url: data.signedUrl });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── withholding tax (WHT) certificates ──────────────────────────────────────
export interface WhtInput {
  expense_id?: string | null;
  contact_id?: string | null;
  pnd_type: PndType;
  income_type?: string | null;
  income_desc?: string | null;
  payee_name: string;
  payee_tax_id?: string | null;
  payee_branch?: string | null;
  payee_address?: string | null;
  payment_date: string;
  amount_paid: number;
  wht_rate: number;
  wht_amount: number;
  tax_condition?: string;
}

const WHT_COLS = [
  "expense_id",
  "contact_id",
  "pnd_type",
  "income_type",
  "income_desc",
  "payee_name",
  "payee_tax_id",
  "payee_branch",
  "payee_address",
  "payment_date",
  "amount_paid",
  "wht_rate",
  "wht_amount",
  "tax_condition",
] as const;

function pickWht(input: WhtInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of WHT_COLS) {
    if (Object.prototype.hasOwnProperty.call(input, k) && input[k] !== undefined) out[k] = input[k];
  }
  return out;
}

export async function listWht(
  propertyId: string,
  opts?: { pnd?: PndType }
): Promise<ActionResult<WhtCertificate[]>> {
  try {
    const supabase = createClient();
    let query = supabase.from("wht_certificates").select("*").eq("property_id", propertyId);
    if (opts?.pnd) query = query.eq("pnd_type", opts.pnd);
    const { data, error } = await query.order("payment_date", { ascending: false }).limit(500);
    if (error) throw error;
    return ok((data ?? []) as WhtCertificate[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function getWht(id: string): Promise<ActionResult<WhtCertificate>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("wht_certificates").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return fail("HG-BOOK-404", "Withholding-tax certificate not found.");
    return ok(data as WhtCertificate);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Create a WHT certificate. Mints the gapless WHT-YYYY-NNNNN number first via
 *  the issue_wht_number(tenant, property) RPC, then inserts the row. */
export async function createWht(
  propertyId: string,
  tenantId: string,
  fields: WhtInput
): Promise<ActionResult<WhtCertificate>> {
  try {
    const supabase = createClient();
    const { data: number, error: numErr } = await supabase.rpc("issue_wht_number", {
      p_tenant: tenantId,
      p_property: propertyId,
    });
    if (numErr) throw numErr;
    const { data, error } = await supabase
      .from("wht_certificates")
      .insert({
        ...pickWht(fields),
        number: number as string,
        status: "issued",
        tenant_id: tenantId,
        property_id: propertyId,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as WhtCertificate);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Void a WHT certificate (soft — keeps the number reserved). */
export async function voidWht(id: string): Promise<ActionResult<WhtCertificate>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("wht_certificates")
      .update({ status: "void" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as WhtCertificate);
  } catch (e) {
    return mapPgError(e);
  }
}
