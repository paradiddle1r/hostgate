import { createClient } from "@/lib/supabase/server";
import { getActiveProperty } from "@/lib/active-property-server";
import { listAnnouncements } from "@/lib/db/announcements";
import AnnouncementsClient from "@/components/app/announcements/AnnouncementsClient";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property, tenant } = active.data;
  const supabase = createClient();

  const [{ data: userData }, listRes] = await Promise.all([
    supabase.auth.getUser(),
    listAnnouncements(property.id),
  ]);

  // Resolve the caller's role on this tenant — owner/admin get editing controls.
  let canManage = false;
  const userId = userData.user?.id ?? null;
  if (userId) {
    const { data: member } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant.id)
      .eq("user_id", userId)
      .maybeSingle();
    const role = (member?.role as string) ?? "staff";
    canManage = role === "owner" || role === "admin";
  }

  return (
    <AnnouncementsClient
      initial={listRes.ok ? listRes.data : []}
      canManage={canManage}
    />
  );
}
