import "server-only";

// Data access for bookings. Inserts/updates carry tenant_id + property_id and
// pass through three DB triggers: assert_property_in_tenant (HG-PROP-404),
// assert_no_room_conflict (HG-BOOK-409), and gen_booking_code (auto `code`).
// All recovered by mapPgError, so we just throw the PostgREST error.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled";

export type BookingSource = "direct" | "walk_in" | "ota" | "web";

export interface Booking {
  id: string;
  tenant_id: string;
  property_id: string;
  code: string;
  room_id: string | null;
  room_type_id: string | null;
  guest_id: string | null;
  guest_name: string;
  phone: string | null;
  check_in: string;
  check_out: string;
  status: BookingStatus;
  source: BookingSource;
  adults: number;
  children: number;
  total_amount: number | null;
  notes: string | null;
  created_at: string;
}

export interface BookingInput {
  room_id?: string | null;
  room_type_id?: string | null;
  guest_id?: string | null;
  guest_name?: string;
  phone?: string | null;
  check_in: string;
  check_out: string;
  status?: BookingStatus;
  source?: BookingSource;
  adults?: number;
  children?: number;
  total_amount?: number | null;
  notes?: string | null;
}

/**
 * Bookings overlapping the [fromISO, toISO) window: check_in < to AND
 * check_out > from. Returns every status (cancelled included) — let the UI
 * filter. Ordered by check_in.
 */
export async function listBookings(
  propertyId: string,
  fromISO: string,
  toISO: string
): Promise<ActionResult<Booking[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("property_id", propertyId)
      .lt("check_in", toISO)
      .gt("check_out", fromISO)
      .order("check_in", { ascending: true });
    if (error) throw error;
    return ok((data ?? []) as Booking[]);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Create a booking. Surfaces HG-BOOK-409 from the conflict trigger. */
export async function createBooking(
  propertyId: string,
  tenantId: string,
  input: BookingInput
): Promise<ActionResult<Booking>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        room_id: input.room_id ?? null,
        room_type_id: input.room_type_id ?? null,
        guest_id: input.guest_id ?? null,
        guest_name: input.guest_name ?? "Guest",
        phone: input.phone ?? null,
        check_in: input.check_in,
        check_out: input.check_out,
        status: input.status ?? "confirmed",
        source: input.source ?? "direct",
        adults: input.adults ?? 1,
        children: input.children ?? 0,
        total_amount: input.total_amount ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as Booking);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Patch a booking. Surfaces HG-BOOK-409 if the change creates a conflict. */
export async function updateBooking(
  id: string,
  patch: Partial<BookingInput>
): Promise<ActionResult<Booking>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bookings")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as Booking);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Shortcut for status-only changes (check-in, check-out, cancel, …). */
export async function setBookingStatus(
  id: string,
  status: BookingStatus
): Promise<ActionResult<Booking>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as Booking);
  } catch (e) {
    return mapPgError(e);
  }
}
