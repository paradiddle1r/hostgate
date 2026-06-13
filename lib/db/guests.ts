import "server-only";

// Data access for the guest CRM. Inserts carry tenant_id + property_id;
// the assert_property_in_tenant trigger (HG-PROP-404) guards mismatches.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";
import type { Booking } from "@/lib/db/bookings";

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
  is_vip: boolean;
  is_blacklisted: boolean;
  created_at: string;
  // ── parity (migration 15) ──────────────────────────────────────────────────
  thai_name: string | null;
  car_plate: string | null;
  preferences: string | null;
  blacklist_reason: string | null;
  tags: string[]; // NOT NULL default '{}'
  citizen_id: string | null;
  id_dob: string | null;
  id_gender: string | null;
  id_issued_date: string | null;
  id_expires_date: string | null;
  id_address: string | null;
  id_photo_path: string | null;
  updated_at: string; // NOT NULL default now()
}

export interface GuestInput {
  full_name: string;
  phone?: string;
  email?: string;
  id_number?: string;
  nationality?: string;
  notes?: string;
  is_vip?: boolean;
  is_blacklisted?: boolean;
  // ── parity (migration 15) ──────────────────────────────────────────────────
  thai_name?: string | null;
  car_plate?: string | null;
  preferences?: string | null;
  blacklist_reason?: string | null;
  tags?: string[];
  citizen_id?: string | null;
  id_dob?: string | null;
  id_gender?: string | null;
  id_issued_date?: string | null;
  id_expires_date?: string | null;
  id_address?: string | null;
  id_photo_path?: string | null;
}

export interface GuestStays {
  visits: number;
  nights: number;
  spend: number;
  lastStay: string | null;
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

/** Fetch one guest plus every booking linked to it (newest check-in first). */
export async function getGuestWithBookings(
  id: string
): Promise<ActionResult<{ guest: Guest; bookings: Booking[] }>> {
  try {
    const supabase = createClient();
    const { data: guest, error } = await supabase
      .from("guests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!guest) return fail("HG-BOOK-404", "Guest not found.");
    const { data: bookings, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("guest_id", id)
      .order("check_in", { ascending: false });
    if (bErr) throw bErr;
    return ok({ guest: guest as Guest, bookings: (bookings ?? []) as Booking[] });
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
        is_vip: input.is_vip ?? false,
        is_blacklisted: input.is_blacklisted ?? false,
        // ── parity (migration 15) ──────────────────────────────────────────
        thai_name: input.thai_name ?? null,
        car_plate: input.car_plate ?? null,
        preferences: input.preferences ?? null,
        blacklist_reason: input.blacklist_reason ?? null,
        tags: input.tags ?? [],
        citizen_id: input.citizen_id ?? null,
        id_dob: input.id_dob ?? null,
        id_gender: input.id_gender ?? null,
        id_issued_date: input.id_issued_date ?? null,
        id_expires_date: input.id_expires_date ?? null,
        id_address: input.id_address ?? null,
        id_photo_path: input.id_photo_path ?? null,
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

/** Flip the VIP / blacklist flags on a guest. Thin wrapper over updateGuest. */
export async function setGuestFlag(
  id: string,
  patch: { is_vip?: boolean; is_blacklisted?: boolean }
): Promise<ActionResult<Guest>> {
  return updateGuest(id, patch);
}

/**
 * Aggregate stay history for one guest within a property. Counts non-cancelled
 * bookings: visits, total nights, total spend, and the latest check-in date.
 * Nights/spend are computed in JS from the selected rows.
 */
export async function guestStays(
  propertyId: string,
  guestId: string
): Promise<ActionResult<GuestStays>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("check_in, check_out, total_amount, status")
      .eq("property_id", propertyId)
      .eq("guest_id", guestId)
      .neq("status", "cancelled");
    if (error) throw error;

    const rows = (data ?? []) as Array<{
      check_in: string | null;
      check_out: string | null;
      total_amount: number | string | null;
      status: string | null;
    }>;

    let nights = 0;
    let spend = 0;
    let lastStay: string | null = null;

    for (const r of rows) {
      // Nights: only when both endpoints exist. Date-only strings parse as
      // UTC midnight, so the day delta is exact.
      if (r.check_in && r.check_out) {
        const ms = new Date(r.check_out).getTime() - new Date(r.check_in).getTime();
        if (Number.isFinite(ms) && ms > 0) {
          nights += Math.round(ms / 86_400_000);
        }
      }

      const amt = Number(r.total_amount);
      if (Number.isFinite(amt)) spend += amt;

      if (r.check_in && (lastStay === null || r.check_in > lastStay)) {
        lastStay = r.check_in;
      }
    }

    return ok({ visits: rows.length, nights, spend, lastStay });
  } catch (e) {
    return mapPgError(e);
  }
}
