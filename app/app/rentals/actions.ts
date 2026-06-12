"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
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
  RentalTenant,
  RentalTenantInput,
  MeterReading,
  RentalBill,
  BillInput,
  RentalContract,
  ContractInput,
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
