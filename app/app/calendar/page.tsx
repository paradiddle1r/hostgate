import { createClient } from "@/lib/supabase/server";
import { getActiveProperty } from "@/lib/active-property-server";
import { listRooms } from "@/lib/db/rooms";
import { listBookings } from "@/lib/db/bookings";
import { rateMap } from "@/lib/db/rates";
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
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp?.from ?? "") ? (sp!.from as string) : today;
  const to = addDays(from, WINDOW_DAYS);

  const [roomsRes, typesRes, bookingsRes] = await Promise.all([
    listRooms(property.id),
    supabase
      .from("room_types")
      .select("id, name, daily_rate")
      .eq("property_id", property.id)
      .order("sort_order", { ascending: true }),
    listBookings(property.id, from, to),
  ]);

  const rooms = (roomsRes.ok ? roomsRes.data : []).filter((r) => r.status === "active");
  const roomTypes = (typesRes.data ?? []) as RoomTypeBrief[];
  const bookings = bookingsRes.ok ? bookingsRes.data : [];

  const typeIds = roomTypes.map((t) => t.id);
  const ratesRes = typeIds.length ? await rateMap(property.id, typeIds, from, to) : null;
  const rates = ratesRes && ratesRes.ok ? ratesRes.data : {};

  return (
    <CalendarClient
      from={from}
      windowDays={WINDOW_DAYS}
      today={today}
      rooms={rooms}
      roomTypes={roomTypes}
      bookings={bookings}
      rates={rates}
      currency={property.currency}
    />
  );
}
