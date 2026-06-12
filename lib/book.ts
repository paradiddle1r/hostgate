import "server-only";

// Public booking-engine data layer. Guests are anonymous, so every call goes
// through the anon-granted SECURITY DEFINER RPCs (migration 14) — anon has no
// table RLS access. Uses the standard server client; with no auth cookie it
// acts as the `anon` role.

import { createClient } from "@/lib/supabase/server";

export interface PublicProperty {
  id: string;
  name: string;
  currency: string;
  city: string | null;
  country: string | null;
}

export interface AvailabilityRow {
  room_type_id: string;
  name: string;
  daily_rate: number | null;
  quantity: number;
  available: number;
}

export async function getPublicProperty(code: string): Promise<PublicProperty | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("public_property_by_code", { p_code: code });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as PublicProperty | null;
}

export async function getAvailability(
  propertyId: string,
  checkIn: string,
  checkOut: string
): Promise<AvailabilityRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("public_availability", {
    p_property: propertyId,
    p_check_in: checkIn,
    p_check_out: checkOut,
  });
  if (error) return [];
  return (data ?? []) as AvailabilityRow[];
}

export async function getQuote(
  propertyId: string,
  roomTypeId: string,
  checkIn: string,
  checkOut: string
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("public_quote", {
    p_property: propertyId,
    p_room_type: roomTypeId,
    p_check_in: checkIn,
    p_check_out: checkOut,
  });
  if (error) return 0;
  return Number(data) || 0;
}

export interface CreateBookingInput {
  propertyId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  phone?: string;
  email?: string;
  adults?: number;
  children?: number;
}

export async function createPublicBooking(
  input: CreateBookingInput
): Promise<{ ok: true; id: string; code: string; total: number } | { ok: false; message: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("public_create_booking", {
    p_property: input.propertyId,
    p_room_type: input.roomTypeId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_guest_name: input.guestName,
    p_phone: input.phone ?? null,
    p_email: input.email ?? null,
    p_adults: input.adults ?? 1,
    p_children: input.children ?? 0,
  });
  if (error) {
    const m = error.message || "Booking failed";
    const clean = m.replace(/^.*?(HG-[A-Z]+-\d{3}:\s*)/, "$1");
    return { ok: false, message: clean };
  }
  const r = data as { id: string; code: string; total: number };
  return { ok: true, id: r.id, code: r.code, total: Number(r.total) || 0 };
}
