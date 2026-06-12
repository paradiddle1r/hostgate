import { getActiveProperty } from "@/lib/active-property-server";
import { listRooms } from "@/lib/db/rooms";
import { listMaintenance } from "@/lib/db/operations";
import MaintenanceClient from "@/components/app/operations/MaintenanceClient";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  const [roomsRes, ordersRes] = await Promise.all([
    listRooms(property.id),
    listMaintenance(property.id),
  ]);

  return (
    <MaintenanceClient
      orders={ordersRes.ok ? ordersRes.data : []}
      rooms={(roomsRes.ok ? roomsRes.data : []).filter((r) => r.status === "active")}
      currency={property.currency}
    />
  );
}
