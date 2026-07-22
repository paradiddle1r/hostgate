import "server-only";

// Contacts = the unified customer/vendor billing directory (migration 21).
// Shared by the sales-documents surface (customers) and the expenses surface
// (vendors). Corporate billing profile: name/name_en, tax id, branch, address,
// credit terms. RLS scopes every read to the caller's tenant; every write
// stamps tenant_id + property_id from the active-property context.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";

export type ContactKind = "customer" | "vendor" | "both";

export interface Contact {
  id: string;
  tenant_id: string;
  property_id: string;
  kind: ContactKind;
  is_company: boolean;
  name: string;
  name_en: string | null;
  tax_id: string | null;
  branch: string | null;
  address: string | null;
  zipcode: string | null;
  email: string | null;
  phone: string | null;
  credit_days: number;
  notes: string | null;
  active: boolean;
  created_at: string;
}

export interface ContactInput {
  kind?: ContactKind;
  is_company?: boolean;
  name: string;
  name_en?: string | null;
  tax_id?: string | null;
  branch?: string | null;
  address?: string | null;
  zipcode?: string | null;
  email?: string | null;
  phone?: string | null;
  credit_days?: number | null;
  notes?: string | null;
}

const clean = <T>(v: T | undefined | null): T | null =>
  v === undefined || (v as unknown) === "" ? null : v;

/** List contacts for a property, optionally filtered to customers or vendors.
 *  `kind='customer'` matches customer+both; `kind='vendor'` matches vendor+both. */
export async function listContacts(
  propertyId: string,
  kind?: "customer" | "vendor"
): Promise<ActionResult<Contact[]>> {
  try {
    const supabase = createClient();
    let query = supabase
      .from("contacts")
      .select("*")
      .eq("property_id", propertyId)
      .eq("active", true);
    if (kind) query = query.in("kind", [kind, "both"]);
    const { data, error } = await query.order("name").limit(1000);
    if (error) throw error;
    return ok((data ?? []) as Contact[]);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Create a contact, stamped to the active tenant+property. */
export async function createContact(
  propertyId: string,
  tenantId: string,
  input: ContactInput
): Promise<ActionResult<Contact>> {
  try {
    const supabase = createClient();
    const isCompany = !!input.is_company;
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        kind: input.kind || "customer",
        is_company: isCompany,
        name: input.name || "",
        name_en: clean(input.name_en),
        tax_id: clean(input.tax_id),
        branch: input.branch || (isCompany ? "สำนักงานใหญ่" : null),
        address: clean(input.address),
        zipcode: clean(input.zipcode),
        email: clean(input.email),
        phone: clean(input.phone),
        credit_days: Number(input.credit_days) || 0,
        notes: clean(input.notes),
      })
      .select("*")
      .single();
    if (error) throw error;
    return ok(data as Contact);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Patch a contact's editable fields. */
export async function updateContact(
  id: string,
  patch: Partial<ContactInput>
): Promise<ActionResult<Contact>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contacts")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return ok(data as Contact);
  } catch (e) {
    return mapPgError(e);
  }
}
