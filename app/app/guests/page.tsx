import { getActiveProperty } from "@/lib/active-property-server";
import { createClient } from "@/lib/supabase/server";
import { listAllBookings } from "@/lib/db/bookings";
import { listRooms } from "@/lib/db/rooms";
import type { Guest } from "@/lib/db/guests";
import type { Booking } from "@/lib/db/bookings";
import GuestsClient, { type GuestStat } from "@/components/app/guests/GuestsClient";

export const dynamic = "force-dynamic";

function isoToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// Roll every booking up per guest → { visits, nights, spend, lastStay,
// inHouseRoomId }. Mirrors hotel-pms's GuestsClient.stats, but server-side and
// deduped through a single pass so the list, chips, and stats columns all read
// from one source instead of N per-row queries.
function rollUpStats(bookings: Booking[]): Record<string, GuestStat> {
  const today = isoToday();
  const out: Record<string, GuestStat> = {};
  for (const b of bookings) {
    if (!b.guest_id) continue;
    if (b.status === "cancelled") continue;
    let s = out[b.guest_id];
    if (!s) {
      s = { visits: 0, nights: 0, spend: 0, lastStay: null, inHouseRoomId: null };
      out[b.guest_id] = s;
    }
    s.visits += 1;
    if (b.check_in && b.check_out) {
      const ms = new Date(b.check_out).getTime() - new Date(b.check_in).getTime();
      if (Number.isFinite(ms) && ms > 0) s.nights += Math.round(ms / 86_400_000);
    }
    const amt = Number(b.total_amount);
    if (Number.isFinite(amt)) s.spend += amt;
    if (!s.lastStay || (b.check_in && b.check_in > s.lastStay)) s.lastStay = b.check_in;
    // In-house = checked_in, or today falls within [check_in, check_out).
    if (
      b.status === "checked_in" ||
      (b.check_in && b.check_out && b.check_in <= today && b.check_out > today)
    ) {
      s.inHouseRoomId = b.room_id;
    }
  }
  return out;
}

export default async function GuestsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;

  // Guests: an inline uncapped query (searchGuests caps at 50) so the list,
  // client-side search over car_plate/thai_name, and the filter chips all see
  // every guest. RLS scopes this to the active property's tenant.
  const supabase = createClient();
  const { data: guestRows } = await supabase
    .from("guests")
    .select("*")
    .eq("property_id", property.id)
    .order("updated_at", { ascending: false });
  const initialGuests = (guestRows ?? []) as Guest[];

  const [bookingsRes, roomsRes] = await Promise.all([
    listAllBookings(property.id),
    listRooms(property.id),
  ]);
  const bookings = bookingsRes.ok ? bookingsRes.data : [];
  const rooms = roomsRes.ok ? roomsRes.data : [];

  const roomNumberById: Record<string, string> = {};
  for (const r of rooms) roomNumberById[r.id] = r.number;

  const statsByGuestId = rollUpStats(bookings);

  return (
    <GuestsClient
      initialGuests={initialGuests}
      statsByGuestId={statsByGuestId}
      roomNumberById={roomNumberById}
      currency={property.currency}
    />
  );
}
