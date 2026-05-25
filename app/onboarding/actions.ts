"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PropertyType = "daily" | "monthly" | "both";
export type StayKind = "daily" | "monthly";

export interface RoomTypeInput {
  name: string;
  quantity: number;
  stay_kind: StayKind;
}

export interface ProvisionInput {
  property_name: string;
  property_type: PropertyType;
  address?: string;
  city?: string;
  country?: string;
  currency?: string;
  room_types: RoomTypeInput[];
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

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
    return { ok: false, error: tenantErr?.message ?? "tenant_insert_failed" };
  }

  // ----- 3. Owner membership -----
  const { error: memberErr } = await supabase.from("tenant_members").insert({
    tenant_id: tenant.id,
    user_id: user.id,
    role: "owner",
  });
  if (memberErr) {
    // rollback the tenant (no real transactions over PostgREST, so cleanup manually)
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return { ok: false, error: memberErr.message };
  }

  // ----- 4. The property itself -----
  const { data: property, error: propertyErr } = await supabase
    .from("properties")
    .insert({
      tenant_id: tenant.id,
      name: input.property_name,
      property_type: input.property_type,
      address: input.address ?? null,
      city: input.city ?? null,
      country: input.country ?? "TH",
      currency: input.currency ?? "THB",
    })
    .select("id")
    .single();
  if (propertyErr || !property) {
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return { ok: false, error: propertyErr?.message ?? "property_insert_failed" };
  }

  // ----- 5. Room types -----
  const cleanedRooms = input.room_types
    .filter((r) => r.name.trim().length > 0 && r.quantity > 0)
    .map((r, i) => ({
      property_id: property.id,
      name: r.name.trim(),
      quantity: r.quantity,
      stay_kind: r.stay_kind,
      sort_order: i,
    }));
  if (cleanedRooms.length > 0) {
    const { error: roomsErr } = await supabase.from("room_types").insert(cleanedRooms);
    if (roomsErr) {
      // tenant/property remain — user can add rooms later. Don't roll back.
      return {
        ok: false,
        error: `partial:${roomsErr.message}`,
      };
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
