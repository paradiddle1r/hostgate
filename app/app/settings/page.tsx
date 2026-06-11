import { getActiveProperty, listTenantProperties } from "@/lib/active-property-server";
import SettingsClient from "@/components/app/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const propsRes = await listTenantProperties();
  const count = propsRes.ok ? propsRes.data.length : 1;

  return (
    <SettingsClient
      property={active.data.property}
      plan={active.data.tenant.plan}
      propertyCount={count}
    />
  );
}
