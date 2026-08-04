import { getActiveProperty } from "@/lib/active-property-server";
import { todayISO } from "@/lib/date";
import { listRooms } from "@/lib/db/rooms";
import { listMonthlyTenants } from "@/lib/db/rentals";
import type { MonthlyTenantRow } from "@/lib/db/rentals";
import { createClient } from "@/lib/supabase/server";
import { isOpenEnded } from "@/lib/rental-calc";
import BatchBillsClient from "@/components/app/rentals/BatchBillsClient";
import RentalsTabs from "@/components/app/rentals/RentalsTabs";

export const dynamic = "force-dynamic";

/**
 * Collapse co-tenant siblings (sharing booking_group_id) to one billable row
 * per lease — the primary = earliest-created member of the group (co-tenants
 * are spawned later). Standalone tenants (null group) pass through unchanged.
 * Without this, every co-tenant would appear as its own billable/payment line;
 * meters + bills are kept on the primary only.
 */
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

export default async function BatchBillsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  const [tenantsRes, roomsRes] = await Promise.all([
    listMonthlyTenants(property.id),
    listRooms(property.id),
  ]);

  const rooms = roomsRes.ok ? roomsRes.data : [];
  const roomById = new Map(rooms.map((r) => [r.id, r.number]));
  const today = todayISO();

  // Active monthly tenants: lease not ended, not cancelled — then collapse
  // co-tenants to one billable row per lease (meters/bills live on the
  // primary, the earliest-created member of the booking_group).
  const active_rows = collapseToPrimaries(
    (tenantsRes.ok ? tenantsRes.data : []).filter(
      (row) =>
        row.booking.status !== "checked_out" &&
        row.booking.status !== "cancelled" &&
        (isOpenEnded(row.booking.check_out) || row.booking.check_out >= today)
    )
  );

  const bookingIds = active_rows.map((r) => r.booking.id);

  // Two latest electric/water readings per booking. The "current" snapshot is
  // the newest reading; "previous" is the one before it (else the start meter),
  // so each period only bills the units since the last reading — not since
  // move-in. Mirrors the single-tenant detail page seed.
  const supabase = createClient();
  const reads2 = new Map<string, Array<{ electric: number | null; water: number | null }>>();
  const existingBills: Array<{ booking_id: string; period_month: string }> = [];
  if (bookingIds.length > 0) {
    const [readsRes, billsRes] = await Promise.all([
      supabase
        .from("meter_readings")
        .select("booking_id, electric, water, reading_date")
        .in("booking_id", bookingIds)
        .order("reading_date", { ascending: false }),
      supabase
        .from("rental_bills")
        .select("booking_id, period_month")
        .in("booking_id", bookingIds),
    ]);
    for (const r of readsRes.data ?? []) {
      const bid = r.booking_id as string;
      const list = reads2.get(bid) ?? [];
      if (list.length < 2) {
        list.push({
          electric: r.electric == null ? null : Number(r.electric),
          water: r.water == null ? null : Number(r.water),
        });
        reads2.set(bid, list);
      }
    }
    for (const b of billsRes.data ?? []) {
      existingBills.push({
        booking_id: b.booking_id as string,
        period_month: b.period_month as string,
      });
    }
  }

  const tenants = active_rows.map((row) => {
    const list = reads2.get(row.booking.id) ?? [];
    const curr = list[0] ?? { electric: null, water: null };
    const prev = list[1] ?? null;
    return {
      bookingId: row.booking.id,
      roomNumber: roomById.get(row.booking.room_id ?? "") ?? "—",
      guestName: row.booking.guest_name,
      monthlyRent: Number(row.tenant.monthly_rent) || 0,
      electricRate: Number(row.tenant.electric_rate) || 0,
      waterRate: Number(row.tenant.water_rate) || 0,
      waterMinimumCharge: Number(row.tenant.water_minimum_charge) || 0,
      internetFee: Number(row.tenant.internet_fee) || 0,
      parkingFee: Number(row.tenant.parking_fee) || 0,
      otherFees: Number(row.tenant.other_fees) || 0,
      // prev = previous reading, falling back to the tenant's start meter.
      startElectric: prev ? prev.electric : row.tenant.start_meter_electric,
      startWater: prev ? prev.water : row.tenant.start_meter_water,
      latestElectric: curr.electric,
      latestWater: curr.water,
    };
  });

  return (
    <>
      <RentalsTabs />
    <BatchBillsClient
      tenants={tenants}
      existingBills={existingBills}
      currency={property.currency}
    />
    </>
  );
}
