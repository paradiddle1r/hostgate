import "server-only";

// Phase D — Monthly rentals data layer: rate config (rental_tenants), meter
// readings, per-month bills, and contracts. Layered on top of bookings (a
// "monthly tenant" is a booking that has a rental_tenants row). Numbering via
// next_rental_number(). All writes carry tenant_id+property_id (guarded);
// reads RLS-scoped.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";
import type { Booking } from "@/lib/db/bookings";

export interface RentalTenant {
  id: string;
  tenant_id: string;
  property_id: string;
  booking_id: string;
  monthly_rent: number;
  deposit: number;
  advance_rent: number;
  electric_rate: number;
  water_rate: number;
  other_fees: number;
  occupants: number;
  notes: string | null;
  created_at: string;
  // ── parity (migration 15) — full fee model ──────────────────────────────────
  water_minimum_charge: number; // NOT NULL default 0
  internet_fee: number; // NOT NULL default 0
  parking_fee: number; // NOT NULL default 0
  billing_day: number; // NOT NULL default 1
  start_meter_electric: number | null;
  start_meter_water: number | null;
  other_charges: Array<Record<string, unknown>>; // jsonb NOT NULL default '[]'
}

export interface MeterReading {
  id: string;
  tenant_id: string;
  property_id: string;
  booking_id: string;
  reading_date: string;
  electric: number | null;
  water: number | null;
  note: string | null;
  created_at: string;
}

export interface RentalBill {
  id: string;
  tenant_id: string;
  property_id: string;
  booking_id: string;
  number: string | null;
  period_month: string;
  rent: number;
  electric_units: number;
  electric_amount: number;
  water_units: number;
  water_amount: number;
  other: number;
  total: number;
  status: "draft" | "issued" | "paid";
  invoice_id: string | null;
  notes: string | null;
  created_at: string;
  // ── parity (migration 15) — period range + meter snapshots + structured ─────
  period_start: string | null;
  period_end: string | null;
  electric_prev: number | null;
  electric_curr: number | null;
  electric_rate: number; // NOT NULL default 0
  water_prev: number | null;
  water_curr: number | null;
  water_rate: number; // NOT NULL default 0
  internet_amount: number; // NOT NULL default 0
  parking_amount: number; // NOT NULL default 0
  other_charges: Array<Record<string, unknown>>; // jsonb NOT NULL default '[]'
  subtotal: number; // NOT NULL default 0
}

export interface RentalContract {
  id: string;
  tenant_id: string;
  property_id: string;
  booking_id: string;
  number: string | null;
  status: "draft" | "issued";
  start_date: string | null;
  end_date: string | null;
  monthly_rent: number;
  deposit: number;
  landlord_name: string | null;
  tenant_name: string | null;
  body_th: string | null;
  body_en: string | null;
  created_at: string;
  // ── parity (migration 15) — structured legal fields ─────────────────────────
  landlord_address: string | null;
  landlord_tax_id: string | null;
  tenant_address: string | null;
  tenant_citizen_id: string | null;
  furniture_rent: number; // NOT NULL default 0
  common_area_fee: number; // NOT NULL default 0
  internet_fee: number; // NOT NULL default 0
  parking_fee: number; // NOT NULL default 0
  payment_due_day: number; // NOT NULL default 1
  notice_period_days: number; // NOT NULL default 30
  language: string; // NOT NULL default 'th'
  witnesses: Array<Record<string, unknown>>; // jsonb NOT NULL default '[]'
  terminated_at: string | null;
  terminated_reason: string | null;
}

/**
 * Per-room-type monthly config + photos (migration 15 table
 * `monthly_room_types`). One row per room type; drives the monthly-rentals
 * setup page (which room types sell monthly, their default rates + photos).
 */
export interface MonthlyRoomType {
  id: string;
  tenant_id: string;
  property_id: string;
  room_type_id: string;
  display_name_th: string | null;
  display_name_en: string | null;
  monthly_rent: number; // NOT NULL default 0
  deposit: number; // NOT NULL default 0
  advance_rent: number; // NOT NULL default 0
  electric_rate: number; // NOT NULL default 0
  water_rate: number; // NOT NULL default 0
  internet_fee: number; // NOT NULL default 0
  parking_fee: number; // NOT NULL default 0
  photos: Array<Record<string, unknown>>; // jsonb NOT NULL default '[]'
  amenities: string[]; // NOT NULL default '{}'
  created_at: string;
}

export interface MonthlyTenantRow {
  tenant: RentalTenant;
  booking: Booking;
}

// ── reads ────────────────────────────────────────────────────────────────────
export async function listMonthlyTenants(propertyId: string): Promise<ActionResult<MonthlyTenantRow[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("rental_tenants")
      .select("*, booking:booking_id(*)")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? [])
      .map((r) => {
        const { booking, ...tenant } = r as RentalTenant & { booking: Booking | null };
        return booking ? { tenant: tenant as RentalTenant, booking } : null;
      })
      .filter(Boolean) as MonthlyTenantRow[];
    return ok(rows);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function getRentalDetail(bookingId: string): Promise<
  ActionResult<{
    booking: Booking;
    rentalTenant: RentalTenant | null;
    readings: MeterReading[];
    bills: RentalBill[];
    contracts: RentalContract[];
  }>
> {
  try {
    const supabase = createClient();
    const { data: booking, error: bErr } = await supabase
      .from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (bErr) throw bErr;
    if (!booking) return fail("HG-BOOK-404", "Booking not found.");
    const [rt, readings, bills, contracts] = await Promise.all([
      supabase.from("rental_tenants").select("*").eq("booking_id", bookingId).maybeSingle(),
      supabase.from("meter_readings").select("*").eq("booking_id", bookingId).order("reading_date", { ascending: false }),
      supabase.from("rental_bills").select("*").eq("booking_id", bookingId).order("period_month", { ascending: false }),
      supabase.from("rental_contracts").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }),
    ]);
    return ok({
      booking: booking as Booking,
      rentalTenant: (rt.data ?? null) as RentalTenant | null,
      readings: (readings.data ?? []) as MeterReading[],
      bills: (bills.data ?? []) as RentalBill[],
      contracts: (contracts.data ?? []) as RentalContract[],
    });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── rate config ──────────────────────────────────────────────────────────────
export interface RentalTenantInput {
  monthly_rent?: number;
  deposit?: number;
  advance_rent?: number;
  electric_rate?: number;
  water_rate?: number;
  other_fees?: number;
  occupants?: number;
  notes?: string | null;
  // ── parity (migration 15) ──────────────────────────────────────────────────
  water_minimum_charge?: number;
  internet_fee?: number;
  parking_fee?: number;
  billing_day?: number;
  start_meter_electric?: number | null;
  start_meter_water?: number | null;
  other_charges?: Array<Record<string, unknown>>;
}

/** Create or update the rate config for a booking (makes it a monthly tenant). */
export async function upsertRentalTenant(
  propertyId: string,
  tenantId: string,
  bookingId: string,
  input: RentalTenantInput
): Promise<ActionResult<RentalTenant>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("rental_tenants")
      .upsert(
        { tenant_id: tenantId, property_id: propertyId, booking_id: bookingId, ...input },
        { onConflict: "booking_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return ok(data as RentalTenant);
  } catch (e) {
    return mapPgError(e);
  }
}

// ── meters ───────────────────────────────────────────────────────────────────
export async function addMeterReading(
  propertyId: string,
  tenantId: string,
  bookingId: string,
  input: { reading_date: string; electric?: number | null; water?: number | null; note?: string | null }
): Promise<ActionResult<MeterReading>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("meter_readings")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        booking_id: bookingId,
        reading_date: input.reading_date,
        electric: input.electric ?? null,
        water: input.water ?? null,
        note: input.note ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as MeterReading);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function deleteMeterReading(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("meter_readings").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── bills ────────────────────────────────────────────────────────────────────
export interface BillInput {
  period_month: string;
  rent: number;
  electric_units: number;
  electric_amount: number;
  water_units: number;
  water_amount: number;
  other: number;
  total: number;
  notes?: string | null;
  // ── parity (migration 15) — period range + meter snapshots + structured ─────
  period_start?: string | null;
  period_end?: string | null;
  electric_prev?: number | null;
  electric_curr?: number | null;
  electric_rate?: number;
  water_prev?: number | null;
  water_curr?: number | null;
  water_rate?: number;
  internet_amount?: number;
  parking_amount?: number;
  other_charges?: Array<Record<string, unknown>>;
  subtotal?: number;
}

export async function createBill(
  propertyId: string,
  tenantId: string,
  bookingId: string,
  input: BillInput
): Promise<ActionResult<RentalBill>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("rental_bills")
      .upsert(
        { tenant_id: tenantId, property_id: propertyId, booking_id: bookingId, status: "draft", ...input },
        { onConflict: "booking_id,period_month" }
      )
      .select()
      .single();
    if (error) throw error;
    return ok(data as RentalBill);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function issueBill(id: string, propertyId: string): Promise<ActionResult<RentalBill>> {
  try {
    const supabase = createClient();
    const { data: cur } = await supabase.from("rental_bills").select("number").eq("id", id).single();
    if (cur?.number) {
      const { data } = await supabase.from("rental_bills").select("*").eq("id", id).single();
      return ok(data as RentalBill);
    }
    const { data: num, error: numErr } = await supabase.rpc("next_rental_number", { p_property: propertyId, p_kind: "bill" });
    if (numErr) throw numErr;
    const { data, error } = await supabase
      .from("rental_bills").update({ number: num as string, status: "issued" }).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as RentalBill);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function setBillStatus(id: string, status: RentalBill["status"]): Promise<ActionResult<RentalBill>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("rental_bills").update({ status }).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as RentalBill);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function deleteBill(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("rental_bills").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── contracts ────────────────────────────────────────────────────────────────
export interface ContractInput {
  start_date?: string | null;
  end_date?: string | null;
  monthly_rent?: number;
  deposit?: number;
  landlord_name?: string | null;
  tenant_name?: string | null;
  body_th?: string | null;
  body_en?: string | null;
  // ── parity (migration 15) — structured legal fields ─────────────────────────
  landlord_address?: string | null;
  landlord_tax_id?: string | null;
  tenant_address?: string | null;
  tenant_citizen_id?: string | null;
  furniture_rent?: number;
  common_area_fee?: number;
  internet_fee?: number;
  parking_fee?: number;
  payment_due_day?: number;
  notice_period_days?: number;
  language?: string;
  witnesses?: Array<Record<string, unknown>>;
  terminated_at?: string | null;
  terminated_reason?: string | null;
}

export async function createContract(
  propertyId: string,
  tenantId: string,
  bookingId: string,
  input: ContractInput
): Promise<ActionResult<RentalContract>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("rental_contracts")
      .insert({ tenant_id: tenantId, property_id: propertyId, booking_id: bookingId, status: "draft", ...input })
      .select()
      .single();
    if (error) throw error;
    return ok(data as RentalContract);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function issueContract(id: string, propertyId: string): Promise<ActionResult<RentalContract>> {
  try {
    const supabase = createClient();
    const { data: cur } = await supabase.from("rental_contracts").select("number").eq("id", id).single();
    if (cur?.number) {
      const { data } = await supabase.from("rental_contracts").select("*").eq("id", id).single();
      return ok(data as RentalContract);
    }
    const { data: num, error: numErr } = await supabase.rpc("next_rental_number", { p_property: propertyId, p_kind: "contract" });
    if (numErr) throw numErr;
    const { data, error } = await supabase
      .from("rental_contracts").update({ number: num as string, status: "issued" }).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as RentalContract);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function deleteContract(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("rental_contracts").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── monthly room types (per-type config + photos) ─────────────────────────────
export interface MonthlyRoomTypeInput {
  display_name_th?: string | null;
  display_name_en?: string | null;
  monthly_rent?: number;
  deposit?: number;
  advance_rent?: number;
  electric_rate?: number;
  water_rate?: number;
  internet_fee?: number;
  parking_fee?: number;
  photos?: Array<Record<string, unknown>>;
  amenities?: string[];
}

/** Every monthly-room-type config row for a property. */
export async function listMonthlyRoomTypes(
  propertyId: string
): Promise<ActionResult<MonthlyRoomType[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("monthly_room_types")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ok((data ?? []) as MonthlyRoomType[]);
  } catch (e) {
    return mapPgError(e);
  }
}

/**
 * Create or update the monthly config for a room type (one row per room type —
 * the table is unique on room_type_id, so this upserts on conflict).
 */
export async function upsertMonthlyRoomType(
  propertyId: string,
  tenantId: string,
  roomTypeId: string,
  input: MonthlyRoomTypeInput
): Promise<ActionResult<MonthlyRoomType>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("monthly_room_types")
      .upsert(
        { tenant_id: tenantId, property_id: propertyId, room_type_id: roomTypeId, ...input },
        { onConflict: "room_type_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return ok(data as MonthlyRoomType);
  } catch (e) {
    return mapPgError(e);
  }
}
