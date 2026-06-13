import "server-only";

// Parity (migration 15) — pinned announcement banners. Tenant + property scoped
// under RLS (`tenant_id in (select auth_tenant_ids())`); every insert carries
// tenant_id + property_id and passes the assert_property_in_tenant guard
// (HG-PROP-404 → recovered by mapPgError).

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";

export type AnnouncementSeverity = "info" | "warning" | "critical";

export interface Announcement {
  id: string;
  tenant_id: string;
  property_id: string;
  author_id: string | null;
  title: string; // NOT NULL default ''
  body: string; // NOT NULL default ''
  severity: AnnouncementSeverity; // NOT NULL default 'info'
  is_pinned: boolean; // NOT NULL default true
  created_at: string;
}

export interface AnnouncementInput {
  title?: string;
  body?: string;
  severity?: AnnouncementSeverity;
  is_pinned?: boolean;
}

/** All announcements for a property — pinned first, then newest. */
export async function listAnnouncements(propertyId: string): Promise<ActionResult<Announcement[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("property_id", propertyId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ok((data ?? []) as Announcement[]);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Pinned announcements only (the banner feed), newest first. */
export async function listPinned(propertyId: string): Promise<ActionResult<Announcement[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("property_id", propertyId)
      .eq("is_pinned", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ok((data ?? []) as Announcement[]);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Create an announcement. author_id is stamped from the signed-in user. */
export async function createAnnouncement(
  propertyId: string,
  tenantId: string,
  input: AnnouncementInput
): Promise<ActionResult<Announcement>> {
  try {
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        author_id: u.user?.id ?? null,
        title: input.title ?? "",
        body: input.body ?? "",
        severity: input.severity ?? "info",
        is_pinned: input.is_pinned ?? true,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as Announcement);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Patch an announcement. tenant_id/property_id/id are not patchable here. */
export async function updateAnnouncement(
  id: string,
  patch: Partial<AnnouncementInput>
): Promise<ActionResult<Announcement>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("announcements")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as Announcement);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Delete an announcement by id. */
export async function deleteAnnouncement(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}
