import { getActiveProperty } from "@/lib/active-property-server";
import { getActiveRole, canApprove } from "@/lib/active-role-server";
import { listJournalEntries, listAccounts, listPeriods } from "@/lib/db/gl";
import AccountingClient from "@/components/app/accounting/AccountingClient";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;
  const role = await getActiveRole();

  const [entriesRes, accountsRes, periodsRes] = await Promise.all([
    listJournalEntries(property.id),
    listAccounts(property.id),
    listPeriods(property.id),
  ]);

  return (
    <AccountingClient
      entries={entriesRes.ok ? entriesRes.data : []}
      accounts={accountsRes.ok ? accountsRes.data : []}
      periods={periodsRes.ok ? periodsRes.data : []}
      canApprove={canApprove(role)}
      currency={property.currency}
    />
  );
}
