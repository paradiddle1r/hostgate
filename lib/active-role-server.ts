import "server-only";

// Resolves the signed-in user's role (owner | admin | staff) for the tenant that
// owns the ACTIVE property. RLS already stops a user from touching another
// tenant's rows; roles are a finer, app-layer gate on top of that — used by the
// accounting surfaces so only owner/admin can approve documents/journals, close
// periods, run depreciation, or void posted entries, while staff can still view
// everything and draft/submit.
//
// Cached per request (shares the memberships + active-property resolution the
// layout already ran), so this adds no extra round-trips.

import { cache } from "react";
import { getActiveProperty, getMemberships } from "@/lib/active-property-server";

export type TenantRole = "owner" | "admin" | "staff";

/** The current user's role for the active property's tenant, or null if none. */
export const getActiveRole = cache(async function getActiveRole(): Promise<TenantRole | null> {
  const [active, memberships] = await Promise.all([getActiveProperty(), getMemberships()]);
  if (!active.ok || !memberships.ok) return null;
  const tenantId = active.data.property.tenant_id;
  const m = memberships.data.find((x) => x.tenant_id === tenantId);
  return (m?.role as TenantRole | undefined) ?? null;
});

/** owner/admin may approve, close periods, void, and run depreciation. */
export function canApprove(role: TenantRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
