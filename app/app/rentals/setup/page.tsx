import { getActiveProperty } from "@/lib/active-property-server";
import { listMonthlyRoomTypes } from "@/lib/db/rentals";
import { createClient } from "@/lib/supabase/server";
import MonthlySetupClient from "@/components/app/rentals/MonthlySetupClient";

export const dynamic = "force-dynamic";

export default async function MonthlySetupPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property } = active.data;

  const supabase = createClient();
  const [typesRes, cfgRes] = await Promise.all([
    supabase
      .from("room_types")
      .select("id, name")
      .eq("property_id", property.id)
      .order("sort_order", { ascending: true }),
    listMonthlyRoomTypes(property.id),
  ]);

  const roomTypes = (typesRes.data ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
  }));
  const configs = cfgRes.ok ? cfgRes.data : [];

  return (
    <MonthlySetupClient roomTypes={roomTypes} configs={configs} currency={property.currency} />
  );
}
