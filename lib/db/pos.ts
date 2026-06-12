import "server-only";

// Phase F — Mini-bar POS data layer: categories, products (with stock), and
// sales. Sales go through the pos_create_sale() RPC (atomic: snapshot + stock
// decrement + code). Everything else is tenant-scoped CRUD under RLS.

import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, mapPgError } from "@/lib/errors";

export interface PosCategory {
  id: string;
  tenant_id: string;
  property_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface PosProduct {
  id: string;
  tenant_id: string;
  property_id: string;
  category_id: string | null;
  name: string;
  price: number;
  cost: number;
  sku: string | null;
  stock: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface PosSale {
  id: string;
  tenant_id: string;
  property_id: string;
  code: string | null;
  total: number;
  payment_method: "cash" | "transfer" | "card" | "room";
  booking_id: string | null;
  sold_by: string | null;
  note: string | null;
  created_at: string;
}

export interface PosSaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  name: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

// ── categories ───────────────────────────────────────────────────────────────
export async function listCategories(propertyId: string): Promise<ActionResult<PosCategory[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pos_categories").select("*").eq("property_id", propertyId)
      .order("sort_order").order("created_at");
    if (error) throw error;
    return ok((data ?? []) as PosCategory[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function createCategory(
  propertyId: string, tenantId: string, name: string
): Promise<ActionResult<PosCategory>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pos_categories").insert({ tenant_id: tenantId, property_id: propertyId, name })
      .select().single();
    if (error) throw error;
    return ok(data as PosCategory);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function updateCategory(id: string, name: string): Promise<ActionResult<PosCategory>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("pos_categories").update({ name }).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as PosCategory);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("pos_categories").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── products ─────────────────────────────────────────────────────────────────
export interface ProductInput {
  category_id?: string | null;
  name: string;
  price?: number;
  cost?: number;
  sku?: string | null;
  stock?: number;
  active?: boolean;
}

export async function listProducts(
  propertyId: string,
  opts?: { activeOnly?: boolean }
): Promise<ActionResult<PosProduct[]>> {
  try {
    const supabase = createClient();
    let q = supabase.from("pos_products").select("*").eq("property_id", propertyId);
    if (opts?.activeOnly) q = q.eq("active", true);
    const { data, error } = await q.order("sort_order").order("name");
    if (error) throw error;
    return ok((data ?? []) as PosProduct[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function createProduct(
  propertyId: string, tenantId: string, input: ProductInput
): Promise<ActionResult<PosProduct>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pos_products")
      .insert({
        tenant_id: tenantId, property_id: propertyId,
        category_id: input.category_id ?? null, name: input.name,
        price: input.price ?? 0, cost: input.cost ?? 0,
        sku: input.sku ?? null, stock: input.stock ?? 0, active: input.active ?? true,
      })
      .select().single();
    if (error) throw error;
    return ok(data as PosProduct);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<ActionResult<PosProduct>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("pos_products").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return ok(data as PosProduct);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function deleteProduct(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("pos_products").delete().eq("id", id);
    if (error) throw error;
    return ok({ id });
  } catch (e) {
    return mapPgError(e);
  }
}

// ── sales ────────────────────────────────────────────────────────────────────
export interface SaleItemInput {
  product_id: string;
  qty: number;
}

export async function createSale(
  propertyId: string,
  payment: PosSale["payment_method"],
  bookingId: string | null,
  items: SaleItemInput[],
  note?: string | null
): Promise<ActionResult<{ id: string; code: string; total: number }>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("pos_create_sale", {
      p_property: propertyId,
      p_payment: payment,
      p_booking: bookingId,
      p_items: items,
      p_note: note ?? null,
    });
    if (error) throw error;
    return ok(data as { id: string; code: string; total: number });
  } catch (e) {
    return mapPgError(e);
  }
}

export async function listSales(propertyId: string, limit = 200): Promise<ActionResult<PosSale[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pos_sales").select("*").eq("property_id", propertyId)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return ok((data ?? []) as PosSale[]);
  } catch (e) {
    return mapPgError(e);
  }
}

export async function getSaleItems(saleId: string): Promise<ActionResult<PosSaleItem[]>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("pos_sale_items").select("*").eq("sale_id", saleId);
    if (error) throw error;
    return ok((data ?? []) as PosSaleItem[]);
  } catch (e) {
    return mapPgError(e);
  }
}
