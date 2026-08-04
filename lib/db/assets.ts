import "server-only";
import { todayISO } from "@/lib/date";

// Fixed assets register + straight-line depreciation (accounting Phase 6 port
// of hotel-pms schema_update_75 / AssetsClient.jsx). Tenant+property scoped,
// stamped on every insert. Money math for what actually gets POSTED lives in
// the DB (migration 23's run_depreciation() runner, called via RPC below);
// lib/accounting/depreciation.ts mirrors the same straight-line formula so the
// client can render a projected schedule preview without a round-trip.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";

export type AssetStatus = "active" | "disposed" | "fully-depreciated";

export interface FixedAsset {
  id: string;
  tenant_id: string;
  property_id: string;
  code: string;
  name: string;
  category: string | null;
  acquired_date: string;
  cost: number;
  salvage: number;
  useful_life_months: number;
  method: "straight-line";
  accum_depreciation: number;
  coa_asset_code: string;
  coa_accum_code: string;
  coa_expense_code: string;
  status: AssetStatus;
  disposed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetDepreciationLine {
  id: string;
  tenant_id: string;
  property_id: string;
  asset_id: string;
  period: string; // 'YYYY-MM'
  amount: number;
  journal_entry_id: string | null;
  created_at: string;
}

export interface ChartAccountOption {
  code: string;
  name_th: string;
  name_en: string | null;
  category: string;
  active: boolean;
}

export interface RunDepreciationResult {
  period: string;
  status: "ok" | "already-approved";
  assets_processed: number;
  lines_created: number;
  entry_id: string | null;
  total_amount: number;
}

export interface CreateAssetInput {
  name: string;
  category?: string | null;
  acquired_date: string;
  cost: number;
  salvage: number;
  useful_life_months: number;
  coa_asset_code: string;
  coa_accum_code: string;
  coa_expense_code: string;
  notes?: string | null;
  /** Optional explicit code; minted via nextAssetCode() when omitted. */
  code?: string;
}

export type UpdateAssetInput = Partial<
  Pick<
    FixedAsset,
    | "code"
    | "name"
    | "category"
    | "acquired_date"
    | "cost"
    | "salvage"
    | "useful_life_months"
    | "coa_asset_code"
    | "coa_accum_code"
    | "coa_expense_code"
    | "notes"
  >
>;

// ── reads ──────────────────────────────────────────────────────────────────

export async function listAssets(
  propertyId: string,
  opts?: { status?: AssetStatus }
): Promise<ActionResult<FixedAsset[]>> {
  try {
    const supabase = createClient();
    let query = supabase.from("fixed_assets").select("*").eq("property_id", propertyId);
    if (opts?.status) query = query.eq("status", opts.status);
    const { data, error } = await query.order("code");
    if (error) throw error;
    return ok((data ?? []) as FixedAsset[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function getAsset(
  id: string
): Promise<ActionResult<{ asset: FixedAsset; lines: AssetDepreciationLine[] }>> {
  try {
    const supabase = createClient();
    const { data: asset, error } = await supabase.from("fixed_assets").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!asset) return fail("HG-BOOK-404", "Asset not found.");
    const { data: lines, error: lErr } = await supabase
      .from("asset_depreciation_lines")
      .select("*")
      .eq("asset_id", id)
      .order("period");
    if (lErr) throw lErr;
    return ok({ asset: asset as FixedAsset, lines: (lines ?? []) as AssetDepreciationLine[] });
  } catch (e) {
    return mapPgError(e);
  }
}

/**
 * Chart-of-accounts rows for the asset/accum/expense pickers — category
 * 'asset' (client narrows to code-prefix '12' and splits accum-contra vs
 * plain asset accounts by name) + category 'expense'. Grouping is left to
 * the client (mirrors hotel-pms AssetsClient, which does the same split).
 */
export async function listAssetCoa(propertyId: string): Promise<ActionResult<ChartAccountOption[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("code, name_th, name_en, category, active")
      .eq("property_id", propertyId)
      .eq("active", true)
      .in("category", ["asset", "expense"])
      .order("code");
    if (error) throw error;
    return ok((data ?? []) as ChartAccountOption[]);
  } catch (e) {
    return mapPgError(e);
  }
}

// ── code minting ─────────────────────────────────────────────────────────

/** Next sequential 'FA-####' code for the tenant (max existing suffix + 1). */
export async function nextAssetCode(tenantId: string): Promise<ActionResult<string>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("fixed_assets").select("code").eq("tenant_id", tenantId);
    if (error) throw error;
    let max = 0;
    for (const row of data ?? []) {
      const m = /^FA-(\d+)$/.exec(row.code || "");
      if (m) max = Math.max(max, Number(m[1]));
    }
    return ok(`FA-${String(max + 1).padStart(4, "0")}`);
  } catch (e) {
    return mapPgError(e);
  }
}

// ── create / update / dispose ───────────────────────────────────────────────

export async function createAsset(
  propertyId: string,
  tenantId: string,
  fields: CreateAssetInput,
  createdBy?: string | null
): Promise<ActionResult<FixedAsset>> {
  try {
    if (!fields.name?.trim()) return fail("HG-VALIDATION-422", "Name is required.");
    if (!(Number(fields.cost) > 0)) return fail("HG-VALIDATION-422", "Cost must be greater than zero.");
    if (!(Number(fields.useful_life_months) > 0)) {
      return fail("HG-VALIDATION-422", "Useful life must be greater than zero.");
    }
    if (Number(fields.salvage) >= Number(fields.cost)) {
      return fail("HG-VALIDATION-422", "Salvage value must be less than cost.");
    }
    if (!fields.coa_asset_code || !fields.coa_accum_code || !fields.coa_expense_code) {
      return fail(
        "HG-VALIDATION-422",
        "Asset, accumulated-depreciation, and expense accounts are all required."
      );
    }

    let code = fields.code?.trim();
    if (!code) {
      const nc = await nextAssetCode(tenantId);
      if (!nc.ok) return nc;
      code = nc.data;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("fixed_assets")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        code,
        name: fields.name.trim(),
        category: fields.category?.trim() || null,
        acquired_date: fields.acquired_date,
        cost: fields.cost,
        salvage: fields.salvage ?? 1,
        useful_life_months: fields.useful_life_months,
        coa_asset_code: fields.coa_asset_code,
        coa_accum_code: fields.coa_accum_code,
        coa_expense_code: fields.coa_expense_code,
        notes: fields.notes?.trim() || null,
        created_by: createdBy ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data as FixedAsset);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function updateAsset(id: string, patch: UpdateAssetInput): Promise<ActionResult<FixedAsset>> {
  try {
    if (patch.cost !== undefined && !(Number(patch.cost) > 0)) {
      return fail("HG-VALIDATION-422", "Cost must be greater than zero.");
    }
    if (patch.useful_life_months !== undefined && !(Number(patch.useful_life_months) > 0)) {
      return fail("HG-VALIDATION-422", "Useful life must be greater than zero.");
    }

    const update: Record<string, unknown> = { ...patch };
    if (typeof update.name === "string") update.name = (update.name as string).trim();
    if (typeof update.category === "string") update.category = (update.category as string).trim() || null;
    if (typeof update.notes === "string") update.notes = (update.notes as string).trim() || null;
    if (typeof update.code === "string") update.code = (update.code as string).trim();

    const supabase = createClient();
    const { data, error } = await supabase.from("fixed_assets").update(update).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as FixedAsset);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Mark an asset disposed. Gain/loss on disposal stays a manual journal entry (parity with hotel-pms). */
export async function disposeAsset(id: string, disposedAt?: string): Promise<ActionResult<FixedAsset>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fixed_assets")
      .update({ status: "disposed", disposed_at: disposedAt ?? todayISO() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data as FixedAsset);
  } catch (e) {
    return mapPgError(e);
  }
}

// ── depreciation runner ─────────────────────────────────────────────────────

/**
 * Thin wrapper over the run_depreciation() RPC (migration 23) — posts ONE
 * combined DRAFT general-journal entry for the period across all due assets.
 * Idempotent: rebuilds the draft on re-run; returns 'already-approved' once
 * an accountant has approved that period's entry.
 */
export async function runDepreciation(
  tenantId: string,
  propertyId: string,
  period: string
): Promise<ActionResult<RunDepreciationResult>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("run_depreciation", {
      p_tenant: tenantId,
      p_property: propertyId,
      p_period: period,
    });
    if (error) throw error;
    return ok(data as RunDepreciationResult);
  } catch (e) {
    return mapPgError(e);
  }
}
