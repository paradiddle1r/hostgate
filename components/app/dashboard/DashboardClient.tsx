"use client";

import Link from "next/link";
import {
  CalendarDays,
  LogIn,
  LogOut,
  BedDouble,
  Users,
  Receipt,
  SprayCan,
  TrendingUp,
  ArrowRight,
  Plus,
} from "lucide-react";
import { useAppT } from "@/lib/app-i18n";
import { useI18n } from "@/lib/i18n";

export type DashKpis = {
  total: number;
  occupied: number;
  available: number;
  occPct: number;
  arrivals: number;
  departures: number;
  inHouse: number;
  monthRevenue: number;
  monthBookings: number;
  outstanding: number;
  outstandingCount: number;
  openTasks: number;
};

export type DashRow = {
  id: string;
  guest_name: string;
  room: string;
  check_in: string;
  check_out: string;
  is_open_ended: boolean;
};

export default function DashboardClient({
  propertyName,
  currency,
  today,
  kpis,
  arrivals,
  departures,
  upcoming,
}: {
  propertyName: string;
  currency: string;
  today: string;
  kpis: DashKpis;
  arrivals: DashRow[];
  departures: DashRow[];
  upcoming: DashRow[];
}) {
  const t = useAppT();
  const { locale } = useI18n();
  const money = (n: number) =>
    `${currency} ${Math.round(n).toLocaleString(locale === "en" ? "en-US" : "th-TH")}`;
  const dateLabel = new Date(today + "T00:00:00Z").toLocaleDateString(
    locale === "en" ? "en-US" : "th-TH",
    { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" },
  );

  return (
    <div className="mx-auto w-full max-w-[1700px]">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{propertyName}</h1>
          <p className="mt-0.5 text-sm text-[var(--app-fg-muted)]">{dateLabel}</p>
        </div>
        <Link
          href="/app/calendar"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-[var(--app-accent-fg)] transition hover:opacity-90"
        >
          <Plus size={16} /> {t("dash.newBooking")}
        </Link>
      </div>

      {/* Hero: occupancy + revenue */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {/* Occupancy ring-ish */}
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--app-fg-muted)]">{t("dash.occupancyToday")}</span>
            <BedDouble size={18} className="text-[var(--app-fg-muted)]" />
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold leading-none">{kpis.occPct}%</span>
            <span className="pb-1 text-sm text-[var(--app-fg-muted)]">
              {kpis.occupied}/{kpis.total} {t("dash.rooms")}
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[var(--app-surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--app-accent)] transition-all"
              style={{ width: `${kpis.occPct}%` }}
            />
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-[var(--app-success)]">{kpis.available}</span>
            <span className="text-[var(--app-fg-muted)]">{t("dash.roomsFree")}</span>
          </div>
        </div>

        {/* Revenue this month */}
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--app-fg-muted)]">{t("dash.revenueMonth")}</span>
            <TrendingUp size={18} className="text-[var(--app-fg-muted)]" />
          </div>
          <div className="mt-2 text-3xl font-bold leading-none">{money(kpis.monthRevenue)}</div>
          <div className="mt-2 text-sm text-[var(--app-fg-muted)]">
            {kpis.monthBookings} {t("dash.bookingsThisMonth")}
          </div>
        </div>

        {/* Outstanding */}
        <Link
          href="/app/invoices"
          className="app-surface group rounded-2xl border border-[var(--app-border)] p-5 transition hover:border-[var(--app-accent)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--app-fg-muted)]">{t("dash.outstanding")}</span>
            <Receipt size={18} className="text-[var(--app-fg-muted)]" />
          </div>
          <div className="mt-2 text-3xl font-bold leading-none">{money(kpis.outstanding)}</div>
          <div className="mt-2 flex items-center gap-1 text-sm text-[var(--app-fg-muted)]">
            {kpis.outstandingCount} {t("dash.unpaidInvoices")}
            <ArrowRight size={13} className="opacity-0 transition group-hover:opacity-100" />
          </div>
        </Link>
      </div>

      {/* Quick stats row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={LogIn} label={t("dash.arrivals")} value={kpis.arrivals} href="/app/calendar" accent="var(--app-success)" />
        <Stat icon={LogOut} label={t("dash.departures")} value={kpis.departures} href="/app/calendar" accent="#d97706" />
        <Stat icon={Users} label={t("dash.inHouse")} value={kpis.inHouse} href="/app/bookings" />
        <Stat icon={SprayCan} label={t("dash.openTasks")} value={kpis.openTasks} href="/app/housekeeping" accent={kpis.openTasks ? "var(--app-danger)" : undefined} />
      </div>

      {/* Lists */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ListCard title={t("dash.arrivalsToday")} icon={LogIn} rows={arrivals} empty={t("dash.noneToday")} />
        <ListCard title={t("dash.departuresToday")} icon={LogOut} rows={departures} empty={t("dash.noneToday")} />
        <ListCard title={t("dash.upcoming")} icon={CalendarDays} rows={upcoming} empty={t("dash.noneSoon")} showDate />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  href,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  href: string;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className="app-surface flex items-center gap-3 rounded-2xl border border-[var(--app-border)] p-4 transition hover:border-[var(--app-accent)]"
    >
      <span
        className="grid h-10 w-10 flex-none place-items-center rounded-xl"
        style={{ background: `${accent ?? "var(--app-accent)"}1f`, color: accent ?? "var(--app-accent)" }}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="mt-1 truncate text-xs text-[var(--app-fg-muted)]">{label}</div>
      </div>
    </Link>
  );
}

function ListCard({
  title,
  icon: Icon,
  rows,
  empty,
  showDate = false,
}: {
  title: string;
  icon: typeof Users;
  rows: DashRow[];
  empty: string;
  showDate?: boolean;
}) {
  return (
    <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon size={16} className="text-[var(--app-fg-muted)]" />
        {title}
        <span className="ml-auto rounded-full bg-[var(--app-surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--app-fg-muted)]">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--app-fg-muted)]">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--app-border)]">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="grid h-7 w-9 flex-none place-items-center rounded-lg bg-[var(--app-surface-2)] text-xs font-semibold">
                {r.room}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{r.guest_name}</span>
              {showDate && (
                <span className="flex-none text-xs text-[var(--app-fg-muted)]">
                  {r.check_in.slice(5)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
