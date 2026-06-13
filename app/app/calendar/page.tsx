import { createClient } from "@/lib/supabase/server";
import { getActiveProperty, getMemberships } from "@/lib/active-property-server";
import { listRooms } from "@/lib/db/rooms";
import { listBookings } from "@/lib/db/bookings";
import { rateMap } from "@/lib/db/rates";
import { listRatePlans } from "@/lib/db/rate-plans";
import CalendarClient, { RoomTypeBrief } from "@/components/app/calendar/CalendarClient";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 14;

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const sp = await searchParams;
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;
  const tenant = active.data.tenant;
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp?.from ?? "") ? (sp!.from as string) : today;
  const to = addDays(from, WINDOW_DAYS);

  const [roomsRes, typesRes, bookingsRes, plansRes, membersRes] = await Promise.all([
    listRooms(property.id),
    supabase
      .from("room_types")
      .select("id, name, daily_rate")
      .eq("property_id", property.id)
      .order("sort_order", { ascending: true }),
    listBookings(property.id, from, to),
    listRatePlans(property.id),
    getMemberships(),
  ]);

  const rooms = (roomsRes.ok ? roomsRes.data : []).filter((r) => r.status === "active");
  const roomTypes = (typesRes.data ?? []) as RoomTypeBrief[];
  const bookings = bookingsRes.ok ? bookingsRes.data : [];
  const plans = (plansRes.ok ? plansRes.data : []).filter((p) => p.active);

  // Current user's role for THIS tenant — gates the admin/owner analytics block.
  const myRole =
    membersRes.ok
      ? membersRes.data.find((m) => m.tenant_id === tenant.id)?.role ?? "staff"
      : "staff";

  const typeIds = roomTypes.map((t) => t.id);
  const ratesRes = typeIds.length ? await rateMap(property.id, typeIds, from, to) : null;
  const rates = ratesRes && ratesRes.ok ? ratesRes.data : {};

  // Which date carries which rate plan (date → plan_id), so the header can
  // paint a coloured stripe on plan-stamped days. We read daily_rates.plan_id
  // directly (not exposed by rateMap) and keep the first plan we see per date —
  // a single plan apply stamps every room type the same day, so one is enough.
  const planByDate: Record<string, string> = {};
  if (typeIds.length) {
    const { data: planRows } = await supabase
      .from("daily_rates")
      .select("date, plan_id")
      .eq("property_id", property.id)
      .in("room_type_id", typeIds)
      .not("plan_id", "is", null)
      .gte("date", from)
      .lt("date", to);
    for (const r of planRows ?? []) {
      const d = r.date as string;
      if (!planByDate[d] && r.plan_id) planByDate[d] = r.plan_id as string;
    }
  }

  return (
    <CalendarClient
      from={from}
      windowDays={WINDOW_DAYS}
      today={today}
      rooms={rooms}
      roomTypes={roomTypes}
      bookings={bookings}
      rates={rates}
      plans={plans}
      planByDate={planByDate}
      currency={property.currency}
      role={myRole}
    />
  );
}
