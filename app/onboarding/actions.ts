"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PropertyType = "daily" | "monthly" | "both";
export type StayKind = "daily" | "monthly";

export interface RoomTypeInput {
  name: string;
  rate: number; // nightly (daily) or monthly rate, depending on property_type
}

export interface RoomRowInput {
  number: string;
  floor: number;
  type_index: number | null; // index into room_types[], or null = unassigned
  sort_order: number;
}

export interface ProvisionInput {
  property_name: string;
  property_type: PropertyType;
  city?: string;
  currency?: string;
  room_types: RoomTypeInput[];
  rooms: RoomRowInput[];
}

export type ProvisionResult =
  | { ok: true; tenant_id: string; property_id: string }
  | { ok: false; error: string };

/**
 * Provision the user's first tenant, property, and room types.
 * Called from the onboarding wizard's final submit.
 *
 * All inserts go through RLS — the user is implicitly the owner of the
 * tenant they're creating because `tenant_members.user_id = auth.uid()`
 * is enforced by the policy.
 */
export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
  const supabase = createClient();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    console.error("[provisionTenant] getUser failed:", userErr);
    return { ok: false, error: `auth: ${userErr.message}` };
  }
  if (!user) {
    console.error("[provisionTenant] no user in session");
    return { ok: false, error: "not_authenticated" };
  }

  // ----- 1. Generate a slug from the property name -----
  const baseSlug = slugify(input.property_name) || `prop-${Date.now().toString(36)}`;
  const slug = await uniqueSlug(supabase, baseSlug);

  // ----- 2. Insert the tenant (uses created_by = auth.uid()) -----
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert({
      name: input.property_name,
      slug,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (tenantErr || !tenant) {
    console.error("[provisionTenant] tenant insert failed:", tenantErr);
    return { ok: false, error: `tenant: ${tenantErr?.message ?? "insert_failed"}` };
  }

  // ----- 3. Owner membership -----
  const { error: memberErr } = await supabase.from("tenant_members").insert({
    tenant_id: tenant.id,
    user_id: user.id,
    role: "owner",
  });
  if (memberErr) {
    console.error("[provisionTenant] tenant_members insert failed:", memberErr);
    // rollback the tenant (no real transactions over PostgREST, so cleanup manually)
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return { ok: false, error: `member: ${memberErr.message}` };
  }

  // ----- 4. The property itself -----
  const { data: property, error: propertyErr } = await supabase
    .from("properties")
    .insert({
      tenant_id: tenant.id,
      name: input.property_name,
      property_type: input.property_type,
      address: null,
      city: input.city ?? null,
      country: "TH",
      currency: input.currency ?? "THB",
    })
    .select("id")
    .single();
  if (propertyErr || !property) {
    console.error("[provisionTenant] property insert failed:", propertyErr);
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return { ok: false, error: `property: ${propertyErr?.message ?? "insert_failed"}` };
  }

  // ----- 5. Room types — insert, then map each back to its id by sort_order
  //         (= its original index) so step 6 can attach rooms to the right one.
  const stayKind: StayKind = input.property_type === "monthly" ? "monthly" : "daily";
  const typeCount = input.room_types.length;
  const perType = new Array<number>(typeCount).fill(0);
  for (const r of input.rooms) {
    if (r.type_index != null && r.type_index >= 0 && r.type_index < typeCount) perType[r.type_index]++;
  }
  const typeRows = input.room_types.map((r, i) => ({
    property_id: property.id,
    name: r.name.trim() || `Type ${i + 1}`,
    quantity: perType[i],
    stay_kind: stayKind,
    daily_rate: stayKind === "daily" ? r.rate || null : null,
    monthly_rate: stayKind === "monthly" ? r.rate || null : null,
    sort_order: i,
  }));

  const typeIdByIndex = new Array<string | null>(typeCount).fill(null);
  if (typeRows.length > 0) {
    const { data: insertedTypes, error: typesErr } = await supabase
      .from("room_types")
      .insert(typeRows)
      .select("id, sort_order");
    if (typesErr) {
      console.error("[provisionTenant] room_types insert failed:", typesErr);
      return { ok: false, error: `room_types: ${typesErr.message}` };
    }
    for (const row of insertedTypes ?? []) {
      typeIdByIndex[row.sort_order as number] = row.id as string;
    }
  }

  // ----- 6. Individual rooms — so the calendar is ready immediately -----
  const roomRows = input.rooms
    .filter((r) => r.number && r.number.trim().length > 0)
    .map((r) => ({
      tenant_id: tenant.id,
      property_id: property.id,
      room_type_id: r.type_index != null ? typeIdByIndex[r.type_index] ?? null : null,
      number: r.number.trim(),
      floor: r.floor,
      sort_order: r.sort_order,
    }));
  if (roomRows.length > 0) {
    const { error: roomsErr } = await supabase.from("rooms").insert(roomRows);
    if (roomsErr) {
      console.error("[provisionTenant] rooms insert failed:", roomsErr);
      return { ok: false, error: `rooms: ${roomsErr.message}` };
    }
  }

  revalidatePath("/");
  return { ok: true, tenant_id: tenant.id, property_id: property.id };
}

/* ----------------------------------------------------------------- */

function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

async function uniqueSlug(
  supabase: ReturnType<typeof createClient>,
  base: string
): Promise<string> {
  // Probe up to 5 variants to avoid an infinite loop on a contested slug.
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const safe = candidate.padStart(3, "x").slice(0, 40);
    const { data, error } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", safe)
      .maybeSingle();
    if (error) break;
    if (!data) return safe;
  }
  // Last-resort fallback — virtually guaranteed to be unique.
  return `t-${Date.now().toString(36)}`;
}
