import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/admin";
import { Boxes, LayoutDashboard, Link2, ListTree, ScrollText } from "lucide-react";

// Platform admin console shell — served at /admin/* and, via the middleware
// host rewrite, at the root of admin.hostgate.app. Dark, minimal, deliberately
// separate from both the marketing chrome and the tenant PMS shell.

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Tenants", icon: Boxes },
  { href: "/admin/channex", label: "Channex", icon: Link2 },
  { href: "/admin/events", label: "Events", icon: ListTree },
  { href: "/admin/docs", label: "Docs", icon: ScrollText },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/login?next=/admin");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/admin" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500 text-xs font-bold text-zinc-950">HG</span>
            HostGate <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">Admin</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100">
                <Icon size={14} /> {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto text-xs text-zinc-500">{admin.email}</div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
