import "server-only";

// Accounting data layer: invoices + line items + payments + receipts.
// Totals are recomputed in code (not a DB trigger) on every item/payment
// change. Numbering goes through the next_doc_number() SECURITY DEFINER RPC
// (locks the per-property/year counter). NO FlowAccount anywhere.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";

export type InvoiceStatus = "draft" | "issued" | "partial" | "paid" | "void";

export interface Invoice {
  id: string;
  tenant_id: string;
  property_id: string;
  number: string | null;
  booking_id: string | null;
  guest_name: string;
  guest_tax_id: string | null;
  guest_address: string | null;
  issue_date: string | null;
  service_period_start: string | null;
  service_period_end: string | null;
  currency: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  amount_paid: number;
  balance: number;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
  // ── parity (migration 15) — Thai B2B bill-to + void/discount ────────────────
  guest_company_name: string | null;
  guest_company_name_th: string | null;
  guest_branch: string | null;
  guest_address_th: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  due_date: string | null;
  footer: string | null;
  discount: number; // NOT NULL default 0
  vat_inclusive: boolean | null;
  void_reason: string | null;
  voided_at: string | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  qty: number;
  unit_price: number;
  line_total: number;
  is_discount: boolean;
  sort_order: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  paid_at: string;
  note: string | null;
  // ── parity (migration 15) ──────────────────────────────────────────────────
  reference: string | null;
}

export interface Receipt {
  id: string;
  invoice_id: string;
  payment_id: string | null;
  number: string;
  created_at: string;
}

export interface InvoiceItemInput {
  description: string;
  qty: number;
  unit_price: number;
  is_discount?: boolean;
}

// ── reads ──────────────────────────────────────────────────────────────────
export async function listInvoices(
  propertyId: string,
  opts?: { status?: InvoiceStatus; q?: string }
): Promise<ActionResult<Invoice[]>> {
  try {
    const supabase = createClient();
    let query = supabase.from("invoices").select("*").eq("property_id", propertyId);
    if (opts?.status) query = query.eq("status", opts.status);
    if (opts?.q && opts.q.trim()) {
      const q = `%${opts.q.trim()}%`;
      query = query.or(`guest_name.ilike.${q},number.ilike.${q}`);
    }
    const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return ok((data ?? []) as Invoice[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function getInvoice(
  id: string
): Promise<ActionResult<{ invoice: Invoice; items: InvoiceItem[]; payments: Payment[]; receipts: Receipt[] }>> {
  try {
    const supabase = createClient();
    const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!invoice) return fail("HG-BOOK-404", "Invoice not found.");
    const [items, payments, receipts] = await Promise.all([
      supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
      supabase.from("payments").select("*").eq("invoice_id", id).order("paid_at"),
      supabase.from("receipts").select("*").eq("invoice_id", id).order("created_at"),
    ]);
    return ok({
      invoice: invoice as Invoice,
      items: (items.data ?? []) as InvoiceItem[],
      payments: (payments.data ?? []) as Payment[],
      receipts: (receipts.data ?? []) as Receipt[],
    });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── create ─────────────────────────────────────────────────────────────────
export async function createBlankInvoice(
  propertyId: string,
  tenantId: string,
  vatRate: number
): Promise<ActionResult<Invoice>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("invoices")
      .insert({ tenant_id: tenantId, property_id: propertyId, guest_name: "Guest", vat_rate: vatRate })
      .select()
      .single();
    if (error) throw error;
    return ok(data as Invoice);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Create a draft invoice seeded from a booking (guest + a room-charge line). */
export async function createInvoiceFromBooking(
  propertyId: string,
  tenantId: string,
  bookingId: string,
  vatRate: number,
  vatInclusive: boolean
): Promise<ActionResult<Invoice>> {
  try {
    const supabase = createClient();
    const { data: b, error: bErr } = await supabase
      .from("bookings")
      .select("guest_name, phone, check_in, check_out, total_amount")
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!b) return fail("HG-BOOK-404", "Booking not found.");

    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        booking_id: bookingId,
        guest_name: b.guest_name ?? "Guest",
        service_period_start: b.check_in,
        service_period_end: b.check_out,
        vat_rate: vatRate,
      })
      .select()
      .single();
    if (error) throw error;

    const amount = Number(b.total_amount) || 0;
    if (amount > 0) {
      await supabase.from("invoice_items").insert({
        tenant_id: tenantId,
        property_id: propertyId,
        invoice_id: inv.id,
        description: `Room charge (${b.check_in} → ${b.check_out})`,
        qty: 1,
        unit_price: amount,
        line_total: amount,
        sort_order: 0,
      });
    }
    await recompute(inv.id, vatInclusive);
    const fresh = await supabase.from("invoices").select("*").eq("id", inv.id).single();
    return ok(fresh.data as Invoice);
  } catch (e) {
    return mapPgError(e);
  }
}

// ── edit ───────────────────────────────────────────────────────────────────
export async function updateInvoiceMeta(
  id: string,
  patch: Partial<
    Pick<
      Invoice,
      | "guest_name"
      | "guest_tax_id"
      | "guest_address"
      | "notes"
      | "service_period_start"
      | "service_period_end"
      // ── parity (migration 15) — Thai B2B bill-to + presentation ────────────
      | "guest_company_name"
      | "guest_company_name_th"
      | "guest_branch"
      | "guest_address_th"
      | "guest_phone"
      | "guest_email"
      | "due_date"
      | "footer"
      | "discount"
      | "vat_inclusive"
    >
  >
): Promise<ActionResult<Invoice>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("invoices").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as Invoice);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Replace all line items, then recompute totals. */
export async function saveItems(
  invoiceId: string,
  tenantId: string,
  propertyId: string,
  items: InvoiceItemInput[],
  vatInclusive: boolean
): Promise<ActionResult<{ ok: true }>> {
  try {
    const supabase = createClient();
    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
    const rows = items
      .filter((i) => (i.description?.trim() || i.unit_price))
      .map((i, idx) => {
        const qty = Number(i.qty) || 0;
        const unit = Number(i.unit_price) || 0;
        return {
          tenant_id: tenantId,
          property_id: propertyId,
          invoice_id: invoiceId,
          description: i.description?.trim() || "",
          qty,
          unit_price: unit,
          line_total: Math.round(qty * unit * 100) / 100,
          is_discount: !!i.is_discount,
          sort_order: idx,
        };
      });
    if (rows.length) {
      const { error } = await supabase.from("invoice_items").insert(rows);
      if (error) throw error;
    }
    await recompute(invoiceId, vatInclusive);
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}

/** Recompute subtotal / vat / total / paid / balance / status from items + payments. */
export async function recompute(invoiceId: string, vatInclusive: boolean): Promise<void> {
  const supabase = createClient();
  const [{ data: inv }, { data: items }, { data: pays }] = await Promise.all([
    supabase.from("invoices").select("vat_rate, status, number").eq("id", invoiceId).single(),
    supabase.from("invoice_items").select("line_total, is_discount").eq("invoice_id", invoiceId),
    supabase.from("payments").select("amount").eq("invoice_id", invoiceId),
  ]);
  if (!inv) return;
  const rate = Number(inv.vat_rate) || 0;
  const gross = (items ?? []).reduce((s, i) => s + (i.is_discount ? -1 : 1) * (Number(i.line_total) || 0), 0);
  let subtotal: number, vat: number, total: number;
  if (vatInclusive) {
    total = gross;
    vat = rate > 0 ? Math.round((total * rate) / (100 + rate) * 100) / 100 : 0;
    subtotal = Math.round((total - vat) * 100) / 100;
  } else {
    subtotal = gross;
    vat = Math.round((subtotal * rate) / 100 * 100) / 100;
    total = Math.round((subtotal + vat) * 100) / 100;
  }
  const paid = (pays ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = Math.round((total - paid) * 100) / 100;

  let status = inv.status as InvoiceStatus;
  if (status !== "void") {
    if (paid <= 0) status = inv.number ? "issued" : "draft";
    else if (paid < total) status = "partial";
    else status = "paid";
  }
  await supabase
    .from("invoices")
    .update({ subtotal, vat_amount: vat, total, amount_paid: paid, balance, status })
    .eq("id", invoiceId);
}

/** Assign a sequential number + issue date, move draft → issued. */
export async function issueInvoice(id: string, propertyId: string): Promise<ActionResult<Invoice>> {
  try {
    const supabase = createClient();
    const { data: cur } = await supabase.from("invoices").select("number, status").eq("id", id).single();
    if (cur?.number) return ok(cur as Invoice); // already issued — idempotent
    const { data: num, error: numErr } = await supabase.rpc("next_doc_number", { p_property: propertyId, p_kind: "invoice" });
    if (numErr) throw numErr;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("invoices")
      .update({ number: num as string, issue_date: today, status: "issued" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as Invoice);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Record a payment, recompute, and mint a receipt (snapshot + number). */
export async function recordPayment(
  invoiceId: string,
  tenantId: string,
  propertyId: string,
  amount: number,
  method: string,
  vatInclusive: boolean,
  note?: string
): Promise<ActionResult<{ receiptNumber: string }>> {
  try {
    const supabase = createClient();
    const { data: pay, error: payErr } = await supabase
      .from("payments")
      .insert({ tenant_id: tenantId, property_id: propertyId, invoice_id: invoiceId, amount, method, note: note ?? null })
      .select("id")
      .single();
    if (payErr) throw payErr;

    await recompute(invoiceId, vatInclusive);

    const { data: num, error: numErr } = await supabase.rpc("next_doc_number", { p_property: propertyId, p_kind: "receipt" });
    if (numErr) throw numErr;
    const { data: snap } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
    await supabase.from("receipts").insert({
      tenant_id: tenantId,
      property_id: propertyId,
      invoice_id: invoiceId,
      payment_id: pay.id,
      number: num as string,
      snapshot: snap,
    });
    return ok({ receiptNumber: num as string });
  } catch (e) {
    return mapPgError(e);
  }
}

/**
 * Void an invoice, optionally stamping a reason + timestamp. `reason` is
 * optional so existing callers (`voidInvoice(id)`) keep working unchanged.
 */
export async function voidInvoice(id: string, reason?: string): Promise<ActionResult<Invoice>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("invoices")
      .update({ status: "void", void_reason: reason ?? null, voided_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as Invoice);
  } catch (e) {
    return mapPgError(e);
  }
}
