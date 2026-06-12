"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import { addMemberByEmail, setMemberRole, removeMember, logActivity } from "@/lib/db/admin";

export async function inviteMember(email: string, role: string): Promise<ActionResult<{ user_id: string }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const tid = active.data.tenant.id;
  const res = await addMemberByEmail(tid, email, role);
  if (res.ok) {
    await logActivity(tid, { action: "member.add", entity: "member", entity_id: res.data.user_id, detail: { email, role } });
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
