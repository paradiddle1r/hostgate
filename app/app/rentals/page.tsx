import { getActiveProperty } from "@/lib/active-property-server";
import { listRooms } from "@/lib/db/rooms";
import { listAllBookings } from "@/lib/db/bookings";
import { listMonthlyTenants } from "@/lib/db/rentals";
import RentalsClient from "@/components/app/rentals/RentalsClient";
import RentalsTabs from "@/components/app/rentals/RentalsTabs";

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

  if (!tenantsRes.ok) throw new Error(`${tenantsRes.code}: Unable to load tenants`);
  if (!bookingsRes.ok) throw new Error(`${bookingsRes.code}: Unable to load rental candidates`);
  if (!roomsRes.ok) throw new Error(`${roomsRes.code}: Unable to load rooms`);
  const tenants = tenantsRes.data;
  const bookings = bookingsRes.data;
  const tenantBookingIds = new Set(tenants.map((t) => t.booking.id));
  // Bookings not yet attached to a rental config — candidates to convert.
  const candidates = bookings.filter(
    (b) => !tenantBookingIds.has(b.id) && b.status !== "cancelled" && b.status !== "checked_out" &&
      (b.booking_type === "standard" || b.booking_type === "monthly")
  );

  return (
    <>
      <RentalsTabs />
    <RentalsClient
      tenants={tenants}
      candidates={candidates}
      rooms={(roomsRes.ok ? roomsRes.data : []).filter((r) => r.status === "active")}
      currency={property.currency}
    />
    </>
  );
}
