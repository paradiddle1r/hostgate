import { createClient } from "@/lib/supabase/server";
import { getActiveProperty } from "@/lib/active-property-server";
import { listRooms } from "@/lib/db/rooms";
import RoomsClient, { RoomTypeOption } from "@/components/app/rooms/RoomsClient";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;
  const supabase = createClient();

  const [roomsRes, typesRes] = await Promise.all([
    listRooms(property.id),
    supabase
      .from("room_types")
      .select("id, name")
      .eq("property_id", property.id)
      .order("sort_order", { ascending: true }),
  ]);

  const rooms = roomsRes.ok ? roomsRes.data : [];
  const roomTypes = (typesRes.data ?? []) as RoomTypeOption[];

  return <RoomsClient initialRooms={rooms} roomTypes={roomTypes} />;
}
