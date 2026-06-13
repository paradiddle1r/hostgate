import { getActiveProperty } from "@/lib/active-property-server";
import { createClient } from "@/lib/supabase/server";
import { listSales } from "@/lib/db/pos";
import SalesClient from "@/components/app/pos/SalesClient";
import PosTabs from "@/components/app/pos/PosTabs";

export const dynamic = "force-dynamic";

export default async function PosSalesPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { property, tenant } = active.data;

  // Resolve whether the caller is an owner/admin so we can surface the
  // void-with-reason control. Mirrors the gate inside the voidSale action —
  // the action re-checks server-side, this is purely to show/hide the button.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: me } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .maybeSingle();
    const role = (me?.role as string | undefined) ?? "staff";
    isAdmin = role === "owner" || role === "admin";
  }

  const salesRes = await listSales(property.id);

  return (
    <>
      <PosTabs />
      <SalesClient
        sales={salesRes.ok ? salesRes.data : []}
        currency={property.currency}
        isAdmin={isAdmin}
      />
    </>
  );
}
