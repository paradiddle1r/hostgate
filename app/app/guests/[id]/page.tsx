import { notFound } from "next/navigation";
import { getActiveProperty } from "@/lib/active-property-server";
import { getGuestWithBookings } from "@/lib/db/guests";
import { listRooms } from "@/lib/db/rooms";
import GuestDetailClient from "@/components/app/guests/GuestDetailClient";

export const dynamic = "force-dynamic";

export default async function GuestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;

  const res = await getGuestWithBookings(params.id);
  if (!res.ok) notFound();

  const roomsRes = await listRooms(property.id);
  const rooms = roomsRes.ok ? roomsRes.data : [];
  const roomNumberById: Record<string, string> = {};
  for (const r of rooms) roomNumberById[r.id] = r.number;

  return (
    <GuestDetailClient
      guest={res.data.guest}
      bookings={res.data.bookings}
      roomNumberById={roomNumberById}
      currency={property.currency}
    />
  );
}
