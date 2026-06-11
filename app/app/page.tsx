import { createClient } from "@/lib/supabase/server";
import { getActiveProperty } from "@/lib/active-property-server";
import HomeClient from "@/components/app/HomeClient";

// PMS home / overview. Counts rooms, guests and today's arrivals for the
// active property, then renders the client overview (labels are i18n'd).

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const active = await getActiveProperty();
  if (!active.ok) return null; // layout already redirects; satisfy types
  const property = active.data.property;
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const [rooms, guests, arrivals] = await Promise.all([
    supabase.from("rooms").select("*", { count: "exact", head: true }).eq("property_id", property.id),
    supabase.from("guests").select("*", { count: "exact", head: true }).eq("property_id", property.id),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("property_id", property.id)
      .eq("check_in", today)
      .neq("status", "cancelled"),
  ]);

  return (
    <HomeClient
      propertyName={property.name}
      counts={{
        rooms: rooms.count ?? 0,
        guests: guests.count ?? 0,
        arrivals: arrivals.count ?? 0,
      }}
    />
  );
}
