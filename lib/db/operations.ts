import "server-only";

// Phase C — Operations data layer: housekeeping tasks, staff shifts, and
// maintenance / out-of-service orders. Plus a tenant member directory (via the
// app_tenant_members SECURITY DEFINER fn, since user_profiles is self-select).
// Every write carries tenant_id + property_id and passes the
// assert_property_in_tenant guard; all reads are RLS-scoped to the caller.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";

// ── member directory ─────────────────────────────────────────────────────────
export interface TenantMember {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: "owner" | "admin" | "staff";
  // ── parity (migration 15) — staff position + active/disable ─────────────────
  // display_name/email come from the SECURITY DEFINER RPC (user_profiles is
  // self-select under RLS); position/is_active come from a direct tenant_members
  // read, merged by user_id. Defaults applied for any member row that predates
  // the columns.
  position: string | null;
  is_active: boolean;
}

export async function listTenantMembers(tenantId: string): Promise<ActionResult<TenantMember[]>> {
  try {
    const supabase = createClient();
    // Names/emails via the definer RPC (reaches user_profiles + auth.users).
    const { data, error } = await supabase.rpc("app_tenant_members", { p_tenant: tenantId });
    if (error) throw error;
    const base = (data ?? []) as Array<Omit<TenantMember, "position" | "is_active">>;

    // position/is_active live on tenant_members itself — direct, RLS-scoped read
    // (members can SELECT all rows in their tenant). Merge by user_id.
    const { data: extra } = await supabase
      .from("tenant_members")
      .select("user_id, position, is_active")
      .eq("tenant_id", tenantId);
    const byId = new Map(
      ((extra ?? []) as Array<{ user_id: string; position: string | null; is_active: boolean | null }>).map(
        (r) => [r.user_id, r]
      )
    );

    const rows: TenantMember[] = base.map((m) => {
      const e = byId.get(m.user_id);
      return { ...m, position: e?.position ?? null, is_active: e?.is_active ?? true };
    });
    return ok(rows);
  } catch (e) {
    return mapPgError(e);
  }
}

// ── housekeeping ─────────────────────────────────────────────────────────────
export type HousekeepingStatus = "dirty" | "in-progress" | "clean" | "inspected" | "skipped";
export type HousekeepingType =
  | "checkout-clean" | "daily-clean" | "deep-clean" | "inspection"
  | "linen" | "turndown" | "maintenance-prep" | "other";
export type Priority = "low" | "normal" | "high" | "urgent";

export interface HousekeepingTask {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string;
  booking_id: string | null;
  task_type: HousekeepingType;
  status: HousekeepingStatus;
  priority: Priority;
  notes: string | null;
  assigned_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  inspected_at: string | null;
  inspected_by: string | null;
  created_at: string;
  // ── parity (migration 15) ──────────────────────────────────────────────────
  due_date: string; // NOT NULL default current_date
  created_by: string | null;
}

export interface HousekeepingInput {
  room_id: string;
  task_type?: HousekeepingType;
  status?: HousekeepingStatus;
  priority?: Priority;
  notes?: string | null;
  assigned_to?: string | null;
  // ── parity (migration 15) ──────────────────────────────────────────────────
  due_date?: string;
  created_by?: string | null;
}

export async function listHousekeeping(
  propertyId: string,
  opts?: { status?: HousekeepingStatus; task_type?: HousekeepingType }
): Promise<ActionResult<HousekeepingTask[]>> {
  try {
    const supabase = createClient();
    let q = supabase.from("housekeeping_tasks").select("*").eq("property_id", propertyId);
    if (opts?.status) q = q.eq("status", opts.status);
    if (opts?.task_type) q = q.eq("task_type", opts.task_type);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return ok((data ?? []) as HousekeepingTask[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function createHousekeepingTask(
  propertyId: string,
  tenantId: string,
  input: HousekeepingInput
): Promise<ActionResult<HousekeepingTask>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("housekeeping_tasks")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        room_id: input.room_id,
        task_type: input.task_type ?? "daily-clean",
        status: input.status ?? "dirty",
        priority: input.priority ?? "normal",
        notes: input.notes ?? null,
        assigned_to: input.assigned_to ?? null,
        // ── parity (migration 15) — omit due_date when unset so the DB
        // default (current_date) applies. ──────────────────────────────────
        ...(input.due_date ? { due_date: input.due_date } : {}),
        created_by: input.created_by ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as HousekeepingTask);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Move a task to a new status, stamping the matching audit columns. */
export async function setHousekeepingStatus(
  id: string,
  status: HousekeepingStatus,
  byUserId?: string | null
): Promise<ActionResult<HousekeepingTask>> {
  try {
    const supabase = createClient();
    const patch: Record<string, unknown> = { status };
    const now = new Date().toISOString();
    if (status === "in-progress") patch.started_at = now;
    if (status === "clean") {
      patch.completed_at = now;
      patch.completed_by = byUserId ?? null;
    }
    if (status === "inspected") {
      patch.inspected_at = now;
      patch.inspected_by = byUserId ?? null;
    }
    const { data, error } = await supabase
      .from("housekeeping_tasks")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as HousekeepingTask);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function updateHousekeepingTask(
  id: string,
  patch: Partial<Pick<HousekeepingTask, "priority" | "notes" | "assigned_to" | "task_type" | "due_date">>
): Promise<ActionResult<HousekeepingTask>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("housekeeping_tasks").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as HousekeepingTask);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function deleteHousekeepingTask(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("housekeeping_tasks").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── shifts ───────────────────────────────────────────────────────────────────
export type ShiftType = "day" | "night" | "custom";

export interface ShiftAssignment {
  id: string;
  tenant_id: string;
  property_id: string;
  member_id: string;
  work_date: string;
  shift_type: ShiftType;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_at: string;
}

export interface ShiftInput {
  member_id: string;
  work_date: string;
  shift_type?: ShiftType;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
}

export async function listShifts(
  propertyId: string,
  fromISO: string,
  toISO: string
): Promise<ActionResult<ShiftAssignment[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shift_assignments")
      .select("*")
      .eq("property_id", propertyId)
      .gte("work_date", fromISO)
      .lte("work_date", toISO)
      .order("work_date", { ascending: true });
    if (error) throw error;
    return ok((data ?? []) as ShiftAssignment[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function createShift(
  propertyId: string,
  tenantId: string,
  input: ShiftInput
): Promise<ActionResult<ShiftAssignment>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shift_assignments")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        member_id: input.member_id,
        work_date: input.work_date,
        shift_type: input.shift_type ?? "day",
        start_time: input.start_time ?? null,
        end_time: input.end_time ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as ShiftAssignment);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function deleteShift(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("shift_assignments").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── maintenance ──────────────────────────────────────────────────────────────
export type MaintenanceStatus = "open" | "in-progress" | "resolved";

export type MaintenanceIssueType =
  | "water" | "electricity" | "air-conditioner" | "furniture" | "toilet" | "other";

export interface MaintenanceOrder {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string | null;
  title: string;
  description: string | null;
  status: MaintenanceStatus;
  priority: Priority;
  cost: number | null;
  revenue_lost: number | null;
  oos_from: string | null;
  oos_to: string | null;
  reported_at: string;
  resolved_at: string | null;
  created_at: string;
  // ── parity (migration 15) ──────────────────────────────────────────────────
  issue_type: MaintenanceIssueType | null;
}

export interface MaintenanceInput {
  room_id?: string | null;
  title: string;
  description?: string | null;
  status?: MaintenanceStatus;
  priority?: Priority;
  cost?: number | null;
  revenue_lost?: number | null;
  oos_from?: string | null;
  oos_to?: string | null;
  // ── parity (migration 15) ──────────────────────────────────────────────────
  issue_type?: MaintenanceIssueType | null;
}

export async function listMaintenance(
  propertyId: string,
  opts?: { status?: MaintenanceStatus }
): Promise<ActionResult<MaintenanceOrder[]>> {
  try {
    const supabase = createClient();
    let q = supabase.from("maintenance_orders").select("*").eq("property_id", propertyId);
    if (opts?.status) q = q.eq("status", opts.status);
    const { data, error } = await q.order("reported_at", { ascending: false }).limit(500);
    if (error) throw error;
    return ok((data ?? []) as MaintenanceOrder[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function createMaintenance(
  propertyId: string,
  tenantId: string,
  input: MaintenanceInput
): Promise<ActionResult<MaintenanceOrder>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("maintenance_orders")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        room_id: input.room_id ?? null,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "open",
        priority: input.priority ?? "normal",
        cost: input.cost ?? null,
        revenue_lost: input.revenue_lost ?? null,
        oos_from: input.oos_from ?? null,
        oos_to: input.oos_to ?? null,
        issue_type: input.issue_type ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as MaintenanceOrder);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function updateMaintenance(
  id: string,
  patch: Partial<MaintenanceInput>
): Promise<ActionResult<MaintenanceOrder>> {
  try {
    const supabase = createClient();
    // Auto-stamp resolved_at when transitioning to resolved.
    const body: Record<string, unknown> = { ...patch };
    if (patch.status === "resolved") body.resolved_at = new Date().toISOString();
    if (patch.status && patch.status !== "resolved") body.resolved_at = null;
    const { data, error } = await supabase
      .from("maintenance_orders").update(body).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as MaintenanceOrder);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function deleteMaintenance(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("maintenance_orders").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}
