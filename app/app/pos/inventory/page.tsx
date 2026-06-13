import { getActiveProperty } from "@/lib/active-property-server";
import { listProducts, listStockMovements } from "@/lib/db/pos";
import InventoryClient from "@/components/app/pos/InventoryClient";
import PosTabs from "@/components/app/pos/PosTabs";

export const dynamic = "force-dynamic";

export default async function PosInventoryPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  const [productsRes, movementsRes] = await Promise.all([
    listProducts(property.id),
    listStockMovements(property.id, { limit: 100 }),
  ]);

  return (
    <>
      <PosTabs />
      <InventoryClient
        products={productsRes.ok ? productsRes.data : []}
        movements={movementsRes.ok ? movementsRes.data : []}
        currency={property.currency}
      />
    </>
  );
}
