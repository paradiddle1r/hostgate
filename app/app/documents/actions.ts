"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, ActionErr, ok, fail } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import { getActiveRole, canApprove } from "@/lib/active-role-server";
import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/db/properties";
import {
  listDocuments,
  getDocument,
  createDocument,
  saveDocument,
  transitionDocument,
  voidDocument,
  cloneToBillingNote,
  convertToInvoice,
  loadCreditDebitPrefill,
  type DocType,
  type DocStatus,
  type SalesDocument,
  type SalesDocumentItem,
  type DocItemInput,
} from "@/lib/db/documents";
import { createContact, type ContactInput } from "@/lib/db/contacts";

async function ctx() {
  const active = await getActiveProperty();
  if (!active.ok) return { ok: false as const, res: active };
  const p = active.data.property;
  return { ok: true as const, propertyId: p.id, tenantId: p.tenant_id };
}

async function requireApprover(): Promise<ActionErr | null> {
  const role = await getActiveRole();
  if (!canApprove(role)) return fail("HG-AUTH-403", "Only an owner or admin can do that.");
  return null;
}

export async function createDocumentAction(
  header: Record<string, unknown>,
  items: DocItemInput[]
): Promise<ActionResult<{ id: string }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await createDocument(c.propertyId, c.tenantId, header, items);
  if (res.ok) revalidatePath("/app/documents");
  return res;
}

export async function saveDocumentAction(
  id: string,
  header: Record<string, unknown>,
  items: DocItemInput[]
): Promise<ActionResult<{ ok: true }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await saveDocument(id, c.tenantId, c.propertyId, header, items);
  if (res.ok) revalidatePath(`/app/documents/${id}`);
  return res;
}

/** Submit for review (staff) → 'awaiting'. */
export async function submitDocumentAction(id: string): Promise<ActionResult<SalesDocument>> {
  const res = await transitionDocument(id, "awaiting");
  if (res.ok) {
    revalidatePath("/app/documents");
    revalidatePath(`/app/documents/${id}`);
  }
  return res;
}

/** Approve / reject / process — owner/admin only. */
export async function decideDocumentAction(
  id: string,
  status: Extract<DocStatus, "approved" | "rejected" | "processed">
): Promise<ActionResult<SalesDocument>> {
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await transitionDocument(id, status);
  if (res.ok) {
    revalidatePath("/app/documents");
    revalidatePath(`/app/documents/${id}`);
  }
  return res;
}

export async function voidDocumentAction(id: string, reason?: string): Promise<ActionResult<{ ok: true }>> {
  const denied = await requireApprover();
  if (denied) return denied;
  const res = await voidDocument(id, reason?.trim() || null);
  if (res.ok) {
    revalidatePath("/app/documents");
    revalidatePath(`/app/documents/${id}`);
  }
  return res;
}

export async function cloneToBillingNoteAction(id: string): Promise<ActionResult<{ id: string }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await cloneToBillingNote(id, c.tenantId, c.propertyId);
  if (res.ok) revalidatePath("/app/documents");
  return res;
}

export async function convertToInvoiceAction(id: string): Promise<ActionResult<{ invoiceId: string }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await convertToInvoice(id, c.tenantId, c.propertyId);
  if (!res.ok) return res;
  revalidatePath("/app/documents");
  revalidatePath(`/app/documents/${id}`);
  revalidatePath("/app/invoices");
  return ok({ invoiceId: res.data.invoiceId });
}

export async function createCustomerAction(input: ContactInput): Promise<ActionResult<{ id: string; name: string }>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const res = await createContact(c.propertyId, c.tenantId, { ...input, kind: input.kind || "customer" });
  if (!res.ok) return res;
  return ok({ id: res.data.id, name: res.data.name });
}

export async function loadCreditDebitPrefillAction(
  invoiceId: string,
  docType: "credit-note" | "debit-note"
): Promise<ActionResult<Record<string, unknown>>> {
  return loadCreditDebitPrefill(invoiceId, docType);
}

// ── print loader ─────────────────────────────────────────────────────────────
export type PrintDocumentPayload = {
  doc: SalesDocument;
  items: SalesDocumentItem[];
  property: Property | null;
};

export async function loadDocumentForPrint(id: string): Promise<ActionResult<PrintDocumentPayload>> {
  const res = await getDocument(id);
  if (!res.ok) return res;
  const supabase = createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", res.data.doc.property_id)
    .maybeSingle();
  return ok({ doc: res.data.doc, items: res.data.items, property: (property as Property) ?? null });
}

export { listDocuments };
export type { DocType, DocStatus, SalesDocument, SalesDocumentItem };
