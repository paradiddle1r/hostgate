"use server";

// Server actions for the fixed-assets surface. Every write is gated to
// owner/admin via canApprove(getActiveRole()) — staff can view the register
// and schedules but may not create/edit/dispose assets or post depreciation.

import { revalidatePath } from "next/cache";
import { ActionResult, fail } from "@/lib/errors";
import { getActiveProperty, getCurrentUser } from "@/lib/active-property-server";
import { getActiveRole, canApprove } from "@/lib/active-role-server";
import {
  getAsset,
  nextAssetCode,
  createAsset,
  updateAsset,
  disposeAsset,
  runDepreciation,
  type CreateAssetInput,
  type UpdateAssetInput,
  type FixedAsset,
  type AssetDepreciationLine,
  type RunDepreciationResult,
} from "@/lib/db/assets";

async function ctx() {
  const active = await getActiveProperty();
  if (!active.ok) return { ok: false as const, res: active };
  const p = active.data.property;
  return { ok: true as const, propertyId: p.id, tenantId: p.tenant_id };
}

/** owner/admin only — everything on this surface that writes goes through this gate. */
async function requireApprover(): Promise<ReturnType<typeof fail> | null> {
  const role = await getActiveRole();
  if (!canApprove(role)) return fail("HG-AUTH-403", "Only owners and admins can manage fixed assets.");
  return null;
}

// ── read loaders (open to every role — staff can view the register/schedules) ──
export async function loadAssetDetail(
  id: string
): Promise<ActionResult<{ asset: FixedAsset; lines: AssetDepreciationLine[] }>> {
  return getAsset(id);
}

export async function nextAssetCodeAction(): Promise<ActionResult<string>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  return nextAssetCode(c.tenantId);
}

export async function createAssetAction(fields: CreateAssetInput): Promise<ActionResult<FixedAsset>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const gate = await requireApprover();
  if (gate) return gate;
  const user = await getCurrentUser();
  const res = await createAsset(c.propertyId, c.tenantId, fields, user?.id ?? null);
  if (res.ok) revalidatePath("/app/assets");
  return res;
}

export async function updateAssetAction(
  id: string,
  patch: UpdateAssetInput
): Promise<ActionResult<FixedAsset>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const gate = await requireApprover();
  if (gate) return gate;
  const res = await updateAsset(id, patch);
  if (res.ok) revalidatePath("/app/assets");
  return res;
}

export async function disposeAssetAction(
  id: string,
  disposedAt?: string
): Promise<ActionResult<FixedAsset>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const gate = await requireApprover();
  if (gate) return gate;
  const res = await disposeAsset(id, disposedAt);
  if (res.ok) revalidatePath("/app/assets");
  return res;
}

export async function runDepreciationAction(period: string): Promise<ActionResult<RunDepreciationResult>> {
  const c = await ctx();
  if (!c.ok) return c.res;
  const gate = await requireApprover();
  if (gate) return gate;
  const res = await runDepreciation(c.tenantId, c.propertyId, period);
  if (res.ok) revalidatePath("/app/assets");
  return res;
}
