"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import {
  upsertRentalTenant,
  addMeterReading,
  deleteMeterReading,
  createBill,
  issueBill,
  setBillStatus,
  deleteBill,
  createContract,
  issueContract,
  deleteContract,
  upsertMonthlyRoomType,
  RentalTenant,
  RentalTenantInput,
  MeterReading,
  RentalBill,
  BillInput,
  RentalContract,
  ContractInput,
  MonthlyRoomType,
  MonthlyRoomTypeInput,
} from "@/lib/db/rentals";

function bust(bookingId: string) {
  revalidatePath("/app/rentals");
  revalidatePath(`/app/rentals/${bookingId}`);
}

export async function saveTenantConfig(
  bookingId: string,
  input: RentalTenantInput
): Promise<ActionResult<RentalTenant>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await upsertRentalTenant(active.data.property.id, active.data.property.tenant_id, bookingId, input);
  if (res.ok) bust(bookingId);
  return res;
}

export async function addReading(
  bookingId: string,
  input: { reading_date: string; electric?: number | null; water?: number | null; note?: string | null }
): Promise<ActionResult<MeterReading>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await addMeterReading(active.data.property.id, active.data.property.tenant_id, bookingId, input);
  if (res.ok) bust(bookingId);
  return res;
}

export async function removeReading(id: string, bookingId: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteMeterReading(id);
  if (res.ok) bust(bookingId);
  return res;
}

export async function generateBill(bookingId: string, input: BillInput): Promise<ActionResult<RentalBill>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createBill(active.data.property.id, active.data.property.tenant_id, bookingId, input);
  if (res.ok) bust(bookingId);
  return res;
}

export async function issueBillAction(id: string, bookingId: string): Promise<ActionResult<RentalBill>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await issueBill(id, active.data.property.id);
  if (res.ok) bust(bookingId);
  return res;
}

export async function setBillStatusAction(
  id: string,
  bookingId: string,
  status: RentalBill["status"]
): Promise<ActionResult<RentalBill>> {
  const res = await setBillStatus(id, status);
  if (res.ok) bust(bookingId);
  return res;
}

export async function removeBill(id: string, bookingId: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteBill(id);
  if (res.ok) bust(bookingId);
  return res;
}

export async function makeContract(bookingId: string, input: ContractInput): Promise<ActionResult<RentalContract>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createContract(active.data.property.id, active.data.property.tenant_id, bookingId, input);
  if (res.ok) bust(bookingId);
  return res;
}

export async function issueContractAction(id: string, bookingId: string): Promise<ActionResult<RentalContract>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await issueContract(id, active.data.property.id);
  if (res.ok) bust(bookingId);
  return res;
}

export async function removeContract(id: string, bookingId: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteContract(id);
  if (res.ok) bust(bookingId);
  return res;
}

// ── monthly room-type setup ──────────────────────────────────────────────────
export async function saveMonthlyRoomType(
  roomTypeId: string,
  input: MonthlyRoomTypeInput
): Promise<ActionResult<MonthlyRoomType>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await upsertMonthlyRoomType(
    active.data.property.id,
    active.data.property.tenant_id,
    roomTypeId,
    input
  );
  if (res.ok) revalidatePath("/app/rentals/setup");
  return res;
}

// ── co-tenants (sibling bookings sharing booking_group_id) ───────────────────
//
// A co-tenant is a second person on the same lease: a sibling `bookings` row
// (same room + dates, booking_type=monthly) tied to the primary by a shared
// booking_group_id, plus its own rental_tenants config. Meters + bills stay on
// the primary booking. We mint a group id on the primary if it doesn't have one
// yet, then reuse it. Both inserts carry tenant_id + property_id so the
// assert_property_in_tenant trigger is satisfied.
export async function addCoTenant(
  primaryBookingId: string,
  input: { guest_name: string; phone?: string | null; monthly_rent?: number }
): Promise<ActionResult<{ bookingId: string }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const propertyId = active.data.property.id;
  const tenantId = active.data.property.tenant_id;

  if (!input.guest_name?.trim()) return fail("HG-VALIDATION-422", "Guest name is required.");

  try {
    const supabase = createClient();

    const { data: primary, error: pErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", primaryBookingId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!primary) return fail("HG-BOOK-404", "Primary booking not found.");

    // Mint a group id on the primary if it has none, so siblings can share it.
    let groupId: string = primary.booking_group_id as string;
    if (!groupId) {
      groupId =
        (globalThis.crypto?.randomUUID?.() as string) ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { error: upErr } = await supabase
        .from("bookings")
        .update({ booking_group_id: groupId })
        .eq("id", primaryBookingId);
      if (upErr) throw upErr;
    }

    const { data: sibling, error: sErr } = await supabase
      .from("bookings")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        room_id: primary.room_id,
        room_type_id: primary.room_type_id,
        guest_name: input.guest_name.trim(),
        phone: input.phone?.trim() || null,
        check_in: primary.check_in,
        check_out: primary.check_out,
        status: primary.status,
        source: primary.source,
        booking_type: "monthly",
        booking_group_id: groupId,
      })
      .select("id")
      .single();
    if (sErr) throw sErr;

    const { error: rtErr } = await supabase.from("rental_tenants").insert({
      tenant_id: tenantId,
      property_id: propertyId,
      booking_id: sibling.id,
      monthly_rent: Number(input.monthly_rent) || 0,
    });
    if (rtErr) throw rtErr;

    bust(primaryBookingId);
    bust(sibling.id);
    return ok({ bookingId: sibling.id });
  } catch (e) {
    return mapPgError(e);
  }
}

export async function removeCoTenant(
  bookingId: string,
  primaryBookingId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    // rental_tenants cascades on booking delete (FK), but delete it explicitly
    // in case the FK isn't ON DELETE CASCADE in this environment.
    await supabase.from("rental_tenants").delete().eq("booking_id", bookingId);
    const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
    if (error) throw error;
    bust(primaryBookingId);
    return ok({ id: bookingId });
  } catch (e) {
    return mapPgError(e);
  }
}
