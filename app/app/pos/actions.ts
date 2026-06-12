"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import {
  createCategory, updateCategory, deleteCategory,
  createProduct, updateProduct, deleteProduct,
  createSale, getSaleItems,
  PosCategory, PosProduct, PosSale, PosSaleItem, ProductInput, SaleItemInput,
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
