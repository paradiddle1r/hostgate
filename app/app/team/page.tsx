import { createClient } from "@/lib/supabase/server";
import { getActiveProperty } from "@/lib/active-property-server";
import { listTenantMembers } from "@/lib/db/operations";
import TeamClient from "@/components/app/admin/TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { tenant } = active.data;
  const supabase = createClient();

  const [{ data: userData }, membersRes] = await Promise.all([
    supabase.auth.getUser(),
    listTenantMembers(tenant.id),
  ]);

  const members = membersRes.ok ? membersRes.data : [];
  const currentUserId = userData.user?.id ?? null;
  const myRole = members.find((m) => m.user_id === currentUserId)?.role ?? "staff";

  return (
    <TeamClient
      members={members}
      currentUserId={currentUserId}
      myRole={myRole}
      tenantName={tenant.name}
      plan={tenant.plan}
    />
  );
}
