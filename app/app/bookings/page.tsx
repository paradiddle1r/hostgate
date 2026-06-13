import { getActiveProperty } from "@/lib/active-property-server";
import { createClient } from "@/lib/supabase/server";
import { listRooms } from "@/lib/db/rooms";
import type { Booking } from "@/lib/db/bookings";
import BookingsClient from "@/components/app/bookings/BookingsClient";

export const dynamic = "force-dynamic";

// Load EVERY booking for the active property, paged. `listAllBookings` caps at
// 500 rows server-side; an accountant-grade export needs the whole history, so
// we page through with PostgREST `.range()` (it silently caps each request, a
// bare `.limit(100000)` would NOT actually return more than ~1000). Tenant
// scoping is preserved — `.eq("property_id", …)` is on every page of the loop.
async function loadAllBookings(propertyId: string): Promise<Booking[]> {
  const supabase = createClient();
  const PAGE = 1000;
  const all: Booking[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("property_id", propertyId)
      .order("check_in", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as Booking[]));
    if (data.length < PAGE) break;
  }
  return all;
}

export default async function BookingsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;

  const [initialBookings, roomsRes] = await Promise.all([
    loadAllBookings(property.id),
    listRooms(property.id),
  ]);

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
