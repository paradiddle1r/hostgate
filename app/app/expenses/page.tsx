import { getActiveProperty } from "@/lib/active-property-server";
import { getActiveRole, canApprove } from "@/lib/active-role-server";
import { listExpenses, listWht } from "@/lib/db/expenses";
import { listContacts } from "@/lib/db/contacts";
import ExpensesClient from "@/components/app/expenses/ExpensesClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;
  const role = await getActiveRole();

  const [expRes, whtRes, vendorRes] = await Promise.all([
    listExpenses(property.id),
    listWht(property.id),
    listContacts(property.id, "vendor"),
  ]);

  return (
    <ExpensesClient
      expenses={expRes.ok ? expRes.data : []}
      certs={whtRes.ok ? whtRes.data : []}
      vendors={vendorRes.ok ? vendorRes.data : []}
      currency={property.currency}
      canApprove={canApprove(role)}
    />
  );
}
