import "server-only";

// Data access for the guest CRM. Inserts carry tenant_id + property_id;
// the assert_property_in_tenant trigger (HG-PROP-404) guards mismatches.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";

export interface Guest {
  id: string;
  tenant_id: string;
  property_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  nationality: string | null;
  notes: string | null;
  created_at: string;
}

export interface GuestInput {
  full_name: string;
  phone?: string;
  email?: string;
  id_number?: string;
  nationality?: string;
  notes?: string;
}

/**
 * Search guests within a property. Non-empty `q` does a case-insensitive
 * match on full_name OR phone; empty `q` returns the 50 most recent. Cap 50.
 */
export async function searchGuests(
  propertyId: string,
  q: string
): Promise<ActionResult<Guest[]>> {
  try {
    const supabase = createClient();
    let query = supabase.from("guests").select("*").eq("property_id", propertyId);

    const term = q.trim();
    if (term) {
      // Escape PostgREST-significant chars in the user term.
      const safe = term.replace(/[%,()]/g, " ");
      query = query.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return ok((data ?? []) as Guest[]);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Fetch one guest by id. */
export async function getGuest(id: string): Promise<ActionResult<Guest>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return ok(data as Guest);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Create a guest under a property. */
export async function createGuest(
  propertyId: string,
  tenantId: string,
  input: GuestInput
): Promise<ActionResult<Guest>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("guests")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        full_name: input.full_name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        id_number: input.id_number ?? null,
        nationality: input.nationality ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as Guest);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Patch a guest. tenant_id/property_id/id are not patchable here. */
export async function updateGuest(
  id: string,
  patch: Partial<GuestInput>
): Promise<ActionResult<Guest>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("guests")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as Guest);
  } catch (e) {
    return mapPgError(e);
  }
}
