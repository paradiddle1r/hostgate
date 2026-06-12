import { getActiveProperty } from "@/lib/active-property-server";
import { listSales } from "@/lib/db/pos";
import SalesClient from "@/components/app/pos/SalesClient";
import PosTabs from "@/components/app/pos/PosTabs";

export const dynamic = "force-dynamic";

export default async function PosSalesPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  const salesRes = await listSales(property.id);

  return (
    <>
      <PosTabs />
      <SalesClient sales={salesRes.ok ? salesRes.data : []} currency={property.currency} />
    </>
  );
}
