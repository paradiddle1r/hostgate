"use server";

// Server actions for the PMS shell + settings. All return ActionResult<T>.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";
import { isThemeAllowed, ThemeName } from "@/lib/plan";
import { updateProperty, createProperty, Property } from "@/lib/db/properties";
import { getActiveProperty } from "@/lib/active-property-server";

/** Persist the signed-in user's theme. Glass variants require the pro plan. */
export async function updateTheme(theme: string): Promise<ActionResult<ThemeName>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("HG-AUTH-401", "You are not signed in.");

    // What plan is this user on? (max across their tenants — pro wins.)
    const { data: members, error: mErr } = await supabase
      .from("tenant_members")
      .select("tenants:tenant_id(plan)")
      .eq("user_id", user.id);
    if (mErr) throw mErr;
    const plans = (members ?? []).map((m) => {
      const t = Array.isArray(m.tenants) ? m.tenants[0] : m.tenants;
      return (t as { plan?: string } | null)?.plan ?? "trial";
    });
    const plan = plans.includes("pro") ? "pro" : plans[0] ?? "trial";

    if (!isThemeAllowed(plan, theme)) {
      return fail("HG-PLAN-403", "That theme requires the Pro plan.");
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ theme })
      .eq("id", user.id);
    if (error) throw error;

    revalidatePath("/app");
    return ok(theme as ThemeName);
  } catch (e) {
    return mapPgError(e);
  }
}

/** Save editable details of the active property. */
export async function savePropertyDetails(
  id: string,
  patch: { name?: string; address?: string; city?: string; currency?: string; timezone?: string }
): Promise<ActionResult<Property>> {
  const res = await updateProperty(id, patch);
  if (res.ok) revalidatePath("/app");
  return res;
}

/**
 * Save the active property's billing / tax-invoice settings. Resolves the
 * active property internally (mirrors addProperty) so the client only sends a
 * patch. Revalidates /app and /app/invoices since the invoice module reads
 * these defaults (vat rate, prefix, footer, bank block).
 */
export async function saveBilling(patch: {
  legal_name?: string | null;
  tax_id?: string | null;
  billing_address?: string | null;
  vat_rate?: number;
  vat_inclusive?: boolean;
  bank_name?: string | null;
  bank_account?: string | null;
  invoice_prefix?: string;
  invoice_footer?: string | null;
}): Promise<ActionResult<Property>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await updateProperty(active.data.property.id, patch);
  if (res.ok) {
    revalidatePath("/app");
    revalidatePath("/app/invoices");
  }
  return res;
}

/**
 * Save the active property's full company profile — the migration-15 parity
 * block: logo, Thai company mirror, structured address, identity/contact,
 * bank branch/account name, print defaults, and the 8-field landlord block.
 * Every column is already on the `Property` interface so the patch flows
 * straight through updateProperty with no lib/db change. Revalidates /app and
 * the docs that render these (invoices, contracts).
 */
export async function savePropertyProfile(
  patch: Partial<Omit<Property, "id" | "tenant_id" | "code" | "created_at">>
): Promise<ActionResult<Property>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await updateProperty(active.data.property.id, patch);
  if (res.ok) {
    revalidatePath("/app");
    revalidatePath("/app/settings");
    revalidatePath("/app/invoices");
  }
  return res;
}

/**
 * Persist the signed-in user's appearance prefs (font size + time format) to
 * user_profiles. Free prefs — no plan gate (unlike updateTheme). Saving is the
 * parity requirement; the shell reads these on next load.
 */
export async function saveAppearancePrefs(prefs: {
  font_size?: string;
  time_format?: string;
}): Promise<ActionResult<{ font_size: string; time_format: string }>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("HG-AUTH-401", "You are not signed in.");

    const patch: Record<string, string> = {};
    if (prefs.font_size && ["sm", "normal", "lg"].includes(prefs.font_size)) {
      patch.font_size = prefs.font_size;
    }
    if (prefs.time_format && ["12h", "24h"].includes(prefs.time_format)) {
      patch.time_format = prefs.time_format;
    }
    if (Object.keys(patch).length === 0) return fail("HG-VALIDATION-422", "Nothing to save.");

    const { error } = await supabase.from("user_profiles").update(patch).eq("id", user.id);
    if (error) throw error;

    revalidatePath("/app");
    return ok({
      font_size: patch.font_size ?? "normal",
      time_format: patch.time_format ?? "24h",
    });
  } catch (e) {
    return mapPgError(e);
  }
}

/**
 * Add a new property to the active tenant. The DB plan-limit trigger rejects
 * a 2nd property for non-pro tenants with HG-PROP-403.
 */
export async function addProperty(input: {
  name: string;
  property_type: "daily" | "monthly" | "both";
  city?: string;
  currency?: string;
}): Promise<ActionResult<Property>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createProperty({
    tenant_id: active.data.property.tenant_id,
    name: input.name,
    property_type: input.property_type,
    city: input.city,
    currency: input.currency,
  });
  if (res.ok) revalidatePath("/app");
  return res;
}
