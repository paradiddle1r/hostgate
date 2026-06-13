"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import { createClient } from "@/lib/supabase/server";
import {
  addMemberByEmail,
  setMemberRole,
  setMemberActive,
  removeMember,
  logActivity,
} from "@/lib/db/admin";

export async function inviteMember(
  email: string,
  role: string,
  position?: string,
): Promise<ActionResult<{ user_id: string }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const tid = active.data.tenant.id;
  const res = await addMemberByEmail(tid, email, role);
  if (res.ok) {
    // Optional staff position. There is no app_set_member_position RPC, so this
    // is a direct RLS-scoped UPDATE on tenant_members — same caveat as
    // setMemberActive: migration 01 defines no UPDATE policy on tenant_members,
    // so for non-service-role callers this affects 0 rows until a follow-up
    // migration adds an owner/admin UPDATE policy (or a definer RPC). Wired now,
    // best-effort — a failure never fails the invite.
    const pos = position?.trim();
    if (pos) {
      try {
        const supabase = createClient();
        await supabase
          .from("tenant_members")
          .update({ position: pos })
          .eq("tenant_id", tid)
          .eq("user_id", res.data.user_id);
      } catch {
        /* non-critical */
      }
    }
    await logActivity(tid, {
      action: "member.add",
      entity: "member",
      entity_id: res.data.user_id,
      detail: { email, role, position: pos || null },
    });
    revalidatePath("/app/team");
  }
  return res;
}

export async function changeRole(userId: string, role: string): Promise<ActionResult<{ ok: true }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const tid = active.data.tenant.id;
  const res = await setMemberRole(tid, userId, role);
  if (res.ok) {
    await logActivity(tid, { action: "member.role", entity: "member", entity_id: userId, detail: { role } });
    revalidatePath("/app/team");
  }
  return res;
}

export async function toggleMemberActive(
  userId: string,
  isActive: boolean,
): Promise<ActionResult<{ ok: true }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const tid = active.data.tenant.id;
  const res = await setMemberActive(tid, userId, isActive);
  if (res.ok) {
    await logActivity(tid, {
      action: "member.active",
      entity: "member",
      entity_id: userId,
      detail: { is_active: isActive },
    });
    revalidatePath("/app/team");
  }
  return res;
}

export async function kickMember(userId: string): Promise<ActionResult<{ ok: true }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const tid = active.data.tenant.id;
  const res = await removeMember(tid, userId);
  if (res.ok) {
    await logActivity(tid, { action: "member.remove", entity: "member", entity_id: userId });
    revalidatePath("/app/team");
  }
  return res;
}
