import "server-only";

// Resolves which property the signed-in user is currently managing.
//
// Multi-tenant: a user can belong to several tenants (via tenant_members),
// each owning several properties. The "active property" is the one the rest
// of the app reads/writes against. It's remembered in the `hg_active_property`
// cookie and validated against the user's tenants on every read (so a stale or
// forged cookie can never point at someone else's property — RLS would block
// the row anyway, but we fail fast with a clean HG-PROP-404).

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";
import type { Plan } from "@/lib/plan";
import type { Property } from "@/lib/db/properties";

const ACTIVE_PROPERTY_COOKIE = "hg_active_property";

export interface TenantBrief {
  name: string;
  slug: string;
  plan: Plan;
}

export interface Membership {
  tenant_id: string;
  role: "owner" | "admin" | "staff";
  plan: Plan;
  tenants: TenantBrief;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  created_by: string | null;
  created_at: string;
}

/** All tenant memberships for the current user (joined to their tenant row). */
export async function getMemberships(): Promise<ActionResult<Membership[]>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("HG-AUTH-401", "You are not signed in.");

    const { data, error } = await supabase
      .from("tenant_members")
      .select("tenant_id, role, tenants:tenant_id(name, slug, plan)")
      .eq("user_id", user.id);
    if (error) throw error;

    const rows = (data ?? []).map((m) => {
      // PostgREST types an embedded to-one as an array; normalize to one object.
      const tenant = (Array.isArray(m.tenants) ? m.tenants[0] : m.tenants) as TenantBrief;
      return {
        tenant_id: m.tenant_id as string,
        role: m.role as Membership["role"],
        plan: tenant?.plan,
        tenants: tenant,
      };
    });
    return ok(rows);
  } catch (e) {
    return mapPgError(e);
  }
}

/**
 * Resolve the property the user should manage.
 * Order: explicit arg → `hg_active_property` cookie → first property of the
 * user's first tenant. Verifies the chosen property belongs to one of the
 * user's tenants. HG-PROP-404 if the user has no property at all.
 */
export async function getActiveProperty(
  cookiePropId?: string
): Promise<ActionResult<{ property: Property; tenant: Tenant }>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("HG-AUTH-401", "You are not signed in.");

    // Tenants the user belongs to (RLS already scopes these, but be explicit).
    const { data: members, error: mErr } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id);
    if (mErr) throw mErr;

    const tenantIds = (members ?? []).map((m) => m.tenant_id as string);
    if (tenantIds.length === 0) {
      return fail("HG-PROP-404", "No property available for this account.");
    }

    const wanted = cookiePropId ?? cookies().get(ACTIVE_PROPERTY_COOKIE)?.value ?? null;

    // Try the requested property first, but only if it sits inside the user's tenants.
    if (wanted) {
      const { data: prop, error: pErr } = await supabase
        .from("properties")
        .select("*")
        .eq("id", wanted)
        .in("tenant_id", tenantIds)
        .maybeSingle();
      if (pErr) throw pErr;
      if (prop) return await withTenant(supabase, prop as Property);
    }

    // Fallback: first property of the user's first tenant (deterministic order).
    const { data: fallback, error: fErr } = await supabase
      .from("properties")
      .select("*")
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!fallback) {
      return fail("HG-PROP-404", "No property available for this account.");
    }
    return await withTenant(supabase, fallback as Property);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Attach the owning tenant row to a resolved property. */
async function withTenant(
  supabase: ReturnType<typeof createClient>,
  property: Property
): Promise<ActionResult<{ property: Property; tenant: Tenant }>> {
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", property.tenant_id)
    .single();
  if (error) throw error;
  return ok({ property, tenant: tenant as Tenant });
}

/** Every property across all of the user's tenants (for the property switcher). */
export async function listTenantProperties(): Promise<ActionResult<Property[]>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("HG-AUTH-401", "You are not signed in.");

    const { data: members, error: mErr } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id);
    if (mErr) throw mErr;

    const tenantIds = (members ?? []).map((m) => m.tenant_id as string);
    if (tenantIds.length === 0) return ok([]);

    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ok((data ?? []) as Property[]);
  } catch (e) {
    return mapPgError(e);
  }
}
