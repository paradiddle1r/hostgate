import { getActiveProperty } from "@/lib/active-property-server";
import { listProducts, listCategories } from "@/lib/db/pos";
import { listBookings } from "@/lib/db/bookings";
import PosTerminalClient from "@/components/app/pos/PosTerminalClient";
import PosTabs from "@/components/app/pos/PosTabs";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;
  const today = new Date().toISOString().slice(0, 10);

  const [productsRes, catsRes, bookingsRes] = await Promise.all([
    listProducts(property.id, { activeOnly: true }),
    listCategories(property.id),
    // in-house bookings today → "charge to room" options
    listBookings(property.id, today, today),
  ]);

  const inhouse = (bookingsRes.ok ? bookingsRes.data : []).filter(
    (b) => b.status === "checked_in" && b.room_id
  );

  return (
    <>
      <PosTabs />
      <PosTerminalClient
        products={productsRes.ok ? productsRes.data : []}
        categories={catsRes.ok ? catsRes.data : []}
        inhouse={inhouse}
        currency={property.currency}
      />
    </>
  );
}
