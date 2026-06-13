import "server-only";

// Parity (migration 15) — team sticky notes. Tenant + property scoped under
// RLS (`tenant_id in (select auth_tenant_ids())`); every insert carries
// tenant_id + property_id and passes the assert_property_in_tenant guard
// (HG-PROP-404 → recovered by mapPgError).

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";

export interface Note {
  id: string;
  tenant_id: string;
  property_id: string;
  author_id: string | null;
  body: string; // NOT NULL default ''
  color: string; // NOT NULL default 'yellow'
  pinned: boolean; // NOT NULL default false
  done: boolean; // NOT NULL default false
  created_at: string;
  updated_at: string;
}

export interface NoteInput {
  body?: string;
  color?: string;
  pinned?: boolean;
  done?: boolean;
}

/** All notes for a property — pinned first, then newest. */
export async function listNotes(propertyId: string): Promise<ActionResult<Note[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("property_id", propertyId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ok((data ?? []) as Note[]);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Create a note. author_id is stamped from the signed-in user when present. */
export async function createNote(
  propertyId: string,
  tenantId: string,
  input: NoteInput
): Promise<ActionResult<Note>> {
  try {
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("notes")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        author_id: u.user?.id ?? null,
        body: input.body ?? "",
        color: input.color ?? "yellow",
        pinned: input.pinned ?? false,
        done: input.done ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as Note);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Patch a note. tenant_id/property_id/id are not patchable here. */
export async function updateNote(
  id: string,
  patch: Partial<NoteInput>
): Promise<ActionResult<Note>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notes")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as Note);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Delete a note by id. */
export async function deleteNote(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}
