import { getActiveProperty } from "@/lib/active-property-server";
import { searchGuests } from "@/lib/db/guests";
import GuestsClient from "@/components/app/guests/GuestsClient";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;

  const res = await searchGuests(active.data.property.id, "");
  const initialGuests = res.ok ? res.data : [];

  return <GuestsClient initialGuests={initialGuests} />;
}
