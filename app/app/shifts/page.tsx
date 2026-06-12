import { getActiveProperty } from "@/lib/active-property-server";
import { listShifts, listTenantMembers } from "@/lib/db/operations";
import ShiftsClient from "@/components/app/operations/ShiftsClient";

export const dynamic = "force-dynamic";

function monthBounds(month: string): { from: string; to: string; month: string } {
  // month = "YYYY-MM"; fall back to current month.
  const m = /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
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

  const [shiftsRes, membersRes] = await Promise.all([
    listShifts(property.id, from, to),
    listTenantMembers(tenant.id),
  ]);

  return (
    <ShiftsClient
      month={month}
      shifts={shiftsRes.ok ? shiftsRes.data : []}
      members={membersRes.ok ? membersRes.data : []}
    />
  );
}
