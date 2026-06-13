import { getActiveProperty } from "@/lib/active-property-server";
import { createClient } from "@/lib/supabase/server";
import type { PosSale, PosSaleItem } from "@/lib/db/pos";
import DashboardClient from "@/components/app/pos/DashboardClient";
import PosTabs from "@/components/app/pos/PosTabs";

export const dynamic = "force-dynamic";

export default async function PosDashboardPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  // HostGate's server client is synchronous (no await).
  const supabase = createClient();

  // Sales for the actual 30-day window the KPI labels promise. listSales() has
  // no date filter (just a 200-row cap), so query directly + property-scoped so
  // the "· 30 days" cards / 7-day chart / top-sellers all reflect the real
  // window, not all-time figures.
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: salesData } = await supabase
    .from("pos_sales")
    .select("*")
    .eq("property_id", property.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });
  const sales = (salesData ?? []) as PosSale[];

  // Line items for the top-products table — scoped to this property's recent
  // sale ids (pos_sale_items has no property_id; RLS enforces tenancy).
  const saleIds = sales.map((s) => s.id);
  let items: PosSaleItem[] = [];
  if (saleIds.length > 0) {
    const { data } = await supabase
      .from("pos_sale_items")
      .select("*")
      .in("sale_id", saleIds);
    items = (data ?? []) as PosSaleItem[];
  }

  return (
    <>
      <PosTabs />
      <DashboardClient sales={sales} items={items} currency={property.currency} />
    </>
  );
}
