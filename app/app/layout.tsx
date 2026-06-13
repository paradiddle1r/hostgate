import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveProperty, listTenantProperties, getCurrentUser } from "@/lib/active-property-server";
import AppShell from "@/components/app/AppShell";

// Server shell for the PMS. Resolves the user, their active property, the
// full property list (for the switcher) and theme, then hands them to the
// client <AppShell>. Redirects out when there's no session / no tenant.
// PERF: user + active property + property list are React-cache()'d, so the
// three reads below run in parallel and share a single auth + membership
// resolution with the page that renders inside this layout.

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();
  const [active, propsRes, profileRes] = await Promise.all([
    getActiveProperty(),
    listTenantProperties(),
    supabase.from("user_profiles").select("theme").eq("id", user.id).maybeSingle(),
  ]);

  if (!active.ok) redirect("/onboarding"); // no property yet → finish onboarding

  const properties = propsRes.ok ? propsRes.data : [active.data.property];

  return (
    <AppShell
      property={active.data.property}
      properties={properties}
      plan={active.data.tenant.plan}
      initialTheme={profileRes.data?.theme ?? "light"}
    >
      {children}
    </AppShell>
  );
}
