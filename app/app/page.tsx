import { getActiveProperty } from "@/lib/active-property-server";
import { listRooms } from "@/lib/db/rooms";
import { listBookings } from "@/lib/db/bookings";
import { listInvoices } from "@/lib/db/invoices";
import { listHousekeeping } from "@/lib/db/operations";
import DashboardClient, {
  type DashKpis,
  type DashRow,
} from "@/components/app/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const REALIZED = new Set(["confirmed", "checked_in", "checked_out"]);
const REVENUE_TYPES = new Set(["standard", "monthly"]);

export default async function DashboardPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const upcomingTo = addDays(today, 31);
  // One window wide enough to cover this month's revenue + the next 30 days.
  const windowFrom = monthStart < today ? monthStart : today;

  const [roomsRes, bookingsRes, invoicesRes, hkRes] = await Promise.all([
    listRooms(property.id),
    listBookings(property.id, windowFrom, upcomingTo),
    listInvoices(property.id),
    listHousekeeping(property.id),
  ]);

  const rooms = (roomsRes.ok ? roomsRes.data : []).filter((r) => r.status === "active");
  const roomLabel = (id: string | null) => rooms.find((r) => r.id === id)?.number ?? "—";
  const bookings = bookingsRes.ok ? bookingsRes.data : [];
  const invoices = invoicesRes.ok ? invoicesRes.data : [];
  const tasks = hkRes.ok ? hkRes.data : [];

  const TOTAL = rooms.length;
  const live = bookings.filter((b) => b.status !== "cancelled");

  // Occupancy today: distinct sellable rooms occupied right now.
  const occRooms = new Set(
    live
      .filter(
        (b) =>
          b.room_id &&
          b.booking_type !== "blocked" &&
          b.booking_type !== "oos" &&
          b.check_in <= today &&
          b.check_out > today,
      )
      .map((b) => b.room_id as string),
  );
  const occToday = occRooms.size;

  const toRow = (b: (typeof bookings)[number]): DashRow => ({
    id: b.id,
    guest_name: b.guest_name || "—",
    room: roomLabel(b.room_id),
    check_in: b.check_in,
    check_out: b.check_out,
    is_open_ended: b.is_open_ended,
  });

  const arrivals = live.filter((b) => b.check_in === today).map(toRow);
  const departures = live.filter((b) => b.check_out === today).map(toRow);
  const inHouse = live.filter((b) => b.check_in <= today && b.check_out > today);
  const upcoming = live
    .filter((b) => b.check_in > today && b.check_in <= addDays(today, 7))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
    .slice(0, 8)
    .map(toRow);

  // Revenue booked for stays starting this month (realized statuses only).
  const monthBookings = live.filter(
    (b) =>
      REALIZED.has(b.status) &&
      REVENUE_TYPES.has(b.booking_type) &&
      b.check_in >= monthStart &&
      b.check_in < addDays(monthStart, 31),
  );
  const monthRevenue = monthBookings.reduce((s, b) => s + (b.total_amount ?? 0), 0);

  // Outstanding = unpaid balance across issued + partially-paid invoices.
  const outstandingInvoices = invoices.filter(
    (i) => i.status === "issued" || i.status === "partial",
  );
  const outstanding = outstandingInvoices.reduce((s, i) => s + (i.balance ?? 0), 0);

  const openTasks = tasks.filter(
    (t) => t.status === "dirty" || t.status === "in-progress",
  ).length;

  const kpis: DashKpis = {
    total: TOTAL,
    occupied: occToday,
    available: Math.max(0, TOTAL - occToday),
    occPct: TOTAL ? Math.round((occToday / TOTAL) * 100) : 0,
    arrivals: arrivals.length,
    departures: departures.length,
    inHouse: inHouse.length,
    monthRevenue,
    monthBookings: monthBookings.length,
    outstanding,
    outstandingCount: outstandingInvoices.length,
    openTasks,
  };

  return (
    <DashboardClient
      propertyName={property.name}
      currency={property.currency}
      today={today}
      kpis={kpis}
      arrivals={arrivals}
      departures={departures}
      upcoming={upcoming}
    />
  );
}
