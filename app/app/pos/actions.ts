"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import { createClient } from "@/lib/supabase/server";
import {
  createCategory, updateCategory, deleteCategory,
  createProduct, updateProduct, deleteProduct,
  createSale, getSaleItems, adjustStock,
  PosCategory, PosProduct, PosSale, PosSaleItem, StockMovement,
  ProductInput, SaleItemInput,
} from "@/lib/db/pos";

// ── categories ──
export async function addCategory(name: string): Promise<ActionResult<PosCategory>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createCategory(active.data.property.id, active.data.property.tenant_id, name);
  if (res.ok) revalidatePath("/app/pos/products");
  return res;
}
export async function editCategory(id: string, name: string): Promise<ActionResult<PosCategory>> {
  const res = await updateCategory(id, name);
  if (res.ok) revalidatePath("/app/pos/products");
  return res;
}
export async function removeCategory(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteCategory(id);
  if (res.ok) revalidatePath("/app/pos/products");
  return res;
}

// ── products ──
export async function addProduct(input: ProductInput): Promise<ActionResult<PosProduct>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createProduct(active.data.property.id, active.data.property.tenant_id, input);
  if (res.ok) {
    revalidatePath("/app/pos/products");
    revalidatePath("/app/pos");
  }
  return res;
}
export async function editProduct(id: string, patch: Partial<ProductInput>): Promise<ActionResult<PosProduct>> {
  const res = await updateProduct(id, patch);
  if (res.ok) {
    revalidatePath("/app/pos/products");
    revalidatePath("/app/pos");
  }
  return res;
}
export async function removeProduct(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await deleteProduct(id);
  if (res.ok) {
    revalidatePath("/app/pos/products");
    revalidatePath("/app/pos");
  }
  return res;
}

/**
 * Bulk-create products in one round trip. Each row is created against the
 * active property/tenant. Returns the count inserted. Blank-name rows are
 * skipped by the caller before this runs.
 */
export async function bulkAddProducts(rows: ProductInput[]): Promise<ActionResult<{ count: number }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const clean = rows.filter((r) => r.name.trim() !== "");
  if (clean.length === 0) return fail("HG-VALIDATION-422", "Add at least one product row.");
  for (const r of clean) {
    const res = await createProduct(active.data.property.id, active.data.property.tenant_id, r);
    if (!res.ok) return res;
  }
  revalidatePath("/app/pos/products");
  revalidatePath("/app/pos");
  return ok({ count: clean.length });
}

// ── sales ──
export async function completeSale(
  payment: PosSale["payment_method"],
  bookingId: string | null,
  items: SaleItemInput[],
  note?: string | null
): Promise<ActionResult<{ id: string; code: string; total: number }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const res = await createSale(active.data.property.id, payment, bookingId, items, note);
  if (res.ok) {
    revalidatePath("/app/pos");
    revalidatePath("/app/pos/sales");
    revalidatePath("/app/pos/products");
  }
  return res;
}

export async function fetchSaleItems(saleId: string): Promise<ActionResult<PosSaleItem[]>> {
  return getSaleItems(saleId);
}

/**
 * Void a sale (admin/owner only). Marks the row voided + stores the reason,
 * and — for each line item — writes a `void` stock movement restoring the
 * sold quantity and bumps the product's stock back up. Mirrors hotel-pms's
 * void-with-reason + 'void' movement behaviour.
 */
export async function voidSale(saleId: string, reason: string): Promise<ActionResult<{ id: string }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const { property, tenant } = active.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("HG-AUTH-401", "You are not signed in.");

  // Admin/owner gate — same pattern as shifts/actions.ts.
  const { data: me, error: meErr } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (meErr) return mapPgError(meErr);
  const role = (me?.role as string | undefined) ?? "staff";
  if (role !== "owner" && role !== "admin") {
    return fail("HG-AUTH-403", "Only an admin can void a sale.");
  }

  const clean = reason.trim();
  if (!clean) return fail("HG-VALIDATION-422", "A void reason is required.");

  try {
    // Guard: don't double-void.
    const { data: sale, error: sErr } = await supabase
      .from("pos_sales")
      .select("id, voided")
      .eq("id", saleId)
      .eq("property_id", property.id)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!sale) return fail("HG-VALIDATION-422", "Sale not found.");
    if (sale.voided) return fail("HG-VALIDATION-422", "This sale is already voided.");

    // Restore stock for each line item via a 'void' movement.
    const { data: items, error: iErr } = await supabase
      .from("pos_sale_items")
      .select("product_id, qty")
      .eq("sale_id", saleId);
    if (iErr) throw iErr;

    for (const it of items ?? []) {
      if (!it.product_id) continue;
      await adjustStock(property.id, tenant.id, it.product_id as string, Number(it.qty) || 0, {
        type: "void",
        reason: `Void sale · ${clean}`,
      });
    }

    const { error: uErr } = await supabase
      .from("pos_sales")
      .update({ voided: true, void_reason: clean })
      .eq("id", saleId)
      .eq("property_id", property.id);
    if (uErr) throw uErr;

    revalidatePath("/app/pos/sales");
    revalidatePath("/app/pos/products");
    revalidatePath("/app/pos/inventory");
    revalidatePath("/app/pos/dashboard");
    return ok({ id: saleId });
  } catch (e) {
    return mapPgError(e);
  }
}

/**
 * Record a manual stock adjustment from the Inventory page. `type` is 'in'
 * (restock) or 'adjustment' (manual +/-). Writes the audit movement and bumps
 * the product stock via lib/db's adjustStock().
 */
export async function adjustProductStock(
  productId: string,
  type: "in" | "adjustment",
  qty: number,
  reason: string | null
): Promise<ActionResult<{ stock: number }>> {
  const active = await getActiveProperty();
  if (!active.ok) return active;
  const { property, tenant } = active.data;
  if (!qty || Number.isNaN(qty)) return fail("HG-VALIDATION-422", "Quantity must be a non-zero number.");
  const res = await adjustStock(property.id, tenant.id, productId, Math.trunc(qty), {
    type,
    reason: reason?.trim() || null,
  });
  if (!res.ok) return res;
  revalidatePath("/app/pos/inventory");
  revalidatePath("/app/pos/products");
  revalidatePath("/app/pos");
  return ok({ stock: res.data.stock });
}

export type { StockMovement };
