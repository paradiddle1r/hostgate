import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveProperty, listTenantProperties } from "@/lib/active-property-server";
import AppShell from "@/components/app/AppShell";

// Server shell for the PMS. Resolves the user, their active property, the
// full property list (for the switcher) and theme, then hands them to the
// client <AppShell>. Redirects out when there's no session / no tenant.

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const active = await getActiveProperty();
  if (!active.ok) {
    // No property yet → finish onboarding first.
    redirect("/onboarding");
  }

  const propsRes = await listTenantProperties();
  const properties = propsRes.ok ? propsRes.data : [active.data.property];

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("theme")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AppShell
      property={active.data.property}
      properties={properties}
      plan={active.data.tenant.plan}
      initialTheme={profile?.theme ?? "light"}
    >
      {children}
    </AppShell>
  );
}
