import { getActiveProperty } from "@/lib/active-property-server";
import { listActivity } from "@/lib/db/admin";
import { listTenantMembers } from "@/lib/db/operations";
import ActivityClient from "@/components/app/admin/ActivityClient";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { tenant } = active.data;

  const [entriesRes, membersRes] = await Promise.all([
    listActivity(tenant.id),
    listTenantMembers(tenant.id),
  ]);

  return (
    <ActivityClient
      entries={entriesRes.ok ? entriesRes.data : []}
      members={membersRes.ok ? membersRes.data : []}
    />
  );
}
