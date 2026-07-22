import { getActiveProperty } from "@/lib/active-property-server";
import { getActiveRole, canApprove } from "@/lib/active-role-server";
import { listBankAccounts, listStatements } from "@/lib/db/banking";
import BankingClient from "@/components/app/banking/BankingClient";

export const dynamic = "force-dynamic";

export default async function BankingPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;
  const role = await getActiveRole();

  const [accountsRes, statementsRes] = await Promise.all([
    listBankAccounts(property.id),
    listStatements(property.id),
  ]);

  return (
    <BankingClient
      accounts={accountsRes.ok ? accountsRes.data : []}
      statements={statementsRes.ok ? statementsRes.data : []}
      canApprove={canApprove(role)}
      currency={property.currency}
    />
  );
}
