"use client";

// The PMS visual shell: a top bar with the property switcher, grouped nav
// (dropdowns on desktop, grouped sections in the < lg drawer), theme + locale
// toggles and sign-out. Owns the live `data-theme`, the mobile drawer, and the
// open-dropdown state. Mounts the announcement banner + notes widget.

import { ReactNode, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Users, BedDouble, Settings, LayoutDashboard, Menu, X, Building2, BookOpen, Tag, Receipt, BarChart3, SprayCan, CalendarClock, Wrench, KeyRound, ShoppingCart, UserCog, Activity, Megaphone, ChevronDown } from "lucide-react";
import type { Property } from "@/lib/db/properties";
import { useAppT } from "@/lib/app-i18n";
import { ToastProvider } from "@/components/app/ui/Toast";
import { ActivePropertyProvider } from "@/lib/active-property";
import PropertySwitcher from "./PropertySwitcher";
import ThemeToggle from "./ThemeToggle";
import LocaleToggle from "./LocaleToggle";
import SignOutButton from "@/app/app/SignOutButton";
import NotesWidget from "@/components/app/NotesWidget";
import AnnouncementBanner from "@/components/app/AnnouncementBanner";

const HOME = { href: "/app", icon: LayoutDashboard, key: "nav.home", exact: true };

// Grouped nav — mirrors hotel-pms's sectioned sidebar.
const NAV_GROUPS = [
  {
    key: "nav.group.frontdesk",
    items: [
      { href: "/app/calendar", icon: CalendarDays, key: "nav.calendar" },
      { href: "/app/bookings", icon: BookOpen, key: "nav.bookings" },
      { href: "/app/guests", icon: Users, key: "nav.guests" },
      { href: "/app/rentals", icon: KeyRound, key: "nav.rentals" },
    ],
  },
  {
    key: "nav.group.operations",
    items: [
      { href: "/app/housekeeping", icon: SprayCan, key: "nav.housekeeping" },
      { href: "/app/shifts", icon: CalendarClock, key: "nav.shifts" },
      { href: "/app/maintenance", icon: Wrench, key: "nav.maintenance" },
    ],
  },
  {
    key: "nav.group.pricing",
    items: [
      { href: "/app/rooms", icon: BedDouble, key: "nav.rooms" },
      { href: "/app/rate-plans", icon: Tag, key: "nav.ratePlans" },
    ],
  },
  {
    key: "nav.group.sales",
    items: [
      { href: "/app/pos", icon: ShoppingCart, key: "nav.pos" },
      { href: "/app/invoices", icon: Receipt, key: "nav.invoices" },
      { href: "/app/reports", icon: BarChart3, key: "nav.reports" },
    ],
  },
  {
    key: "nav.group.admin",
    items: [
      { href: "/app/team", icon: UserCog, key: "nav.team" },
      { href: "/app/announcements", icon: Megaphone, key: "nav.announcements" },
      { href: "/app/activity", icon: Activity, key: "nav.activity" },
      { href: "/app/settings", icon: Settings, key: "nav.settings" },
    ],
  },
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
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setDrawer(false);
    setOpenGroup(null);
  }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);
  // Close any open desktop dropdown on outside-click / Escape.
  useEffect(() => {
    if (!openGroup) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenGroup(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openGroup]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const groupActive = (items: { href: string }[]) => items.some((i) => isActive(i.href));

  const linkCls = (on: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      on
        ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
        : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)]"
    }`;

  // Mobile drawer: Overview + grouped sections.
  const drawerNav = (
    <nav className="flex flex-col gap-1 overflow-y-auto p-3">
      <Link href={HOME.href} className={linkCls(isActive(HOME.href, HOME.exact))}>
        <HOME.icon size={18} /> {t(HOME.key)}
      </Link>
      {NAV_GROUPS.map((g) => (
        <div key={g.key} className="mt-3">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--app-fg-muted)] opacity-70">
            {t(g.key)}
          </div>
          {g.items.map(({ href, icon: Icon, key }) => (
            <Link key={href} href={href} className={linkCls(isActive(href))}>
              <Icon size={18} /> {t(key)}
            </Link>
          ))}
        </div>
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
          <div className="app-mesh" aria-hidden>
            <i /><i /><i /><i />
          </div>

          {/* Top bar */}
          <header className="relative z-30 flex h-14 flex-none items-center gap-2 border-b border-[var(--app-border)] px-3 md:px-4">
            <button className="lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>
            <div className="flex min-w-0 flex-none items-center gap-2 pr-1">
              <div className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-[var(--app-accent)] text-[var(--app-accent-fg)]">
                <Building2 size={16} />
              </div>
              <PropertySwitcher />
            </div>

            {/* Desktop grouped nav — Overview link + dropdown per group */}
            <nav ref={navRef} className="relative hidden min-w-0 items-center gap-0.5 lg:flex">
              <Link
                href={HOME.href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                  isActive(HOME.href, HOME.exact)
                    ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                    : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)]"
                }`}
              >
                <HOME.icon size={15} /> {t(HOME.key)}
              </Link>

              {NAV_GROUPS.map((g) => {
                const gActive = groupActive(g.items);
                const open = openGroup === g.key;
                return (
                  <div key={g.key} className="relative">
                    <button
                      onClick={() => setOpenGroup(open ? null : g.key)}
                      aria-expanded={open}
                      className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                        gActive || open
                          ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                          : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)]"
                      }`}
                    >
                      {t(g.key)}
                      <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <div className="app-surface absolute left-0 top-[calc(100%+6px)] z-30 min-w-[200px] rounded-xl border border-[var(--app-border)] p-1.5 shadow-xl">
                        {g.items.map(({ href, icon: Icon, key }) => {
                          const on = isActive(href);
                          return (
                            <Link
                              key={href}
                              href={href}
                              onClick={() => setOpenGroup(null)}
                              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                                on
                                  ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                                  : "text-[var(--app-fg)] hover:bg-[var(--app-surface-2)]"
                              }`}
                            >
                              <Icon size={16} /> {t(key)}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
              <aside className="app-surface absolute left-0 top-0 flex h-full w-64 flex-col border-r border-[var(--app-border)]">
                <div className="flex h-14 flex-none items-center justify-between gap-2 px-5">
                  <span className="truncate text-base font-semibold">{property.name}</span>
                  <button onClick={() => setDrawer(false)} aria-label="Close menu" className="flex-none">
                    <X size={20} />
                  </button>
                </div>
                {drawerNav}
              </aside>
            </div>
          )}

          {/* Pinned announcements — sticky banner above the page content. */}
          <AnnouncementBanner />

          {/* Content */}
          <main className="relative z-10 min-w-0 flex-1 overflow-x-hidden p-3 md:px-5 md:py-5">{children}</main>

          {/* Floating team-notes launcher (bottom-right on every page). */}
          <NotesWidget />
        </div>
      </ToastProvider>
    </ActivePropertyProvider>
  );
}
