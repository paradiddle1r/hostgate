import { getActiveProperty } from "@/lib/active-property-server";
import { todayISO, addDaysISO } from "@/lib/date";
import { listRooms } from "@/lib/db/rooms";
import { listMaintenance, MaintenanceOrder } from "@/lib/db/operations";
import MaintenanceClient from "@/components/app/operations/MaintenanceClient";

export const dynamic = "force-dynamic";

// Period → window length in days. `'all'` skips the date filter entirely.
// Mirrors the hotel-pms maintenance page period chips (1m/3m/6m/1y/All).
const PERIOD_DAYS: Record<string, number | null> = {
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
  all: null,
};
const DEFAULT_PERIOD = "1y";

// Pick the most relevant date for windowing an order: prefer when it went
// out-of-service, fall back to when it was reported. Orders whose end is
// within the window (or that are still open) stay visible.
function orderDate(o: MaintenanceOrder): string {
  return (o.oos_to || o.oos_from || o.reported_at || o.created_at).slice(0, 10);
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  const sp = (await searchParams) || {};
  const rawPeriod = Array.isArray(sp.period) ? sp.period[0] : sp.period;
  const period =
    rawPeriod && PERIOD_DAYS[rawPeriod] !== undefined ? rawPeriod : DEFAULT_PERIOD;
  const days = PERIOD_DAYS[period];
  const since =
    days != null ? addDaysISO(todayISO(), -days) : null;

  const [roomsRes, ordersRes] = await Promise.all([
    listRooms(property.id),
    listMaintenance(property.id),
  ]);

  const allOrders = ordersRes.ok ? ordersRes.data : [];
  // Always keep open / in-progress orders regardless of period (their work
  // is ongoing); window the rest on their most-relevant date.
  const orders = since
    ? allOrders.filter((o) => o.status !== "resolved" || orderDate(o) >= since)
    : allOrders;

  return (
    <MaintenanceClient
      orders={orders}
      rooms={(roomsRes.ok ? roomsRes.data : []).filter((r) => r.status === "active")}
      currency={property.currency}
      period={period}
    />
  );
}
