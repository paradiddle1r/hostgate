"use client";

// The PMS visual shell: a left sidebar (off-canvas drawer < lg) + a top bar
// with the property switcher, theme + locale toggles and sign-out. Owns the
// live `data-theme` so the theme toggle can repaint instantly, and the mobile
// drawer state. Wraps the page content in <main>.

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Users, BedDouble, Settings, LayoutDashboard, Menu, X, Building2, BookOpen, Tag } from "lucide-react";
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
  { href: "/app/bookings", icon: BookOpen, key: "nav.bookings" },
  { href: "/app/guests", icon: Users, key: "nav.guests" },
  { href: "/app/rooms", icon: BedDouble, key: "nav.rooms" },
  { href: "/app/rate-plans", icon: Tag, key: "nav.ratePlans" },
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
          className="app-shell relative flex min-h-screen flex-col"
          style={{ background: "var(--app-bg)", color: "var(--app-fg)" }}
        >
          {/* Liquid mesh — visible only on the Pro glass tiers (CSS-gated). */}
          <div className="app-mesh" aria-hidden>
            <i /><i /><i /><i />
          </div>

          {/* Top bar — horizontal nav, like the real hotel-pms desktop. */}
          <header className="relative z-20 flex h-14 flex-none items-center gap-2 border-b border-[var(--app-border)] px-3 md:px-4">
            <button className="lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>
            {/* Brand slot = the customer's property name (doubles as the
                property switcher on Pro multi-property accounts). */}
            <div className="flex min-w-0 flex-none items-center gap-2 pr-1">
              <div className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-[var(--app-accent)] text-[var(--app-accent-fg)]">
                <Building2 size={16} />
              </div>
              <PropertySwitcher />
            </div>
            <nav className="hidden min-w-0 items-center gap-0.5 lg:flex">
              {NAV.map(({ href, icon: Icon, key, exact }) => {
                const on = isActive(href, exact);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                      on
                        ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                        : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)]"
                    }`}
                  >
                    <Icon size={15} /> {t(key)}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex flex-none items-center gap-2">
              <LocaleToggle />
              <ThemeToggle theme={theme} plan={plan} onChange={setTheme} />
              <SignOutButton />
            </div>
          </header>

          {/* Mobile drawer */}
          {drawer && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} aria-hidden />
              <aside className="app-surface absolute left-0 top-0 h-full w-64 border-r border-[var(--app-border)]">
                <div className="flex h-14 items-center justify-between gap-2 px-5">
                  <span className="truncate text-base font-semibold">{property.name}</span>
                  <button onClick={() => setDrawer(false)} aria-label="Close menu" className="flex-none">
                    <X size={20} />
                  </button>
                </div>
                {nav}
              </aside>
            </div>
          )}

          {/* Content */}
          <main className="relative z-10 min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
        </div>
      </ToastProvider>
    </ActivePropertyProvider>
  );
}
