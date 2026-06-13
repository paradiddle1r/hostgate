import { getActiveProperty } from "@/lib/active-property-server";
import { listRooms } from "@/lib/db/rooms";
import { listMonthlyTenants } from "@/lib/db/rentals";
import type { MonthlyTenantRow } from "@/lib/db/rentals";
import { createClient } from "@/lib/supabase/server";
import { isOpenEnded } from "@/lib/rental-calc";
import PaymentsClient from "@/components/app/rentals/PaymentsClient";

export const dynamic = "force-dynamic";

/** Collapse co-tenant siblings to one row per lease (primary = earliest of the
 *  booking_group); standalone tenants pass through. Mirrors the bills page. */
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

export default async function RentalPaymentsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  const [tenantsRes, roomsRes] = await Promise.all([
    listMonthlyTenants(property.id),
    listRooms(property.id),
  ]);

  const rooms = roomsRes.ok ? roomsRes.data : [];
  const roomById = new Map(rooms.map((r) => [r.id, r.number]));
  const todayISO = new Date().toISOString().slice(0, 10);

  const activeRows = collapseToPrimaries(
    (tenantsRes.ok ? tenantsRes.data : []).filter(
      (row) =>
        row.booking.status !== "checked_out" &&
        row.booking.status !== "cancelled" &&
        (isOpenEnded(row.booking.check_out) || row.booking.check_out >= todayISO)
    )
  );

  const tenants = activeRows.map((row) => ({
    bookingId: row.booking.id,
    roomNumber: roomById.get(row.booking.room_id ?? "") ?? "—",
    guestName: row.booking.guest_name,
  }));

  const bookingIds = activeRows.map((r) => r.booking.id);
  const supabase = createClient();
  let bills: Array<{
    id: string;
    booking_id: string;
    period_month: string;
    period_end: string | null;
    total: number;
    status: string;
  }> = [];
  if (bookingIds.length > 0) {
    const { data } = await supabase
      .from("rental_bills")
      .select("id, booking_id, period_month, period_end, total, status")
      .in("booking_id", bookingIds)
      .order("period_month", { ascending: false });
    bills = (data ?? []).map((b) => ({
      id: b.id as string,
      booking_id: b.booking_id as string,
      period_month: b.period_month as string,
      period_end: (b.period_end as string | null) ?? null,
      total: Number(b.total) || 0,
      status: b.status as string,
    }));
  }

  return <PaymentsClient tenants={tenants} bills={bills} currency={property.currency} />;
}
