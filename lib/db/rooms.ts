import "server-only";

// Data access for rooms. Every insert carries tenant_id + property_id (the
// assert_property_in_tenant() trigger raises HG-PROP-404 if they disagree).
// Duplicate room numbers surface as HG-ROOM-409 via mapPgError's 23505 hint.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";

export interface Room {
  id: string;
  tenant_id: string;
  property_id: string;
  room_type_id: string | null;
  number: string;
  floor: number;
  status: "active" | "inactive";
  sort_order: number;
  created_at: string;
  // ── parity (migration 15) — sell this room as a monthly rental ──────────────
  monthly_available: boolean; // NOT NULL default false
}

export interface NewRoomRow {
  number: string;
  floor: number;
  room_type_id: string | null;
  sort_order?: number;
}

/** All rooms for a property, ordered for display (sort_order, then number). */
export async function listRooms(propertyId: string): Promise<ActionResult<Room[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("property_id", propertyId)
      .order("sort_order", { ascending: true })
      .order("number", { ascending: true });
    if (error) throw error;
    return ok((data ?? []) as Room[]);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Insert many rooms at once; returns how many were created. */
export async function bulkCreateRooms(
  propertyId: string,
  tenantId: string,
  rows: NewRoomRow[]
): Promise<ActionResult<{ count: number }>> {
  try {
    const supabase = createClient();
    const payload = rows.map((r, i) => ({
      tenant_id: tenantId,
      property_id: propertyId,
      number: r.number,
      floor: r.floor,
      room_type_id: r.room_type_id,
      sort_order: r.sort_order ?? i,
    }));
    const { data, error } = await supabase.from("rooms").insert(payload).select("id");
    if (error) throw error;
    return ok({ count: data?.length ?? 0 });
  } catch (e) {
    return mapPgError(e);
  }
}

/** Patch a single room. tenant_id/property_id/id are not patchable here. */
export async function updateRoom(
  id: string,
  patch: Partial<Omit<Room, "id" | "tenant_id" | "property_id" | "created_at">>
): Promise<ActionResult<Room>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("rooms")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as Room);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Delete a room by id. */
export async function deleteRoom(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}
