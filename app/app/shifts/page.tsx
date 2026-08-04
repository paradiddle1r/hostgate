import { createClient } from "@/lib/supabase/server";
import { getActiveProperty } from "@/lib/active-property-server";
import { listShifts, listTenantMembers } from "@/lib/db/operations";
import ShiftsClient from "@/components/app/operations/ShiftsClient";
import { thisMonthISO } from "@/lib/date";

export const dynamic = "force-dynamic";

function monthBounds(month: string): { from: string; to: string; month: string } {
  // month = "YYYY-MM"; fall back to current month.
  const m = /^\d{4}-\d{2}$/.test(month) ? month : thisMonthISO();
  const [y, mo] = m.split("-").map(Number);
  const from = `${m}-01`;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate(); // day 0 of next month
  const to = `${m}-${String(last).padStart(2, "0")}`;
  return { from, to, month: m };
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property, tenant } = active.data;
  const { from, to, month } = monthBounds(sp?.month ?? "");

  const supabase = createClient();
  const [{ data: userData }, shiftsRes, membersRes] = await Promise.all([
    supabase.auth.getUser(),
    listShifts(property.id, from, to),
    listTenantMembers(tenant.id),
  ]);

  const members = membersRes.ok ? membersRes.data : [];
  // Edits (assign shifts, bulk-assign, manage staff) are owner/admin only; staff
  // see a read-only schedule. Mirrors the team page's role resolution.
  const myRole =
    members.find((m) => m.user_id === userData.user?.id)?.role ?? "staff";
  const canEdit = myRole === "owner" || myRole === "admin";

  return (
    <ShiftsClient
      month={month}
      shifts={shiftsRes.ok ? shiftsRes.data : []}
      members={members}
      canEdit={canEdit}
    />
  );
}
