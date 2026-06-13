"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, fail } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import { createClient } from "@/lib/supabase/server";
import {
  Announcement,
  AnnouncementInput,
  listPinned,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "@/lib/db/announcements";

/**
 * Resolve the signed-in caller's role on the active tenant. owner/admin may
 * write announcements; staff are read-only (HG-AUTH-403). Returns the active
 * property + tenant so callers don't re-resolve.
 */
async function requireManager(): Promise<
  ActionResult<{ propertyId: string; tenantId: string }>
> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const { property, tenant } = active.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("HG-AUTH-401", "You are not signed in.");

  const { data: member } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (member?.role as string) ?? "staff";
  if (role !== "owner" && role !== "admin") {
    return fail("HG-AUTH-403", "Only owners and admins can manage announcements.");
  }
  return { ok: true, data: { propertyId: property.id, tenantId: tenant.id } };
}

/** Create an announcement for the active property (owner/admin only). */
export async function newAnnouncement(
  input: AnnouncementInput
): Promise<ActionResult<Announcement>> {
  const gate = await requireManager();
  if (!gate.ok) return gate;
  const res = await createAnnouncement(gate.data.propertyId, gate.data.tenantId, input);
  if (res.ok) {
    revalidatePath("/app/announcements");
    revalidatePath("/app");
  }
  return res;
}

/** Patch an announcement (owner/admin only). */
export async function editAnnouncement(
  id: string,
  patch: Partial<AnnouncementInput>
): Promise<ActionResult<Announcement>> {
  const gate = await requireManager();
  if (!gate.ok) return gate;
  const res = await updateAnnouncement(id, patch);
  if (res.ok) {
    revalidatePath("/app/announcements");
    revalidatePath("/app");
  }
  return res;
}

/** Delete an announcement (owner/admin only). */
export async function removeAnnouncement(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireManager();
  if (!gate.ok) return gate;
  const res = await deleteAnnouncement(id);
  if (res.ok) {
    revalidatePath("/app/announcements");
    revalidatePath("/app");
  }
  return res;
}

/**
 * Pinned announcements for the active property — the banner feed. Read-only,
 * available to any signed-in member (the banner shows for everyone). Self-fetched
 * by <AnnouncementBanner /> on mount.
 */
export async function getPinnedForBanner(): Promise<ActionResult<Announcement[]>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  return listPinned(active.data.property.id);
}
