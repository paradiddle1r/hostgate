import { getActiveProperty } from "@/lib/active-property-server";
import { listRatePlans } from "@/lib/db/rate-plans";
import RatePlansClient from "@/components/app/rate-plans/RatePlansClient";

export const dynamic = "force-dynamic";

export default async function RatePlansPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const res = await listRatePlans(active.data.property.id);
  return <RatePlansClient initialPlans={res.ok ? res.data : []} currency={active.data.property.currency} />;
}
