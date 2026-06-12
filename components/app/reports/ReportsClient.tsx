"use client";

// Revenue & occupancy report for the active property. All aggregation happens
// server-side (app/app/reports/page.tsx); this component is pure presentation:
// KPI cards, a CSS bar chart of revenue by month, and a small monthly table.
// Local TH+EN strings (like BookingsClient) so we stay out of app-i18n.ts.

import { TrendingUp, Wallet, CalendarCheck, BarChart3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import EmptyState from "@/components/app/ui/EmptyState";

export interface MonthRow {
  month: string; // 'YYYY-MM'
  revenue: number;
  bookings: number;
  nights: number;
}

export interface Kpis {
  totalRevenue: number;
  outstanding: number;
  bookings: number;
  inHouseToday: number;
}

const STR = {
  th: {
    title: "รายงาน",
    subtitle: "ภาพรวมรายได้ 6 เดือนล่าสุด",
    revenue: "รายได้รวม",
    outstanding: "ค้างชำระ",
    bookings: "การจอง",
    inHouse: "เข้าพักวันนี้",
    chartTitle: "รายได้รายเดือน",
    month: "เดือน",
    nights: "คืน",
    noData: "ยังไม่มีข้อมูลรายงาน",
    noDataHint: "เมื่อมีการจองและออกใบแจ้งหนี้ รายงานจะปรากฏที่นี่",
  },
  en: {
    title: "Reports",
    subtitle: "Revenue overview for the last 6 months",
    revenue: "Total revenue",
    outstanding: "Outstanding",
    bookings: "Bookings",
    inHouse: "In-house today",
    chartTitle: "Revenue by month",
    month: "Month",
    nights: "Nights",
    noData: "No report data yet",
    noDataHint: "Once you have bookings and invoices, your reports appear here.",
  },
} as const;

const MONTH_NAMES = {
  th: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
} as const;

export default function ReportsClient({
  summary,
  kpis,
  currency,
}: {
  summary: MonthRow[];
  kpis: Kpis;
  currency: string;
}) {
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "th";
  const tr = STR[lang];

  const money = (n: number) =>
    `${currency} ${Math.round(n).toLocaleString(lang === "en" ? "en-US" : "th-TH")}`;

  // 'YYYY-MM' → short label like "May" / "พ.ค." (+ '25 when not the current year).
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const idx = Number(m) - 1;
    const name = MONTH_NAMES[lang][idx] ?? key;
    const thisYear = String(new Date().getFullYear());
    return y === thisYear ? name : `${name} ${y.slice(2)}`;
  };

  const hasData =
    kpis.totalRevenue > 0 ||
    kpis.bookings > 0 ||
    summary.some((r) => r.revenue > 0 || r.bookings > 0);

  const maxRevenue = Math.max(1, ...summary.map((r) => r.revenue));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <p className="mt-1 text-sm text-[var(--app-fg-muted)]">{tr.subtitle}</p>
      </div>

      {!hasData ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState
            icon={<BarChart3 size={22} />}
            title={tr.noData}
            hint={tr.noDataHint}
          />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<TrendingUp size={18} />}
              label={tr.revenue}
              value={money(kpis.totalRevenue)}
            />
            <KpiCard
              icon={<Wallet size={18} />}
              label={tr.outstanding}
              value={money(kpis.outstanding)}
            />
            <KpiCard
              icon={<BarChart3 size={18} />}
              label={tr.bookings}
              value={kpis.bookings.toLocaleString(lang === "en" ? "en-US" : "th-TH")}
            />
            <KpiCard
              icon={<CalendarCheck size={18} />}
              label={tr.inHouse}
              value={kpis.inHouseToday.toLocaleString(lang === "en" ? "en-US" : "th-TH")}
            />
          </div>

          {/* Revenue bar chart (pure CSS) */}
          <section className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
            <h2 className="mb-5 font-semibold">{tr.chartTitle}</h2>
            <div className="flex items-end justify-between gap-2 sm:gap-4" style={{ height: 200 }}>
              {summary.map((row) => {
                const pct = (row.revenue / maxRevenue) * 100;
                return (
                  <div
                    key={row.month}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <span className="text-[11px] font-medium text-[var(--app-fg-muted)]">
                      {row.revenue > 0 ? money(row.revenue) : ""}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-[var(--app-accent)] transition-[height] duration-300"
                        style={{ height: `${Math.max(pct, row.revenue > 0 ? 3 : 0)}%` }}
                        title={`${monthLabel(row.month)} · ${money(row.revenue)}`}
                      />
                    </div>
                    <span className="text-xs text-[var(--app-fg-muted)]">
                      {monthLabel(row.month)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Monthly table */}
          <section className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                  <th className="px-4 py-2.5 font-medium">{tr.month}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr.revenue}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr.bookings}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr.nights}</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr
                    key={row.month}
                    className="border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                  >
                    <td className="px-4 py-2.5 font-medium">{monthLabel(row.month)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {money(row.revenue)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.bookings.toLocaleString(lang === "en" ? "en-US" : "th-TH")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.nights.toLocaleString(lang === "en" ? "en-US" : "th-TH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
      <div className="mb-2 flex items-center gap-2 text-[var(--app-accent)]">
        {icon}
        <span className="text-xs font-medium text-[var(--app-fg-muted)]">{label}</span>
      </div>
      <p className="text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
