"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, fail } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import { getActiveRole, canApprove } from "@/lib/active-role-server";
import { createClient } from "@/lib/supabase/server";
import { createContact } from "@/lib/db/contacts";
import type { Contact, ContactInput } from "@/lib/db/contacts";
import type { Property } from "@/lib/db/properties";
import {
  getExpense,
  createExpense,
  updateExpense,
  saveExpenseItems,
  setExpenseStatus,
  voidExpense,
  getReceiptSignedUrl,
  getWht,
  createWht,
  voidWht,
} from "@/lib/db/expenses";
import type {
  Expense,
  ExpenseItem,
  ExpenseHeaderInput,
  ExpenseItemInput,
  WhtCertificate,
  WhtInput,
} from "@/lib/db/expenses";

// Note: listExpenses / listWht are read directly from lib/db/expenses by
// app/app/expenses/page.tsx (server component) — same convention as
// app/app/invoices/page.tsx reading listInvoices directly. A "use server" file
// can only export async functions, so plain reads stay out of this module.

async function ctx() {
  const active = await getActiveProperty();
  if (!active.ok) return { ok: false as const, res: active };
  const p = active.data.property;
  return {
    ok: true as const,
    propertyId: p.id,
    tenantId: p.tenant_id,
    vatRate: Number(p.vat_rate) || 0,
    vatInclusive: p.vat_inclusive,
  };
}

// ── expenses ────────────────────────────────────────────────────────────────
export async function newExpense(
  header: ExpenseHeaderInput,
  items: ExpenseItemInput[]
): Promise<ActionResult<Expense>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await createExpense(c.propertyId, c.tenantId, header, items);
  if (res.ok) revalidatePath("/app/expenses");
  return res;
}

/** Fetch the full header + items for the edit modal (list rows only carry a
 *  summary shape). */
export async function loadExpenseDetail(
  id: string
): Promise<ActionResult<{ expense: Expense; items: ExpenseItem[] }>> {
  return getExpense(id);
}

export async function saveExpenseHeader(
  id: string,
  patch: ExpenseHeaderInput
): Promise<ActionResult<Expense>> {
  const res = await updateExpense(id, patch);
  if (res.ok) revalidatePath("/app/expenses");
  return res;
}

export async function saveExpenseItemsAction(
  id: string,
  items: ExpenseItemInput[]
): Promise<ActionResult<Expense>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await saveExpenseItems(id, c.tenantId, c.propertyId, items);
  if (res.ok) revalidatePath("/app/expenses");
  return res;
}

export async function markExpensePaid(
  id: string,
  opts?: { paymentMethod?: string | null; paymentRef?: string | null; paidAt?: string | null }
): Promise<ActionResult<Expense>> {
  const res = await setExpenseStatus(id, "paid", opts);
  if (res.ok) revalidatePath("/app/expenses");
  return res;
}

export async function setExpenseStatusAction(
  id: string,
  status: "draft" | "pending"
): Promise<ActionResult<Expense>> {
  const res = await setExpenseStatus(id, status);
  if (res.ok) revalidatePath("/app/expenses");
  return res;
}

/** Void gate — only owner/admin (canApprove) may void a recorded expense. */
export async function voidExpenseAction(id: string, reason?: string): Promise<ActionResult<Expense>> {
  const role = await getActiveRole();
  if (!canApprove(role)) return fail("HG-AUTH-403", "Only an owner or admin can void an expense.");
  const res = await voidExpense(id, reason);
  if (res.ok) revalidatePath("/app/expenses");
  return res;
}

/** Upload a receipt image to the private expense-receipts bucket, tenant-folder
 *  scoped (`${tenantId}/${expenseId}/…`, matching the mig-21 RLS policy), then
 *  stamp the expense's receipt_image_path. */
export async function uploadReceipt(
  expenseId: string,
  formData: FormData
): Promise<ActionResult<Expense>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("HG-VALIDATION-422", "No file provided.");
  }
  try {
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const rand = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const path = `${c.tenantId}/${expenseId}/${rand}.${ext}`;
    const { error } = await supabase.storage
      .from("expense-receipts")
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) throw error;
    const res = await updateExpense(expenseId, { receipt_image_path: path });
    if (res.ok) revalidatePath("/app/expenses");
    return res;
  } catch (e) {
    return fail("HG-UNKNOWN-500", e instanceof Error ? e.message : "Upload failed.");
  }
}

export async function getReceiptUrl(path: string): Promise<ActionResult<{ url: string }>> {
  return getReceiptSignedUrl(path);
}

// ── vendor contact (shared contacts table — "vendor" kind) ──────────────────
export async function createVendorContact(input: ContactInput): Promise<ActionResult<Contact>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await createContact(c.propertyId, c.tenantId, { kind: "vendor", ...input });
  if (res.ok) revalidatePath("/app/expenses");
  return res;
}

// ── withholding tax (WHT) certificates ──────────────────────────────────────
export async function newWht(fields: WhtInput): Promise<ActionResult<WhtCertificate>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await createWht(c.propertyId, c.tenantId, fields);
  if (res.ok) revalidatePath("/app/expenses");
  return res;
}

/** Void gate — only owner/admin (canApprove) may void a WHT certificate. */
export async function voidWhtAction(id: string): Promise<ActionResult<WhtCertificate>> {
  const role = await getActiveRole();
  if (!canApprove(role)) return fail("HG-AUTH-403", "Only an owner or admin can void a WHT certificate.");
  const res = await voidWht(id);
  if (res.ok) revalidatePath("/app/expenses");
  return res;
}

// ── print loader ─────────────────────────────────────────────────────────────
// The /print/wht/[id] route is a client component (owns a doc-language toggle +
// auto window.print()), so it pulls its data through this server action. RLS
// still scopes the read to the caller's tenant.
export type PrintWhtPayload = { cert: WhtCertificate; property: Property | null };

export async function loadWhtForPrint(id: string): Promise<ActionResult<PrintWhtPayload>> {
  const res = await getWht(id);
  if (!res.ok) return res;
  const supabase = createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", res.data.property_id)
    .maybeSingle();
  return { ok: true, data: { cert: res.data, property: (property as Property) ?? null } };
}
