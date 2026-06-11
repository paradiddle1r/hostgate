"use client";

// The PMS visual shell: a left sidebar (off-canvas drawer < lg) + a top bar
// with the property switcher, theme + locale toggles and sign-out. Owns the
// live `data-theme` so the theme toggle can repaint instantly, and the mobile
// drawer state. Wraps the page content in <main>.

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Users, BedDouble, Settings, LayoutDashboard, Menu, X } from "lucide-react";
import type { Property } from "@/lib/db/properties";
import { useAppT } from "@/lib/app-i18n";
import { ToastProvider } from "@/components/app/ui/Toast";
import { ActivePropertyProvider } from "@/lib/active-property";
import PropertySwitcher from "./PropertySwitcher";
import ThemeToggle from "./ThemeToggle";
import LocaleToggle from "./LocaleToggle";
import SignOutButton from "@/app/app/SignOutButton";

const NAV = [
  { href: "/app", icon: LayoutDashboard, key: "nav.home", exact: true },
  { href: "/app/calendar", icon: CalendarDays, key: "nav.calendar" },
  { href: "/app/guests", icon: Users, key: "nav.guests" },
  { href: "/app/rooms", icon: BedDouble, key: "nav.rooms" },
  { href: "/app/settings", icon: Settings, key: "nav.settings" },
];

export default function AppShell({
  property,
  properties,
  plan,
  initialTheme,
  children,
}: {
  property: Property;
  properties: Property[];
  plan: string;
  initialTheme: string;
  children: ReactNode;
}) {
  const t = useAppT();
  const pathname = usePathname() || "/app";
  const [theme, setTheme] = useState(initialTheme);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map(({ href, icon: Icon, key, exact }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            isActive(href, exact)
              ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
              : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)]"
          }`}
        >
          <Icon size={18} />
          {t(key)}
        </Link>
      ))}
    </nav>
  );

  return (
    <ActivePropertyProvider property={property} properties={properties} plan={plan}>
      <ToastProvider>
        <div
          data-theme={theme}
          className="app-shell flex min-h-screen"
          style={{ background: "var(--app-bg)", color: "var(--app-fg)" }}
        >
          {/* Desktop sidebar */}
          <aside className="hidden w-60 shrink-0 border-r border-[var(--app-border)] lg:block">
            <div className="flex h-16 items-center gap-2 px-5 text-lg font-semibold tracking-tight">
              <span>Stay</span>
              <span className="text-[var(--app-accent)]">MAYB</span>
            </div>
            {nav}
          </aside>

          {/* Mobile drawer */}
          {drawer && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} aria-hidden />
              <aside className="app-surface absolute left-0 top-0 h-full w-64 border-r border-[var(--app-border)]">
                <div className="flex h-16 items-center justify-between px-5">
                  <span className="text-lg font-semibold">Stay <span className="text-[var(--app-accent)]">MAYB</span></span>
                  <button onClick={() => setDrawer(false)} aria-label="Close menu">
                    <X size={20} />
                  </button>
                </div>
                {nav}
              </aside>
            </div>
          )}

          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-16 items-center gap-3 border-b border-[var(--app-border)] px-4">
              <button
                className="lg:hidden"
                onClick={() => setDrawer(true)}
                aria-label="Open menu"
              >
                <Menu size={22} />
              </button>
              <PropertySwitcher />
              <div className="ml-auto flex items-center gap-2">
                <LocaleToggle />
                <ThemeToggle theme={theme} plan={plan} onChange={setTheme} />
                <SignOutButton />
              </div>
            </header>
            <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </ActivePropertyProvider>
  );
}
