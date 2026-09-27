import "server-only";

// Resolves which property the signed-in user is currently managing.
//
// Multi-tenant: a user can belong to several tenants (via tenant_members),
// each owning several properties. The "active property" is the one the rest
// of the app reads/writes against. It's remembered in the `hg_active_property`
// cookie and validated against the user's tenants on every read (so a stale or
// forged cookie can never point at someone else's property — RLS would block
// the row anyway, but we fail fast with a clean HG-PROP-404).
//
// PERF: the layout AND every page resolve the active property each navigation.
// Without dedup that was ~13 DB round-trips per nav (auth.getUser ×4,
// tenant_members ×3, properties ×3 …). Every shared read is now wrapped in
// React cache() so it runs AT MOST ONCE per request — the layout + page + any
// server-action share the same in-flight promise.

import { cache } from "react";
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

/** The signed-in auth user — resolved once per request. */
export const getCurrentUser = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Shared membership read, memoized only for this server request. */
const readMemberships = cache(async (): Promise<ActionResult<(Membership & { tenants: Tenant })[]>> => {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("HG-AUTH-401", "You are not signed in.");
    const { data, error } = await createClient()
      .from("tenant_members")
      .select("tenant_id, role, tenants:tenant_id(id, name, slug, plan, created_by, created_at)")
      .eq("user_id", user.id);
    if (error) throw error;
    const rows = (data ?? []).map((m) => {
      const tenant = (Array.isArray(m.tenants) ? m.tenants[0] : m.tenants) as Tenant | undefined;
      if (!tenant || tenant.id !== m.tenant_id) throw new Error("Missing membership tenant");
      return { tenant_id: m.tenant_id as string, role: m.role as Membership["role"], plan: tenant.plan, tenants: tenant };
    });
    return ok(rows);
  } catch (e) {
    return mapPgError(e);
  }
});

export const getMemberships = cache(async (): Promise<ActionResult<Membership[]>> => readMemberships());

/**
 * Resolve the property the user should manage.
 * Order: explicit arg → `hg_active_property` cookie → first property of the
 * user's first tenant. Cached per request (layout + page share one resolution).
 */
export const getActiveProperty = cache(async function getActiveProperty(
  cookiePropId?: string
): Promise<ActionResult<{ property: Property; tenant: Tenant }>> {
  try {

    const memberships = await readMemberships();
    if (!memberships.ok) return memberships;
    const tenantIds = memberships.data.map((m) => m.tenant_id);
    if (tenantIds.length === 0) return fail("HG-PROP-404", "No property available for this account.");

    const supabase = createClient();
    const wanted = cookiePropId ?? cookies().get(ACTIVE_PROPERTY_COOKIE)?.value ?? null;

    if (wanted) {
      const { data: prop, error: pErr } = await supabase
        .from("properties")
        .select("*")
        .eq("id", wanted)
        .in("tenant_id", tenantIds)
        .maybeSingle();
      if (pErr) throw pErr;
      if (prop) return await withTenant(memberships.data, prop as Property);
    }

    const { data: fallback, error: fErr } = await supabase
      .from("properties")
      .select("*")
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!fallback) return fail("HG-PROP-404", "No property available for this account.");
    return await withTenant(memberships.data, fallback as Property);
  } catch (e) {
    return mapPgError(e);
  }
});

/** Attach the owning tenant row to a resolved property. */
function withTenant(
  memberships: (Membership & { tenants: Tenant })[],
  property: Property
): ActionResult<{ property: Property; tenant: Tenant }> {
  const tenant = memberships.find((m) => m.tenant_id === property.tenant_id)?.tenants;
  if (!tenant) return fail("HG-PROP-404", "No property available for this account.");
  return ok({ property, tenant });
}

/** Every property across all of the user's tenants (for the property switcher). */
export const listTenantProperties = cache(async (): Promise<ActionResult<Property[]>> => {
  try {
    const memberships = await readMemberships();
    if (!memberships.ok) return memberships;
    const tenantIds = memberships.data.map((m) => m.tenant_id);
    if (tenantIds.length === 0) return ok([]);
    const supabase = createClient();
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
});
