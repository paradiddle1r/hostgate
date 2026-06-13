import { getActiveProperty } from "@/lib/active-property-server";
import { listRooms } from "@/lib/db/rooms";
import { getRentalDetail, listMonthlyTenants } from "@/lib/db/rentals";
import type { MonthlyTenantRow } from "@/lib/db/rentals";
import { createClient } from "@/lib/supabase/server";
import { isOpenEnded } from "@/lib/rental-calc";
import TenantDetailClient from "@/components/app/rentals/TenantDetailClient";

export const dynamic = "force-dynamic";

/** Collapse co-tenant siblings to one row per lease (primary = earliest of the
 *  booking_group); standalone tenants pass through. So the bulk-meter modal
 *  lists one row per room, not one per co-tenant. */
function collapseToPrimaries(rows: MonthlyTenantRow[]): MonthlyTenantRow[] {
  const primaryByGroup = new Map<string, MonthlyTenantRow>();
  const out: MonthlyTenantRow[] = [];
  for (const row of rows) {
    const gid = row.booking.booking_group_id;
    if (!gid) {
      out.push(row);
      continue;
    }
    const cur = primaryByGroup.get(gid);
    if (!cur || row.booking.created_at < cur.booking.created_at) {
      primaryByGroup.set(gid, row);
    }
  }
  return [...out, ...primaryByGroup.values()];
}

export default async function TenantDetailPage({
  params,
}: {
  params: { bookingId: string };
}) {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  const [detailRes, roomsRes, tenantsRes] = await Promise.all([
    getRentalDetail(params.bookingId),
    listRooms(property.id),
    listMonthlyTenants(property.id),
  ]);

  if (!detailRes.ok) {
    return (
      <div className="mx-auto max-w-md p-10 text-center text-sm text-[var(--app-fg-muted)]">
        {detailRes.code} · {detailRes.message}
      </div>
    );
  }

  const rooms = roomsRes.ok ? roomsRes.data : [];
  const booking = detailRes.data.booking;
  const roomNumber = rooms.find((r) => r.id === booking.room_id)?.number ?? "—";

  // Co-tenants: sibling bookings sharing this lease's booking_group_id, plus
  // their rate config. Raw read here (no dedicated db helper for it).
  let coTenants: Array<{
    bookingId: string;
    guestName: string;
    phone: string | null;
    monthlyRent: number;
  }> = [];
  if (booking.booking_group_id) {
    const supabase = createClient();
    const { data: siblings } = await supabase
      .from("bookings")
      .select("id, guest_name, phone")
      .eq("booking_group_id", booking.booking_group_id)
      .neq("id", booking.id);
    const sibIds = (siblings ?? []).map((b) => b.id as string);
    let rentByBooking = new Map<string, number>();
    if (sibIds.length > 0) {
      const { data: configs } = await supabase
        .from("rental_tenants")
        .select("booking_id, monthly_rent")
        .in("booking_id", sibIds);
      rentByBooking = new Map(
        (configs ?? []).map((c) => [c.booking_id as string, Number(c.monthly_rent) || 0])
      );
    }
    coTenants = (siblings ?? []).map((b) => ({
      bookingId: b.id as string,
      guestName: (b.guest_name as string) ?? "—",
      phone: (b.phone as string | null) ?? null,
      monthlyRent: rentByBooking.get(b.id as string) ?? 0,
    }));
  }

  // Bulk-meter modal source: every active monthly tenant + its latest reading
  // (the prev meter for the next reading). "Active" = lease not checked-out and
  // not cancelled. We map room numbers from the rooms list.
  const roomById = new Map(rooms.map((r) => [r.id, r.number]));
  const activeRows = collapseToPrimaries(
    (tenantsRes.ok ? tenantsRes.data : []).filter(
      (row) =>
        row.booking.status !== "checked_out" &&
        row.booking.status !== "cancelled" &&
        (isOpenEnded(row.booking.check_out) ||
          row.booking.check_out >= new Date().toISOString().slice(0, 10))
    )
  );
  const activeBookingIds = activeRows.map((r) => r.booking.id);
  const latestByBooking = new Map<string, { electric: number | null; water: number | null }>();
  if (activeBookingIds.length > 0) {
    const supabase = createClient();
    const { data: reads } = await supabase
      .from("meter_readings")
      .select("booking_id, electric, water, reading_date")
      .in("booking_id", activeBookingIds)
      .order("reading_date", { ascending: false });
    for (const r of reads ?? []) {
      const bid = r.booking_id as string;
      if (!latestByBooking.has(bid)) {
        latestByBooking.set(bid, {
          electric: r.electric == null ? null : Number(r.electric),
          water: r.water == null ? null : Number(r.water),
        });
      }
    }
  }
  const bulkTenants = activeRows.map((row) => {
    const latest = latestByBooking.get(row.booking.id) ?? { electric: null, water: null };
    return {
      bookingId: row.booking.id,
      roomNumber: roomById.get(row.booking.room_id ?? "") ?? "—",
      guestName: row.booking.guest_name,
      prevElectric: latest.electric,
      prevWater: latest.water,
    };
  });

  return (
    <TenantDetailClient
      detail={detailRes.data}
      roomNumber={roomNumber}
      propertyName={property.name}
      currency={property.currency}
      landlordName={property.legal_name ?? property.name}
      coTenants={coTenants}
      bulkTenants={bulkTenants}
    />
  );
}
