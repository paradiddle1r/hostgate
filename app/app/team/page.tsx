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

  // `created_at` lives on tenant_members but isn't surfaced by the
  // app_tenant_members RPC / TenantMember interface (which I may not edit).
  // Read it inline here (RLS-scoped: members can SELECT all rows in their
  // tenant) and pass a user_id → ISO-date map to the client.
  let joinedAt: Record<string, string> = {};
  try {
    const { data: joins } = await supabase
      .from("tenant_members")
      .select("user_id, created_at")
      .eq("tenant_id", tenant.id);
    joinedAt = Object.fromEntries(
      ((joins ?? []) as Array<{ user_id: string; created_at: string | null }>)
        .filter((r) => r.created_at)
        .map((r) => [r.user_id, r.created_at as string])
    );
  } catch {
    /* non-critical — Created column just renders a dash */
  }

  return (
    <TeamClient
      members={members}
      currentUserId={currentUserId}
      myRole={myRole}
      tenantName={tenant.name}
      plan={tenant.plan}
      joinedAt={joinedAt}
    />
  );
}
