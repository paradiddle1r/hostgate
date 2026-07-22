import "server-only";

// Sales-document data layer (HG-P3). Quotation / billing-note / cash-sale /
// credit-note / debit-note lifecycle for the active property. Totals are owned
// by the DB trigger recompute_sales_document_totals() (migration 21) — this
// layer NEVER writes subtotal/vat/total; it re-selects after item writes.
//
// The load-bearing bit is convertToInvoice(): it mints a real HostGate tax
// invoice from an approved document by composing the PURE mappers in
// lib/accounting/documents (buildInvoiceFromDocumentPayload / applyableInvoicePatch)
// with HostGate's own invoice insert + recompute() + issueInvoice() path
// (lib/db/invoices) — the wiring lib/accounting/documents deferred to HG-P3.

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";
import {
  updateDocumentHeader,
  voidDocument as voidDocumentCore,
  pickHeaderColumns,
  mapDocItemsToDocItems,
  cloneDocumentHeader,
  buildInvoiceFromDocumentPayload,
  applyableInvoicePatch,
  creditDebitPrefill,
} from "@/lib/accounting/documents";
import { recompute, issueInvoice, recordPayment, type Invoice, type InvoiceItem } from "@/lib/db/invoices";

export type DocType = "quotation" | "billing-note" | "cash-sale" | "credit-note" | "debit-note";
export type DocStatus = "draft" | "awaiting" | "approved" | "rejected" | "processed" | "void";

export interface SalesDocument {
  id: string;
  tenant_id: string;
  property_id: string;
  doc_type: DocType;
  number: string | null;
  status: DocStatus;
  issue_date: string;
  due_date: string | null;
  credit_days: number;
  contact_id: string | null;
  booking_id: string | null;
  ref_invoice_id: string | null;
  source_document_id: string | null;
  converted_invoice_id: string | null;
  customer_name: string | null;
  customer_company_name: string | null;
  customer_company_name_th: string | null;
  customer_branch: string | null;
  customer_tax_id: string | null;
  customer_address: string | null;
  customer_address_th: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  currency: string;
  vat_rate: number;
  vat_inclusive: boolean;
  subtotal: number;
  discount: number;
  vat_amount: number;
  total: number;
  notes: string | null;
  reason: string | null;
  salesperson: string | null;
  approved_by: string | null;
  approved_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesDocumentItem {
  id: string;
  document_id: string;
  sort_order: number;
  description: string;
  unit: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  is_discount: boolean;
}

export interface DocItemInput {
  sort_order?: number;
  description?: string | null;
  unit?: string | null;
  qty?: number | string | null;
  unit_price?: number | string | null;
  is_discount?: boolean;
}

// The pure mappers accept a loose index-signed ItemLike; our typed row/input
// arrays are structurally compatible but lack that index signature, so they
// cross via this cast (the mappers only ever read the known columns).
type LooseItems = Record<string, unknown>[];

// ── reads ────────────────────────────────────────────────────────────────────
export async function listDocuments(
  propertyId: string,
  opts?: { docType?: DocType; status?: DocStatus; q?: string }
): Promise<ActionResult<SalesDocument[]>> {
  try {
    const supabase = createClient();
    let query = supabase.from("sales_documents").select("*").eq("property_id", propertyId);
    if (opts?.docType) query = query.eq("doc_type", opts.docType);
    if (opts?.status) query = query.eq("status", opts.status);
    if (opts?.q && opts.q.trim()) {
      const q = `%${opts.q.trim()}%`;
      query = query.or(`customer_name.ilike.${q},number.ilike.${q}`);
    }
    const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return ok((data ?? []) as SalesDocument[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function getDocument(
  id: string
): Promise<ActionResult<{ doc: SalesDocument; items: SalesDocumentItem[] }>> {
  try {
    const supabase = createClient();
    const { data: doc, error } = await supabase.from("sales_documents").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!doc) return fail("HG-BOOK-404", "Document not found.");
    const { data: items } = await supabase
      .from("sales_document_items")
      .select("*")
      .eq("document_id", id)
      .order("sort_order");
    return ok({ doc: doc as SalesDocument, items: (items ?? []) as SalesDocumentItem[] });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── create / edit ────────────────────────────────────────────────────────────
/** Create a draft document + its items, tenant+property scoped. Returns the id. */
export async function createDocument(
  propertyId: string,
  tenantId: string,
  header: Record<string, unknown>,
  items: DocItemInput[]
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const picked = pickHeaderColumns({ status: "draft", ...header });
    if (!picked.doc_type) return fail("HG-VALIDATION-422", "Document type is required.");
    const { data: doc, error } = await supabase
      .from("sales_documents")
      .insert({ ...picked, tenant_id: tenantId, property_id: propertyId })
      .select("id")
      .single();
    if (error) throw error;
    const lines = mapDocItemsToDocItems(items as unknown as LooseItems);
    if (lines.length > 0) {
      const { error: e2 } = await supabase
        .from("sales_document_items")
        .insert(lines.map((l) => ({ ...l, tenant_id: tenantId, property_id: propertyId, document_id: doc.id })));
      if (e2) throw e2;
    }
    return ok({ id: doc.id as string });
  } catch (e) {
    return mapPgError(e);
  }
}

/** Patch a draft document's header + replace its items (trigger recomputes totals). */
export async function saveDocument(
  id: string,
  tenantId: string,
  propertyId: string,
  header: Record<string, unknown>,
  items: DocItemInput[]
): Promise<ActionResult<{ ok: true }>> {
  try {
    const supabase = createClient();
    await updateDocumentHeader(supabase as unknown as SupabaseClient, id, header);
    await supabase.from("sales_document_items").delete().eq("document_id", id);
    const lines = mapDocItemsToDocItems(items as unknown as LooseItems);
    if (lines.length > 0) {
      const { error } = await supabase
        .from("sales_document_items")
        .insert(lines.map((l) => ({ ...l, tenant_id: tenantId, property_id: propertyId, document_id: id })));
      if (error) throw error;
    } else {
      // No items → recompute won't fire via the delete trigger's coalesce path
      // reliably to zero; force a header touch so totals settle.
      await supabase.from("sales_documents").update({ discount: (header.discount as number) ?? 0 }).eq("id", id);
    }
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}

/** Transition a document out of draft (mints the per-tenant number). */
export async function transitionDocument(id: string, status: DocStatus): Promise<ActionResult<SalesDocument>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("issue_sales_document", { p_document_id: id, p_status: status });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return ok(row as SalesDocument);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function voidDocument(id: string, reason?: string | null): Promise<ActionResult<{ ok: true }>> {
  try {
    const supabase = createClient();
    await voidDocumentCore(supabase as unknown as SupabaseClient, id, reason ?? null);
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── credit / debit note prefill from an existing invoice ─────────────────────
export async function loadCreditDebitPrefill(
  invoiceId: string,
  docType: "credit-note" | "debit-note"
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const supabase = createClient();
    const { data: inv, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (error) throw error;
    if (!inv) return fail("HG-BOOK-404", "Invoice not found.");
    const { data: items } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order");
    return ok(creditDebitPrefill(inv as Record<string, unknown>, (items ?? []) as unknown as Record<string, unknown>[], docType));
  } catch (e) {
    return mapPgError(e);
  }
}

// ── convert: quotation → billing-note (clone) ────────────────────────────────
export async function cloneToBillingNote(
  id: string,
  tenantId: string,
  propertyId: string
): Promise<ActionResult<{ id: string }>> {
  const src = await getDocument(id);
  if (!src.ok) return src;
  const header = cloneDocumentHeader(src.data.doc as unknown as Record<string, unknown>);
  const created = await createDocument(propertyId, tenantId, { ...header, doc_type: "billing-note", source_document_id: id }, src.data.items);
  return created;
}

// ── convert: document → HostGate tax invoice (THE deferred wiring) ────────────
/**
 * Mint a real tax invoice from a document. For a cash-sale, also records a full
 * payment (→ issued+paid+receipt). Links the doc → invoice and marks it
 * 'processed'. Returns the new invoice id.
 */
export async function convertToInvoice(
  id: string,
  tenantId: string,
  propertyId: string
): Promise<ActionResult<{ invoiceId: string; invoice: Invoice }>> {
  try {
    const supabase = createClient();
    const src = await getDocument(id);
    if (!src.ok) return src;
    const doc = src.data.doc;
    if (doc.status === "void") return fail("HG-VALIDATION-422", "Cannot convert a void document.");
    if (doc.converted_invoice_id) return fail("HG-VALIDATION-422", "This document was already converted.");
    if (doc.doc_type === "credit-note" || doc.doc_type === "debit-note") {
      return fail("HG-VALIDATION-422", "Credit/debit notes are not converted to invoices.");
    }

    const { core, patch } = buildInvoiceFromDocumentPayload(
      doc as unknown as Record<string, unknown>,
      src.data.items as unknown as Record<string, unknown>[]
    );

    // 1. insert the invoice header (core fields + corporate/discount patch).
    const insertRow: Record<string, unknown> = {
      tenant_id: tenantId,
      property_id: propertyId,
      booking_id: core.booking_id,
      guest_name: core.guest_name,
      guest_tax_id: core.guest_tax_id,
      guest_address: core.guest_address,
      guest_phone: core.guest_phone,
      guest_email: core.guest_email,
      due_date: core.due_date,
      notes: core.notes,
      vat_rate: core.vat_rate,
      vat_inclusive: core.vat_inclusive,
      ...applyableInvoicePatch(patch),
    };
    const { data: inv, error: insErr } = await supabase.from("invoices").insert(insertRow).select("id").single();
    if (insErr) throw insErr;
    const invoiceId = inv.id as string;

    // 2. insert the invoice line items.
    const itemRows = (core.items as ReturnType<typeof buildInvoiceFromDocumentPayload>["core"]["items"]).map((it) => {
      const qty = Number(it.qty) || 0;
      const unit = Number(it.unit_price) || 0;
      return {
        tenant_id: tenantId,
        property_id: propertyId,
        invoice_id: invoiceId,
        description: it.description,
        qty,
        unit_price: unit,
        line_total: Math.round(qty * unit * 100) / 100,
        is_discount: !!it.is_discount,
        sort_order: it.sort_order,
      };
    });
    if (itemRows.length > 0) {
      const { error: itErr } = await supabase.from("invoice_items").insert(itemRows);
      if (itErr) throw itErr;
    }

    // 3. recompute totals + fold the header-level discount (mirrors the invoice
    //    detail editor: recompute() sums line items only, then discount → tax).
    const vatInclusive = !!core.vat_inclusive;
    await recompute(invoiceId, vatInclusive);
    const discount = Math.max(0, Number(patch.discount) || 0);
    if (discount > 0) await foldInvoiceDiscount(supabase as unknown as SupabaseClient, invoiceId, vatInclusive);

    // 4. issue the invoice number (draft → issued).
    const issued = await issueInvoice(invoiceId, propertyId);
    if (!issued.ok) return issued;

    // 5. cash-sale ⇒ record the full payment (issued → paid + receipt).
    if (doc.doc_type === "cash-sale") {
      const total = Number(issued.data.total) || 0;
      if (total > 0) {
        const pay = await recordPayment(invoiceId, tenantId, propertyId, total, "cash", vatInclusive, "Cash sale");
        if (!pay.ok) return pay;
      }
    }

    // 6. link + mark the document processed (mints its number if still draft).
    await updateDocumentHeader(supabase as unknown as SupabaseClient, id, { converted_invoice_id: invoiceId });
    await supabase.rpc("issue_sales_document", { p_document_id: id, p_status: "processed" });

    const { data: fresh } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
    return ok({ invoiceId, invoice: fresh as Invoice });
  } catch (e) {
    return mapPgError(e);
  }
}

// recompute() ignores invoices.discount; fold it in before tax (same shape the
// invoice print + /app/invoices editor use), then persist corrected figures.
async function foldInvoiceDiscount(supabase: SupabaseClient, invoiceId: string, vatInclusive: boolean): Promise<void> {
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) return;
  const discount = Math.max(0, Number(inv.discount) || 0);
  if (discount <= 0) return;
  const rate = Number(inv.vat_rate) || 0;
  const r2 = (n: number) => Math.round(n * 100) / 100;
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
  await supabase.from("invoices").update({ subtotal, vat_amount: vat, total, balance }).eq("id", invoiceId);
}
