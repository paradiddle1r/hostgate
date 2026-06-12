import { getActiveProperty } from "@/lib/active-property-server";
import { listRooms } from "@/lib/db/rooms";
import { getRentalDetail } from "@/lib/db/rentals";
import TenantDetailClient from "@/components/app/rentals/TenantDetailClient";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
  params,
}: {
  params: { bookingId: string };
}) {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  const [detailRes, roomsRes] = await Promise.all([
    getRentalDetail(params.bookingId),
    listRooms(property.id),
  ]);

  if (!detailRes.ok) {
    return (
      <div className="mx-auto max-w-md p-10 text-center text-sm text-[var(--app-fg-muted)]">
        {detailRes.code} · {detailRes.message}
      </div>
    );
  }

  const rooms = roomsRes.ok ? roomsRes.data : [];
  const roomNumber = rooms.find((r) => r.id === detailRes.data.booking.room_id)?.number ?? "—";

  return (
    <TenantDetailClient
      detail={detailRes.data}
      roomNumber={roomNumber}
      propertyName={property.name}
      currency={property.currency}
      landlordName={property.legal_name ?? property.name}
    />
  );
}
