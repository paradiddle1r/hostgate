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
  Invoice,
  InvoiceItemInput,
} from "@/lib/db/invoices";
import { getActiveProperty } from "@/lib/active-property-server";

async function ctx() {
  const active = await getActiveProperty();
  if (!active.ok) return { ok: false as const, res: active };
  const p = active.data.property;
  return { ok: true as const, propertyId: p.id, tenantId: p.tenant_id, vatRate: Number(p.vat_rate) || 0, vatInclusive: p.vat_inclusive };
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
  const res = await updateInvoiceMeta(id, patch);
  if (res.ok) revalidatePath(`/app/invoices/${id}`);
  return res;
}

export async function saveInvoiceItems(id: string, items: InvoiceItemInput[]): Promise<ActionResult<{ ok: true }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await saveItems(id, c.tenantId, c.propertyId, items, c.vatInclusive);
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
  const res = await recordPayment(id, c.tenantId, c.propertyId, amount, method, c.vatInclusive, note);
  if (res.ok) {
    revalidatePath(`/app/invoices/${id}`);
    revalidatePath("/app/invoices");
  }
  return res;
}

export async function voidInvoiceAction(id: string): Promise<ActionResult<Invoice>> {
  const res = await voidInvoice(id);
  if (res.ok) {
    revalidatePath(`/app/invoices/${id}`);
    revalidatePath("/app/invoices");
  }
  return res;
}
