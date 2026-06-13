import { getActiveProperty } from "@/lib/active-property-server";
import { listRatePlans } from "@/lib/db/rate-plans";
import { createClient } from "@/lib/supabase/server";
import RatePlansClient, { RoomTypeBrief, PlanRateRow } from "@/components/app/rate-plans/RatePlansClient";

export const dynamic = "force-dynamic";

export default async function RatePlansPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;
  const supabase = createClient();

  const [plansRes, typesRes, ratesRes] = await Promise.all([
    listRatePlans(property.id),
    supabase
      .from("room_types")
      .select("id, name, daily_rate")
      .eq("property_id", property.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("rate_plan_rates")
      .select("rate_plan_id, room_type_id, price")
      .eq("property_id", property.id),
  ]);

  const roomTypes = (typesRes.data ?? []) as RoomTypeBrief[];
  const planRates = (ratesRes.data ?? []) as PlanRateRow[];

  return (
    <RatePlansClient
      initialPlans={plansRes.ok ? plansRes.data : []}
      roomTypes={roomTypes}
      planRates={planRates}
      currency={property.currency}
    />
  );
}
