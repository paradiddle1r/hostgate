import { getActiveProperty } from "@/lib/active-property-server";
import { getActiveRole, canApprove } from "@/lib/active-role-server";
import { listAssets, listAssetCoa } from "@/lib/db/assets";
import AssetsClient from "@/components/app/assets/AssetsClient";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;
  const role = await getActiveRole();

  const [assetsRes, coaRes] = await Promise.all([
    listAssets(property.id),
    listAssetCoa(property.id),
  ]);

  return (
    <AssetsClient
      assets={assetsRes.ok ? assetsRes.data : []}
      coa={coaRes.ok ? coaRes.data : []}
      canApprove={canApprove(role)}
      currency={property.currency}
    />
  );
}
