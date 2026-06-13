"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, fail } from "@/lib/errors";
import {
  createBlankInvoice,
  createInvoiceFromBooking,
  updateInvoiceMeta,
  saveItems,
  issueInvoice,
  recordPayment,
  voidInvoice,
  recompute,
  Invoice,
  InvoiceItemInput,
} from "@/lib/db/invoices";
import { getActiveProperty } from "@/lib/active-property-server";
import { getInvoice, type InvoiceItem, type Payment } from "@/lib/db/invoices";
import type { Property } from "@/lib/db/properties";
import { createClient } from "@/lib/supabase/server";

// ── print loaders ────────────────────────────────────────────────────────────
// The /print/* routes are client components (they own a doc-language toggle +
// auto window.print()), so they pull their data through these server actions.
// RLS still scopes every read to the caller's tenant.

export type PrintInvoicePayload = {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: Payment[];
  property: Property | null;
};

export async function loadInvoiceForPrint(id: string): Promise<ActionResult<PrintInvoicePayload>> {
  const res = await getInvoice(id);
  if (!res.ok) return res;
  const supabase = createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", res.data.invoice.property_id)
    .maybeSingle();
  return {
    ok: true,
    data: {
      invoice: res.data.invoice,
      items: res.data.items,
      payments: res.data.payments,
      property: (property as Property) ?? null,
    },
  };
}

export type PrintReceiptPayload = {
  receipt: { id: string; number: string; created_at: string; snapshot: Partial<Invoice> | null };
  payment: Payment | null;
  property: Property | null;
};

export async function loadReceiptForPrint(id: string): Promise<ActionResult<PrintReceiptPayload>> {
  const supabase = createClient();
  const { data: receipt } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!receipt) return fail("HG-BOOK-404", "Receipt not found.");

  let payment: Payment | null = null;
  if (receipt.payment_id) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("id", receipt.payment_id)
      .maybeSingle();
    payment = (data as Payment) ?? null;
  }

  const snapshot = (receipt.snapshot ?? {}) as Partial<Invoice>;
  let property: Property | null = null;
  if (snapshot.property_id) {
    const { data } = await supabase
      .from("properties")
      .select("*")
      .eq("id", snapshot.property_id)
      .maybeSingle();
    property = (data as Property) ?? null;
  }
  return {
    ok: true,
    data: {
      receipt: {
        id: receipt.id,
        number: receipt.number,
        created_at: receipt.created_at,
        snapshot,
      },
      payment,
      property,
    },
  };
}

async function ctx() {
  const active = await getActiveProperty();
  if (!active.ok) return { ok: false as const, res: active };
  const p = active.data.property;
  return { ok: true as const, propertyId: p.id, tenantId: p.tenant_id, vatRate: Number(p.vat_rate) || 0, vatInclusive: p.vat_inclusive };
}

// Resolve the VAT-inclusive flag that should drive total recomputation for a
// given invoice: the invoice-level override wins when set, otherwise the
// property default. Keeps lib/db untouched while honouring the per-invoice
// toggle the detail editor now exposes.
async function effectiveVatInclusive(invoiceId: string, propertyDefault: boolean): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("invoices")
    .select("vat_inclusive")
    .eq("id", invoiceId)
    .maybeSingle();
  return data?.vat_inclusive == null ? propertyDefault : !!data.vat_inclusive;
}

export async function newBlankInvoice(): Promise<ActionResult<Invoice>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await createBlankInvoice(c.propertyId, c.tenantId, c.vatRate);
  if (res.ok) revalidatePath("/app/invoices");
  return res;
}

export async function newInvoiceFromBooking(bookingId: string): Promise<ActionResult<Invoice>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await createInvoiceFromBooking(c.propertyId, c.tenantId, bookingId, c.vatRate, c.vatInclusive);
  if (res.ok) revalidatePath("/app/invoices");
  return res;
}

export async function saveInvoiceMeta(
  id: string,
  patch: Parameters<typeof updateInvoiceMeta>[1]
): Promise<ActionResult<Invoice>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await updateInvoiceMeta(id, patch);
  if (!res.ok) return res;
  // A discount / vat-inclusive change must flow into the recorded totals so the
  // editor, the totals panel and the printed document all agree. recompute()
  // rebuilds subtotal/vat/total from the line items + the effective inclusive
  // flag; we then subtract the invoice-level discount on top (the same shape
  // the print page renders) and persist the corrected figures + status.
  const touchesTotals =
    Object.prototype.hasOwnProperty.call(patch, "discount") ||
    Object.prototype.hasOwnProperty.call(patch, "vat_inclusive");
  let fresh = res.data;
  if (touchesTotals && res.data.status === "draft") {
    const vatInclusive = await effectiveVatInclusive(id, c.vatInclusive);
    await recompute(id, vatInclusive);
    const adjusted = await applyHeaderDiscount(id, vatInclusive);
    if (adjusted) fresh = adjusted;
  }
  revalidatePath(`/app/invoices/${id}`);
  return { ok: true, data: fresh } as ActionResult<Invoice>;
}

// recompute() ignores the invoice-level `discount` column (it only sums line
// items). After it runs we fold that discount into subtotal → vat → total →
// balance here, mirroring how the printed totals block presents it, and write
// the corrected figures back so stored and printed numbers never diverge.
async function applyHeaderDiscount(invoiceId: string, vatInclusive: boolean): Promise<Invoice | null> {
  const supabase = createClient();
  const { data: inv } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return null;
  const discount = Math.max(0, Number(inv.discount) || 0);
  if (discount <= 0) return inv as Invoice;

  const rate = Number(inv.vat_rate) || 0;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  // recompute() set subtotal/vat_amount/total as if discount = 0; back out the
  // gross and re-derive with the discount applied before tax.
  let subtotal: number, vat: number, total: number;
  if (vatInclusive) {
    const gross = Math.max(0, Number(inv.total) - discount);
    total = r2(gross);
    vat = rate > 0 ? r2((total * rate) / (100 + rate)) : 0;
    subtotal = r2(total - vat);
  } else {
    subtotal = r2(Math.max(0, Number(inv.subtotal) - discount));
    vat = r2((subtotal * rate) / 100);
    total = r2(subtotal + vat);
  }
  const paid = Number(inv.amount_paid) || 0;
  const balance = r2(total - paid);
  let status = inv.status as Invoice["status"];
  if (status !== "void") {
    if (paid <= 0) status = inv.number ? "issued" : "draft";
    else if (paid < total) status = "partial";
    else status = "paid";
  }
  const { data } = await supabase
    .from("invoices")
    .update({ subtotal, vat_amount: vat, total, balance, status })
    .eq("id", invoiceId)
    .select()
    .single();
  return (data as Invoice) ?? (inv as Invoice);
}

export async function saveInvoiceItems(id: string, items: InvoiceItemInput[]): Promise<ActionResult<{ ok: true }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const vatInclusive = await effectiveVatInclusive(id, c.vatInclusive);
  const res = await saveItems(id, c.tenantId, c.propertyId, items, vatInclusive);
  if (res.ok) revalidatePath(`/app/invoices/${id}`);
  return res;
}

export async function issueInvoiceAction(id: string): Promise<ActionResult<Invoice>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await issueInvoice(id, c.propertyId);
  if (res.ok) {
    revalidatePath(`/app/invoices/${id}`);
    revalidatePath("/app/invoices");
  }
  return res;
}

export async function recordPaymentAction(
  id: string,
  amount: number,
  method: string,
  note?: string
): Promise<ActionResult<{ receiptNumber: string }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  if (!(amount > 0)) return fail("HG-VALIDATION-422", "Amount must be greater than zero.");
  const vatInclusive = await effectiveVatInclusive(id, c.vatInclusive);
  const res = await recordPayment(id, c.tenantId, c.propertyId, amount, method, vatInclusive, note);
  if (res.ok) {
    revalidatePath(`/app/invoices/${id}`);
    revalidatePath("/app/invoices");
  }
  return res;
}

export async function voidInvoiceAction(id: string, reason?: string): Promise<ActionResult<Invoice>> {
  const res = await voidInvoice(id, reason?.trim() || undefined);
  if (res.ok) {
    revalidatePath(`/app/invoices/${id}`);
    revalidatePath("/app/invoices");
  }
  return res;
}
