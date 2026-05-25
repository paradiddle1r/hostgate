import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

/**
 * Tenant-shell placeholder.
 *
 * Real implementation will eventually proxy through to the hotel-pms
 * SaaS instance. For now this is the post-onboarding landing page —
 * it confirms the account is set up and surfaces the tenant + property
 * + room types we just created.
 */
export default async function AppShellPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id, role, tenants(name, slug, plan)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    redirect("/onboarding");
  }

  const primary = memberships[0];
  const tenant = Array.isArray(primary.tenants) ? primary.tenants[0] : primary.tenants;

  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, property_type, city, currency")
    .eq("tenant_id", primary.tenant_id)
    .limit(1);

  const property = properties?.[0];

  const { data: rooms } = property
    ? await supabase
        .from("room_types")
        .select("name, quantity, stay_kind")
        .eq("property_id", property.id)
        .order("sort_order")
    : { data: null };

  return (
    <div className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5 9-11" />
            </svg>
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            ยินดีต้อนรับสู่ HostGate
          </h1>
          <p className="mt-3 text-zinc-600">
            บัญชีของคุณพร้อมใช้งานแล้ว · ระบบ PMS เต็มรูปแบบกำลังจะมา
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-zinc-200/70 bg-white/80 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">บัญชี</div>
              <div className="mt-1 text-sm font-medium text-zinc-900">{user.email}</div>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">องค์กร</div>
              <div className="mt-1 text-sm font-medium text-zinc-900">{tenant?.name ?? "—"}</div>
              <div className="text-xs text-zinc-500">slug · {tenant?.slug ?? "—"} · {tenant?.plan ?? "—"}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">ที่พัก</div>
              <div className="mt-1 text-sm font-medium text-zinc-900">{property?.name ?? "—"}</div>
              <div className="text-xs text-zinc-500">
                ประเภท · {property?.property_type ?? "—"} · {property?.city ?? "—"} · {property?.currency ?? "—"}
              </div>
            </div>
          </div>

          {rooms && rooms.length > 0 && (
            <div className="mt-7 border-t border-zinc-200 pt-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">ประเภทห้อง</div>
              <div className="mt-3 space-y-1.5">
                {rooms.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-2 text-sm">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-xs text-zinc-500">
                      {r.quantity} × {r.stay_kind === "daily" ? "รายวัน" : "รายเดือน"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← กลับหน้าหลัก
          </Link>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
