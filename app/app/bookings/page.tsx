import { getActiveProperty } from "@/lib/active-property-server";
import { listAllBookings } from "@/lib/db/bookings";
import { listRooms } from "@/lib/db/rooms";
import BookingsClient from "@/components/app/bookings/BookingsClient";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;

  const [bookingsRes, roomsRes] = await Promise.all([
    listAllBookings(property.id),
    listRooms(property.id),
  ]);

  const initialBookings = bookingsRes.ok ? bookingsRes.data : [];

  // Map every room id → its number (incl. inactive rooms, so bookings on a
  // now-retired room still resolve a number rather than showing "—").
  const rooms = roomsRes.ok ? roomsRes.data : [];
  const roomNumberById: Record<string, string> = {};
  for (const r of rooms) roomNumberById[r.id] = r.number;

  return (
    <BookingsClient
      initialBookings={initialBookings}
      roomNumberById={roomNumberById}
      currency={property.currency}
    />
  );
}
