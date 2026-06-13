import { createClient } from "@/lib/supabase/server";
import { getActiveProperty, listTenantProperties } from "@/lib/active-property-server";
import SettingsClient from "@/components/app/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const propsRes = await listTenantProperties();
  const count = propsRes.ok ? propsRes.data.length : 1;

  // Appearance prefs (migration 15) for the signed-in user — used to seed the
  // Appearance section's font-size / time-format selectors.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("user_profiles")
        .select("font_size, time_format")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <SettingsClient
      property={active.data.property}
      plan={active.data.tenant.plan}
      propertyCount={count}
      fontSize={(profile?.font_size as string) ?? "normal"}
      timeFormat={(profile?.time_format as string) ?? "24h"}
    />
  );
}
