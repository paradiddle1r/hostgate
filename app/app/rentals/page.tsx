import { getActiveProperty } from "@/lib/active-property-server";
import { listRooms } from "@/lib/db/rooms";
import { listAllBookings } from "@/lib/db/bookings";
import { listMonthlyTenants } from "@/lib/db/rentals";
import RentalsClient from "@/components/app/rentals/RentalsClient";

export const dynamic = "force-dynamic";

export default async function RentalsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  const [tenantsRes, bookingsRes, roomsRes] = await Promise.all([
    listMonthlyTenants(property.id),
    listAllBookings(property.id),
    listRooms(property.id),
  ]);

  const tenants = tenantsRes.ok ? tenantsRes.data : [];
  const tenantBookingIds = new Set(tenants.map((t) => t.booking.id));
  // Bookings not yet attached to a rental config — candidates to convert.
  const candidates = (bookingsRes.ok ? bookingsRes.data : []).filter(
    (b) => !tenantBookingIds.has(b.id) && b.status !== "cancelled"
  );

  return (
    <RentalsClient
      tenants={tenants}
      candidates={candidates}
      rooms={(roomsRes.ok ? roomsRes.data : []).filter((r) => r.status === "active")}
      currency={property.currency}
    />
  );
}
