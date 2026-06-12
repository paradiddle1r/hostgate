import { createClient } from "@/lib/supabase/server";
import { getActiveProperty } from "@/lib/active-property-server";
import { listRooms } from "@/lib/db/rooms";
import { listHousekeeping, listTenantMembers } from "@/lib/db/operations";
import HousekeepingClient from "@/components/app/operations/HousekeepingClient";

export const dynamic = "force-dynamic";

export default async function HousekeepingPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property, tenant } = active.data;
  const supabase = createClient();

  const [{ data: userData }, roomsRes, tasksRes, membersRes] = await Promise.all([
    supabase.auth.getUser(),
    listRooms(property.id),
    listHousekeeping(property.id),
    listTenantMembers(tenant.id),
  ]);

  return (
    <HousekeepingClient
      tasks={tasksRes.ok ? tasksRes.data : []}
      rooms={(roomsRes.ok ? roomsRes.data : []).filter((r) => r.status === "active")}
      members={membersRes.ok ? membersRes.data : []}
      currentUserId={userData.user?.id ?? null}
    />
  );
}
