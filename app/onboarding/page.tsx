import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingWizard from "./OnboardingWizard";

export const metadata: Metadata = {
  title: "Set up your property",
};

/**
 * Onboarding wizard entry.
 *   - Not logged in → /login
 *   - Already in a tenant → /app
 *   - Otherwise → render the wizard
 */
export default async function OnboardingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    redirect("/app");
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-12">
        <OnboardingWizard userEmail={user.email ?? ""} />
      </main>
    </div>
  );
}
