// lib/accounting/documents.ts
// ────────────────────────────────────────────────────────────────────────────
// Sales-document suite core (Phase 1). One place for the quotation /
// billing-note / cash-sale / credit-note / debit-note lifecycle:
//   • pure mapping helpers (docPrefix, buildInvoiceFromDocumentPayload,
//     mapDocItemsToInvoiceItems, creditDebitPrefill, …) — unit-tested.
//   • self-contained supabase I/O against sales_documents / sales_document_items
//     / contacts, tenant+property scoped. Status transitions mint the per-tenant
//     running number via issue_sales_document(id, status) (migration 21).
//
// NOTE — document → tax-invoice minting (createInvoiceFromDocument / cashSale /
// the 'tax-invoice' convertDocument target) is intentionally NOT in this layer:
// it composes with HostGate's own invoice-creation path (lib/db/invoices.ts) and
// the next_doc_number()/issue-receipt flow, which the pages layer (HG-P3) owns.
// The PURE mapping (buildInvoiceFromDocumentPayload / applyableInvoicePatch /
// mapDocItemsToInvoiceItems) IS provided here so HG-P3 only has to wire the insert.
//
// Money math is NEVER computed here for storage — the DB trigger
// recompute_sales_document_totals() (migration 21) owns document totals.
// ────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";

/** Tenant + property scope every DB-touching accounting helper takes. */
export interface TenantScope {
  tenantId: string;
  propertyId: string;
}

// ── document type + status metadata (bilingual) ──────────────────────────────

export const DOC_TYPES = [
  { type: "quotation", prefix: "QT", en: "Quotation", th: "ใบเสนอราคา" },
  { type: "billing-note", prefix: "BN", en: "Billing note", th: "ใบวางบิล/ใบแจ้งหนี้" },
  { type: "cash-sale", prefix: "CS", en: "Cash sale", th: "ขายเงินสด" },
  { type: "credit-note", prefix: "CN", en: "Credit note", th: "ใบลดหนี้" },
  { type: "debit-note", prefix: "DN", en: "Debit note", th: "ใบเพิ่มหนี้" },
];

// draft → awaiting(review) → approved | rejected ; approved → processed
export const DOC_STATUSES = [
  { v: "draft", en: "Draft", th: "ฉบับร่าง", color: "#d97706" },
  { v: "awaiting", en: "Awaiting", th: "รออนุมัติ", color: "#7c3aed" },
  { v: "approved", en: "Approved", th: "อนุมัติแล้ว", color: "#2563eb" },
  { v: "processed", en: "Processed", th: "ดำเนินการแล้ว", color: "#16a34a" },
  { v: "rejected", en: "Rejected", th: "ไม่อนุมัติ", color: "#dc2626" },
  { v: "void", en: "Void", th: "ยกเลิก", color: "#6b7280" },
];

export function docTypeMeta(type: string) {
  return DOC_TYPES.find((d) => d.type === type) || DOC_TYPES[0];
}
export function docPrefix(type: string): string {
  return docTypeMeta(type).prefix;
}
export function docStatusMeta(v: string) {
  return DOC_STATUSES.find((s) => s.v === v) || DOC_STATUSES[0];
}

// ── pure helpers (unit-tested) ───────────────────────────────────────────────

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clean = <T>(v: T): T | null => (v === undefined || (v as unknown) === "" ? null : v);

type ItemLike = {
  sort_order?: number;
  description?: string | null;
  unit?: string | null;
  qty?: unknown;
  unit_price?: unknown;
  is_discount?: boolean;
  // absorbs editor-only keys the tests pass to prove they get stripped.
  [key: string]: unknown;
};

/** Strip a document/invoice line list down to the invoice_items insert shape. */
export function mapDocItemsToInvoiceItems(items: readonly ItemLike[] = []) {
  return (items || []).map((it, i) => ({
    sort_order: it.sort_order ?? i,
    description: it.description || "",
    qty: num(it.qty),
    unit_price: num(it.unit_price),
    is_discount: !!it.is_discount,
  }));
}

/** Strip a line list down to the sales_document_items insert shape (keeps unit). */
export function mapDocItemsToDocItems(items: readonly ItemLike[] = []) {
  return (items || []).map((it, i) => ({
    sort_order: it.sort_order ?? i,
    description: it.description || "",
    unit: clean(it.unit),
    qty: num(it.qty),
    unit_price: num(it.unit_price),
    is_discount: !!it.is_discount,
  }));
}

/** Header fields shared by every document (used when cloning during conversion). Pure. */
export function cloneDocumentHeader(doc: Record<string, unknown> = {}) {
  return {
    contact_id: doc.contact_id ?? null,
    booking_id: doc.booking_id ?? null,
    customer_name: clean(doc.customer_name),
    customer_company_name: clean(doc.customer_company_name),
    customer_company_name_th: clean(doc.customer_company_name_th),
    customer_branch: clean(doc.customer_branch),
    customer_tax_id: clean(doc.customer_tax_id),
    customer_address: clean(doc.customer_address),
    customer_address_th: clean(doc.customer_address_th),
    customer_phone: clean(doc.customer_phone),
    customer_email: clean(doc.customer_email),
    currency: doc.currency || "THB",
    vat_rate: num(doc.vat_rate),
    vat_inclusive: !!doc.vat_inclusive,
    discount: num(doc.discount),
    credit_days: num(doc.credit_days),
    due_date: clean(doc.due_date),
    notes: clean(doc.notes),
    salesperson: clean(doc.salesperson),
  };
}

/**
 * Map a sales_document (+ items) onto the two-part payload used to mint a tax
 * invoice: `core` (fields an invoice-creation core supports) and `patch` (fields
 * it can't set — corporate bill-to, contact link, header discount). Pure — no I/O.
 * The actual invoice insert is HG-P3's job (see the file header note).
 */
export function buildInvoiceFromDocumentPayload(doc: Record<string, unknown> = {}, items: readonly ItemLike[] = []) {
  const core = {
    booking_id: doc.booking_id ?? null,
    booking_group_id: doc.booking_group_id ?? null,
    guest_name: doc.customer_name || doc.customer_company_name || "Customer",
    guest_tax_id: clean(doc.customer_tax_id),
    guest_address: clean(doc.customer_address),
    guest_phone: clean(doc.customer_phone),
    guest_email: clean(doc.customer_email),
    due_date: clean(doc.due_date),
    notes: clean(doc.notes),
    vat_rate: num(doc.vat_rate),
    vat_inclusive: !!doc.vat_inclusive,
    items: mapDocItemsToInvoiceItems(items),
  };
  const patch = {
    contact_id: doc.contact_id ?? null,
    guest_company_name: clean(doc.customer_company_name),
    guest_company_name_th: clean(doc.customer_company_name_th),
    guest_branch: clean(doc.customer_branch),
    guest_address_th: clean(doc.customer_address_th),
    discount: num(doc.discount),
  };
  return { core, patch };
}

/** Reduce the invoice patch to only the fields worth an UPDATE round-trip. Pure. */
export function applyableInvoicePatch(patch: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "discount") {
      if (num(v) !== 0) out.discount = num(v);
      continue;
    }
    if (v !== null && v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

/**
 * Pre-fill a credit-note / debit-note draft from an existing invoice + items.
 * Amounts stay POSITIVE — the doc_type carries the sign into the VAT / GL
 * reports; it is not baked into the stored numbers here. Pure.
 */
export function creditDebitPrefill(
  invoice: Record<string, unknown> = {},
  invoiceItems: readonly ItemLike[] = [],
  docType = "credit-note",
) {
  return {
    doc_type: docType,
    ref_invoice_id: invoice.id ?? null,
    contact_id: invoice.contact_id ?? null,
    booking_id: invoice.booking_id ?? null,
    customer_name: invoice.guest_name || "",
    customer_company_name: invoice.guest_company_name || null,
    customer_company_name_th: invoice.guest_company_name_th || null,
    customer_branch: invoice.guest_branch || null,
    customer_tax_id: invoice.guest_tax_id || null,
    customer_address: invoice.guest_address || null,
    customer_address_th: invoice.guest_address_th || null,
    customer_phone: invoice.guest_phone || null,
    customer_email: invoice.guest_email || null,
    currency: invoice.currency || "THB",
    vat_rate: num(invoice.vat_rate),
    vat_inclusive: !!invoice.vat_inclusive,
    discount: num(invoice.discount),
    items: (invoiceItems || []).map((it, i) => ({
      sort_order: i,
      description: it.description || "",
      unit: it.unit || null,
      qty: num(it.qty),
      unit_price: num(it.unit_price),
      is_discount: !!it.is_discount,
    })),
  };
}

/** Blank document header for the editor. Pure. */
export function newDocumentDraft(
  docType: string,
  { settings = {}, contact = null }: { settings?: Record<string, unknown>; contact?: Record<string, unknown> | null } = {},
) {
  const c: Record<string, unknown> = contact || {};
  return {
    doc_type: docType,
    status: "draft",
    number: null,
    issue_date: todayBkk(),
    due_date: null,
    credit_days: num(c.credit_days),
    contact_id: c.id ?? null,
    booking_id: null,
    ref_invoice_id: null,
    customer_name: c.name || "",
    customer_company_name: c.is_company ? (c.name_en || c.name || "") : "",
    customer_company_name_th: c.is_company ? (c.name || "") : "",
    customer_branch: c.branch || null,
    customer_tax_id: c.tax_id || null,
    customer_address: c.address || null,
    customer_address_th: null,
    customer_phone: c.phone || null,
    customer_email: c.email || null,
    currency: settings.currency || "THB",
    vat_rate: settings.vat_rate != null ? num(settings.vat_rate) : 7,
    vat_inclusive: !!settings.vat_inclusive,
    discount: 0,
    notes: null,
    reason: null,
    salesperson: null,
  };
}

/** Add `credit_days` to an ISO date → due date string (or null). Pure. */
export function dueDateFrom(issueDate: string | null | undefined, creditDays: unknown): string | null {
  const days = num(creditDays);
  if (!issueDate || days <= 0) return null;
  const d = new Date(issueDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Local (Asia/Bangkok) date-only string — matches the +07 seam used across the app. */
export function todayBkk(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Fields of a header the DB accepts on insert/update (drops editor-only bits).
const HEADER_COLS = [
  "doc_type", "status", "issue_date", "due_date", "credit_days", "contact_id",
  "booking_id", "ref_invoice_id", "source_document_id", "converted_invoice_id",
  "customer_name", "customer_company_name", "customer_company_name_th",
  "customer_branch", "customer_tax_id", "customer_address", "customer_address_th",
  "customer_phone", "customer_email", "currency", "vat_rate", "vat_inclusive",
  "discount", "notes", "reason", "salesperson",
];

/** Keep only real header columns from an arbitrary object. Pure. */
export function pickHeaderColumns(obj: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of HEADER_COLS) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

// ── supabase I/O helpers ─────────────────────────────────────────────────────

/** Create a sales_document (+ optional items), tenant+property scoped. Returns id. */
export async function createDocument(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  header: Record<string, unknown> = {},
  items: readonly ItemLike[] = [],
): Promise<string> {
  const picked = pickHeaderColumns({ status: "draft", ...header });
  if (!picked.doc_type) throw new Error("createDocument: doc_type is required");
  const row = { ...picked, tenant_id: tenantId, property_id: propertyId };
  const { data: doc, error } = await supabase.from("sales_documents").insert(row).select("id").single();
  if (error) throw error;

  const lines = mapDocItemsToDocItems(items);
  if (lines.length > 0) {
    const { error: e2 } = await supabase
      .from("sales_document_items")
      .insert(lines.map((l) => ({ ...l, tenant_id: tenantId, property_id: propertyId, document_id: doc.id })));
    if (e2) throw e2;
  }
  return doc.id;
}

/** Patch a document header. Only real columns are written. */
export async function updateDocumentHeader(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from("sales_documents").update(pickHeaderColumns(patch)).eq("id", id);
  if (error) throw error;
}

/** Transition a document (draft→awaiting / approved / processed / rejected).
 *  Mints the per-tenant running number the first time it leaves draft. */
export async function issueDocument(supabase: SupabaseClient, id: string, status: string) {
  const { data, error } = await supabase.rpc("issue_sales_document", { p_document_id: id, p_status: status });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

/** Void a document (soft — keeps it in the list with a reason). */
export async function voidDocument(supabase: SupabaseClient, id: string, reason?: string | null): Promise<void> {
  const { error } = await supabase
    .from("sales_documents")
    .update({ status: "void", voided_at: new Date().toISOString(), void_reason: reason || null })
    .eq("id", id);
  if (error) throw error;
}

/** Create (or upsert-by-nothing) a contact, tenant+property scoped. Returns the row. */
export async function createContact(
  supabase: SupabaseClient,
  { tenantId, propertyId }: TenantScope,
  fields: Record<string, unknown> = {},
) {
  const row = {
    tenant_id: tenantId,
    property_id: propertyId,
    kind: fields.kind || "customer",
    is_company: !!fields.is_company,
    name: fields.name || "",
    name_en: clean(fields.name_en),
    tax_id: clean(fields.tax_id),
    branch: fields.branch || (fields.is_company ? "สำนักงานใหญ่" : null),
    address: clean(fields.address),
    zipcode: clean(fields.zipcode),
    email: clean(fields.email),
    phone: clean(fields.phone),
    credit_days: num(fields.credit_days),
    notes: clean(fields.notes),
  };
  const { data, error } = await supabase.from("contacts").insert(row).select("*").single();
  if (error) throw error;
  return data;
}
