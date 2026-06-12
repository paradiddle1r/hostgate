import "server-only";

// Phase G — Admin data layer: activity log + member management (via the
// owner/admin-guarded SECURITY DEFINER functions). Member listing reuses
// app_tenant_members (see lib/db/operations.ts → listTenantMembers).

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";

export interface ActivityEntry {
  id: string;
  tenant_id: string;
  property_id: string | null;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export async function listActivity(tenantId: string, limit = 200): Promise<ActionResult<ActivityEntry[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("activity_log").select("*").eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return ok((data ?? []) as ActivityEntry[]);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Best-effort audit write. Never throws — logging must not break the action. */
export async function logActivity(
  tenantId: string,
  entry: { property_id?: string | null; action: string; entity?: string | null; entity_id?: string | null; detail?: Record<string, unknown> | null }
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("activity_log").insert({
      tenant_id: tenantId,
      property_id: entry.property_id ?? null,
      actor_id: u.user?.id ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entity_id ?? null,
      detail: entry.detail ?? null,
    });
  } catch {
    /* swallow — audit is non-critical */
  }
}

// ── member management ────────────────────────────────────────────────────────
export async function addMemberByEmail(
  tenantId: string, email: string, role: string
): Promise<ActionResult<{ user_id: string }>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("app_add_member_by_email", {
      p_tenant: tenantId, p_email: email, p_role: role,
    });
    if (error) throw error;
    return ok({ user_id: data as string });
  } catch (e) {
    return mapPgError(e);
  }
}

export async function setMemberRole(
  tenantId: string, userId: string, role: string
): Promise<ActionResult<{ ok: true }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("app_set_member_role", {
      p_tenant: tenantId, p_user: userId, p_role: role,
    });
    if (error) throw error;
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}

export async function removeMember(
  tenantId: string, userId: string
): Promise<ActionResult<{ ok: true }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("app_remove_member", { p_tenant: tenantId, p_user: userId });
    if (error) throw error;
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}
