"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import { createClient } from "@/lib/supabase/server";
import {
  createShift,
  deleteShift,
  ShiftInput,
  ShiftAssignment,
  ShiftType,
} from "@/lib/db/operations";

// ── role gate ────────────────────────────────────────────────────────────────
// Shift + staff edits are owner/admin only (parity: hotel-pms gates these behind
// admin/supervisor; staff get read-only). We resolve the caller's role in the
// active tenant on the server so a read-only staff member can't bypass the UI by
// invoking the action directly.
async function requireManage(): Promise<
  | { ok: true; tenantId: string; propertyId: string }
  | { ok: false; res: ActionResult<never> }
> {
  const active = await getActiveProperty();
  if (!active.ok) return { ok: false, res: active };
  const { tenant, property } = active.data;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, res: fail("HG-AUTH-401", "You are not signed in.") };
  const { data: me, error } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { ok: false, res: mapPgError(error) };
  const role = (me?.role as string | undefined) ?? "staff";
  if (role !== "owner" && role !== "admin") {
    return { ok: false, res: fail("HG-AUTH-403", "You don't have permission to edit shifts.") };
  }
  return { ok: true, tenantId: tenant.id, propertyId: property.id };
}

// ── single shift create / delete ──────────────────────────────────────────────
export async function newShift(input: ShiftInput): Promise<ActionResult<ShiftAssignment>> {
  const gate = await requireManage();
  if (!gate.ok) return gate.res;
  const res = await createShift(gate.propertyId, gate.tenantId, input);
  if (res.ok) revalidatePath("/app/shifts");
  return res;
}

export async function removeShift(id: string): Promise<ActionResult<{ id: string }>> {
  const gate = await requireManage();
  if (!gate.ok) return gate.res;
  const res = await deleteShift(id);
  if (res.ok) revalidatePath("/app/shifts");
  return res;
}

// ── bulk assign (member × date-range × shifts × weekdays) ──────────────────────
// Generates one row per (date × shift) and upserts in one round trip. The DB
// UNIQUE (property_id, member_id, work_date, shift_type) makes re-runs idempotent,
// so applying a weekly template twice never duplicates rows.
export interface BulkAssignInput {
  member_id: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  shifts: ShiftType[]; // e.g. ["day"] or ["day","night"]
  weekdays: number[]; // 0=Sun … 6=Sat
  start_time?: string | null; // "HH:MM" or "HH:MM:SS"
  end_time?: string | null;
}

function toTime(t: string | null | undefined): string | null {
  if (!t) return null;
  // Normalise "HH:MM" → "HH:MM:SS" for the postgres time column.
  return t.length === 5 ? `${t}:00` : t;
}

export async function bulkAssignShifts(
  input: BulkAssignInput
): Promise<ActionResult<{ count: number }>> {
  const gate = await requireManage();
  if (!gate.ok) return gate.res;

  if (!input.member_id) return fail("HG-VALIDATION-422", "Pick a member.");
  if (!input.from || !input.to) return fail("HG-VALIDATION-422", "Pick a date range.");
  if (input.from > input.to) return fail("HG-VALIDATION-422", "Start date is after end date.");
  if (!input.shifts || input.shifts.length === 0) return fail("HG-VALIDATION-422", "Pick at least one shift.");
  if (!input.weekdays || input.weekdays.length === 0) return fail("HG-VALIDATION-422", "Pick at least one weekday.");

  const wd = new Set(input.weekdays);
  const start = parseYMD(input.from);
  const end = parseYMD(input.to);
  const startTime = toTime(input.start_time);
  const endTime = toTime(input.end_time);

  const rows: Array<{
    tenant_id: string;
    property_id: string;
    member_id: string;
    work_date: string;
    shift_type: ShiftType;
    start_time: string | null;
    end_time: string | null;
  }> = [];

  const MAX_DAYS = 400; // ~13 months guard so a wide range can't run away
  let i = 0;
  for (let t = start.getTime(); t <= end.getTime() && i < MAX_DAYS; t += 86_400_000, i++) {
    const d = new Date(t);
    if (!wd.has(d.getDay())) continue;
    const dateStr = ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
    for (const sh of input.shifts) {
      rows.push({
        tenant_id: gate.tenantId,
        property_id: gate.propertyId,
        member_id: input.member_id,
        work_date: dateStr,
        shift_type: sh,
        start_time: startTime,
        end_time: endTime,
      });
    }
  }

  if (rows.length === 0) return fail("HG-VALIDATION-422", "No matching dates in that range.");

  try {
    const supabase = createClient();
    const CHUNK = 500;
    for (let c = 0; c < rows.length; c += CHUNK) {
      const slice = rows.slice(c, c + CHUNK);
      const { error } = await supabase
        .from("shift_assignments")
        .upsert(slice, { onConflict: "property_id,member_id,work_date,shift_type" });
      if (error) throw error;
    }
    revalidatePath("/app/shifts");
    return ok({ count: rows.length });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── staff management (position + active) ───────────────────────────────────────
// position/is_active live on the shared tenant_members table. Role changes still
// funnel only through the app_set_member_role() SECURITY DEFINER RPC, but these
// two columns are plain owner/admin-gated UPDATEs under RLS: migration
// 16_tenant_members_update_policy.sql adds an owner/admin UPDATE policy on
// tenant_members (role itself is left untouched here, so the policy can't be
// used to escalate). requireManage() is the app-layer gate before we ever hit
// the table.
export async function setMemberPosition(
  userId: string,
  position: string | null
): Promise<ActionResult<{ ok: true }>> {
  const gate = await requireManage();
  if (!gate.ok) return gate.res;
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("tenant_members")
      .update({ position: position && position.trim() ? position.trim() : null })
      .eq("tenant_id", gate.tenantId)
      .eq("user_id", userId);
    if (error) throw error;
    revalidatePath("/app/shifts");
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}

export async function setMemberActiveShifts(
  userId: string,
  isActive: boolean
): Promise<ActionResult<{ ok: true }>> {
  const gate = await requireManage();
  if (!gate.ok) return gate.res;
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("tenant_members")
      .update({ is_active: isActive })
      .eq("tenant_id", gate.tenantId)
      .eq("user_id", userId);
    if (error) throw error;
    revalidatePath("/app/shifts");
    return ok({ ok: true });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── local date helpers (avoid UTC drift on YYYY-MM-DD) ─────────────────────────
function parseYMD(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
