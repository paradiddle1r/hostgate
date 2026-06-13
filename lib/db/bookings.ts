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

export type BookingType = "standard" | "monthly" | "blocked" | "oos";

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
  // ── parity (migration 15) ──────────────────────────────────────────────────
  booking_type: BookingType; // NOT NULL default 'standard'
  issue_type: string | null;
  issue_detail: string | null;
  reservation_no: string | null;
  ota: string | null;
  booked_date: string | null;
  payment_method: string | null;
  amount_paid: number; // NOT NULL default 0
  deposit_date: string | null;
  deposit_method: string | null;
  reservation_deposit: number | null;
  extra_bed: boolean; // NOT NULL default false
  extra_bed_charge: number | null;
  booking_group_id: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  thai_name: string | null;
  car_plate: string | null;
  is_open_ended: boolean; // NOT NULL default false
  checkin_time: string | null;
  checkout_time: string | null;
  citizen_id: string | null;
  id_dob: string | null;
  id_gender: string | null;
  id_issued_date: string | null;
  id_expires_date: string | null;
  id_address: string | null;
  id_photo_path: string | null;
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
  // ── parity (migration 15) ──────────────────────────────────────────────────
  booking_type?: BookingType;
  issue_type?: string | null;
  issue_detail?: string | null;
  reservation_no?: string | null;
  ota?: string | null;
  booked_date?: string | null;
  payment_method?: string | null;
  amount_paid?: number;
  deposit_date?: string | null;
  deposit_method?: string | null;
  reservation_deposit?: number | null;
  extra_bed?: boolean;
  extra_bed_charge?: number | null;
  booking_group_id?: string | null;
  guest_first_name?: string | null;
  guest_last_name?: string | null;
  thai_name?: string | null;
  car_plate?: string | null;
  is_open_ended?: boolean;
  checkin_time?: string | null;
  checkout_time?: string | null;
  citizen_id?: string | null;
  id_dob?: string | null;
  id_gender?: string | null;
  id_issued_date?: string | null;
  id_expires_date?: string | null;
  id_address?: string | null;
  id_photo_path?: string | null;
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

/**
 * Flat list of every booking for a property — the Bookings list page.
 * Optional status filter + a fuzzy `q` (ilike on guest_name / code / phone).
 * Newest stays first (check_in desc), capped at 500.
 */
export async function listAllBookings(
  propertyId: string,
  opts?: { status?: BookingStatus; q?: string }
): Promise<ActionResult<Booking[]>> {
  try {
    const supabase = createClient();
    let query = supabase
      .from("bookings")
      .select("*")
      .eq("property_id", propertyId);

    if (opts?.status) query = query.eq("status", opts.status);

    const q = opts?.q?.trim();
    if (q) {
      const like = `%${q}%`;
      query = query.or(
        `guest_name.ilike.${like},code.ilike.${like},phone.ilike.${like}`
      );
    }

    const { data, error } = await query
      .order("check_in", { ascending: false })
      .limit(500);
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
        // ── parity (migration 15) ──────────────────────────────────────────
        // NOT NULL + default columns coalesce to their default; nullable → null.
        booking_type: input.booking_type ?? "standard",
        issue_type: input.issue_type ?? null,
        issue_detail: input.issue_detail ?? null,
        reservation_no: input.reservation_no ?? null,
        ota: input.ota ?? null,
        booked_date: input.booked_date ?? null,
        payment_method: input.payment_method ?? null,
        amount_paid: input.amount_paid ?? 0,
        deposit_date: input.deposit_date ?? null,
        deposit_method: input.deposit_method ?? null,
        reservation_deposit: input.reservation_deposit ?? null,
        extra_bed: input.extra_bed ?? false,
        extra_bed_charge: input.extra_bed_charge ?? null,
        booking_group_id: input.booking_group_id ?? null,
        guest_first_name: input.guest_first_name ?? null,
        guest_last_name: input.guest_last_name ?? null,
        thai_name: input.thai_name ?? null,
        car_plate: input.car_plate ?? null,
        is_open_ended: input.is_open_ended ?? false,
        checkin_time: input.checkin_time ?? null,
        checkout_time: input.checkout_time ?? null,
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
