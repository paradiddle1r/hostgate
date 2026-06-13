"use client";

// Revenue / bookings / occupancy / channel-mix report for the active property.
// All aggregation happens server-side (app/app/reports/page.tsx); this is a pure
// renderer. Charts are hand-built (SVG/CSS) — recharts is not a HostGate dep.
// Local TH+EN strings (like BookingsClient) so we stay out of app-i18n.ts.

import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  CalendarCheck,
  BarChart3,
  BedDouble,
  Banknote,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import EmptyState from "@/components/app/ui/EmptyState";
import RangeSelector from "./RangeSelector";

export interface MonthRow {
  month: string; // 'YYYY-MM'
  priorMonth: string;
  revenue: number;
  priorRevenue: number;
  bookings: number;
  priorBookings: number;
  nights: number;
  occupancy: number; // 0..1
  priorOccupancy: number;
  channel: Record<string, number>; // label → revenue
}

export interface Kpis {
  revenue: number;
  priorRevenue: number;
  bookings: number;
  priorBookings: number;
  occupancy: number; // 0..1
  priorOccupancy: number;
  outstanding: number;
}

export interface ChannelSlice {
  label: string;
  revenue: number;
}

const STR = {
  th: {
    title: "รายงาน",
    subtitlePrefix: "เทียบกับช่วงก่อนหน้า",
    revenue: "รายได้",
    bookings: "การจอง",
    occupancy: "อัตราเข้าพักเฉลี่ย",
    outstanding: "ค้างชำระ",
    vsPrior: "เทียบช่วงก่อน",
    noDelta: "ไม่มีข้อมูลเทียบ",
    new: "ใหม่",
    tabRevenue: "รายได้",
    tabBookings: "การจอง",
    tabOccupancy: "อัตราเข้าพัก",
    tabChannel: "ช่องทางการขาย",
    chartRevenue: "รายได้รายเดือน",
    chartRevenueSub: "แท่งคู่: ปัจจุบัน (สี) เทียบช่วงก่อน (เทา)",
    chartBookings: "จำนวนการจองรายเดือน",
    chartBookingsSub: "นับการจองตามเดือนที่เช็คอิน",
    chartOccupancy: "อัตราเข้าพักรายเดือน",
    chartOccupancySub: "คืนห้องมาตรฐานที่ขายได้ ÷ (ห้อง × วัน)",
    chartChannel: "สัดส่วนช่องทางการขาย",
    chartChannelSub: "แบ่งรายได้ตามช่องทาง (ทั้งช่วง)",
    current: "ปัจจุบัน",
    prior: "ช่วงก่อน",
    detail: "รายละเอียดรายเดือน",
    detailSub: "ข้อมูลเดียวกับกราฟ ในรูปแบบตาราง",
    month: "เดือน",
    months: "เดือน",
    nights: "คืน",
    delta: "เปลี่ยนแปลง",
    noData: "ยังไม่มีข้อมูลในช่วงนี้",
    noDataHint: "ลองเลือกช่วงเวลาอื่น หรือเมื่อมีการจอง รายงานจะปรากฏที่นี่",
  },
  en: {
    title: "Reports",
    subtitlePrefix: "compared to the prior period",
    revenue: "Revenue",
    bookings: "Bookings",
    occupancy: "Avg occupancy",
    outstanding: "Outstanding",
    vsPrior: "vs prior period",
    noDelta: "no prior data",
    new: "new",
    tabRevenue: "Revenue",
    tabBookings: "Bookings",
    tabOccupancy: "Occupancy",
    tabChannel: "Channel mix",
    chartRevenue: "Monthly revenue",
    chartRevenueSub: "Paired bars: current (colour) vs prior period (grey).",
    chartBookings: "Monthly bookings",
    chartBookingsSub: "Bookings counted by check-in month.",
    chartOccupancy: "Monthly occupancy",
    chartOccupancySub: "Standard room-nights sold ÷ (rooms × days).",
    chartChannel: "Channel mix — revenue by source",
    chartChannelSub: "Revenue split by booking source (whole window).",
    current: "Current",
    prior: "Prior",
    detail: "Monthly detail",
    detailSub: "Same data as the chart, in table form.",
    month: "Month",
    months: "months",
    nights: "Nights",
    delta: "Δ",
    noData: "No data in this range yet",
    noDataHint: "Try a different range, or once you have bookings your report appears here.",
  },
} as const;

type Strings = (typeof STR)[keyof typeof STR];

const MONTH_NAMES = {
  th: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
} as const;

// Stable palette for channel labels; anything else cycles the fallback set.
const CHANNEL_COLORS: Record<string, string> = {
  Agoda: "#f59e0b",
  "Booking.com": "#3b82f6",
  Booking: "#3b82f6",
  Expedia: "#fbbf24",
  "Trip.com": "#06b6d4",
  Trip: "#06b6d4",
  Traveloka: "#a855f7",
  Direct: "#10b981",
  "Direct booking": "#10b981",
  OTA: "#f59e0b",
  Web: "#6366f1",
  "Walk-in": "#14b8a6",
};
const FALLBACK_COLORS = ["#6b7280", "#8b5cf6", "#ec4899", "#0ea5e9", "#84cc16", "#f97316"];

function colorFor(label: string, idx: number): string {
  return CHANNEL_COLORS[label] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function pctChange(curr: number, prior: number): number {
  if (!prior) return curr > 0 ? Infinity : 0;
  return (curr - prior) / prior;
}

type Tab = "revenue" | "bookings" | "occupancy" | "channel";

export default function ReportsClient({
  summary,
  kpis,
  channelMix,
  channelLabels,
  currency,
  selectedRange,
  monthsCount,
  currentRange,
  priorRange,
}: {
  summary: MonthRow[];
  kpis: Kpis;
  channelMix: ChannelSlice[];
  channelLabels: string[];
  currency: string;
  selectedRange: { from: string; to: string };
  monthsCount: number;
  currentRange: { start: string; end: string };
  priorRange: { start: string; end: string };
}) {
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "th";
  const tr = STR[lang];
  const numLocale = lang === "en" ? "en-US" : "th-TH";

  const [tab, setTab] = useState<Tab>("revenue");

  const money = (n: number) => `${currency} ${Math.round(n).toLocaleString(numLocale)}`;
  const moneyShort = (n: number) => {
    if (Math.abs(n) >= 1000) return `${currency} ${(n / 1000).toFixed(0)}k`;
    return `${currency} ${Math.round(n)}`;
  };
  const fmtPct = (n: number, digits = 1) =>
    !isFinite(n) ? "—" : `${(n * 100).toFixed(digits)}%`;
  const num = (n: number) => n.toLocaleString(numLocale);

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const idx = Number(m) - 1;
    const name = MONTH_NAMES[lang][idx] ?? key;
    const multiYear = summary.length > 0 && summary[0].month.slice(0, 4) !== summary[summary.length - 1].month.slice(0, 4);
    return multiYear ? `${name} '${y.slice(2)}` : name;
  };

  const hasData =
    kpis.revenue > 0 || kpis.bookings > 0 || summary.some((r) => r.revenue > 0 || r.bookings > 0);

  const channelTotal = channelMix.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <p className="mt-1 text-sm text-[var(--app-fg-muted)]">
          {monthsCount} {monthsCount === 1 ? tr.month : tr.months} ({currentRange.start} → {currentRange.end}){" "}
          {tr.subtitlePrefix} ({priorRange.start} → {priorRange.end}).
        </p>
      </div>

      {/* Range selector — always visible so an empty window is recoverable. */}
      <RangeSelector selectedRange={selectedRange} monthsCount={monthsCount} />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Banknote size={18} />}
          label={tr.revenue}
          value={money(kpis.revenue)}
          curr={kpis.revenue}
          prior={kpis.priorRevenue}
          tr={tr}
        />
        <KpiCard
          icon={<BedDouble size={18} />}
          label={tr.bookings}
          value={num(kpis.bookings)}
          curr={kpis.bookings}
          prior={kpis.priorBookings}
          tr={tr}
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label={tr.occupancy}
          value={fmtPct(kpis.occupancy, 1)}
          curr={kpis.occupancy}
          prior={kpis.priorOccupancy}
          tr={tr}
        />
        <KpiCard
          icon={<Wallet size={18} />}
          label={tr.outstanding}
          value={money(kpis.outstanding)}
          tr={tr}
        />
      </div>

      {!hasData ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState icon={<BarChart3 size={22} />} title={tr.noData} hint={tr.noDataHint} />
        </div>
      ) : (
        <>
          {/* Chart tabs */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["revenue", tr.tabRevenue],
                ["bookings", tr.tabBookings],
                ["occupancy", tr.tabOccupancy],
                ["channel", tr.tabChannel],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors duration-150 ${
                  tab === id
                    ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                    : "border-[var(--app-border)] bg-transparent text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "revenue" && (
            <ChartCard title={tr.chartRevenue} subtitle={tr.chartRevenueSub}>
              <PairedBarChart
                rows={summary.map((r) => ({
                  label: monthLabel(r.month),
                  curr: r.revenue,
                  prior: r.priorRevenue,
                }))}
                fmt={moneyShort}
                fmtFull={money}
                currLabel={tr.current}
                priorLabel={tr.prior}
              />
            </ChartCard>
          )}

          {tab === "bookings" && (
            <ChartCard title={tr.chartBookings} subtitle={tr.chartBookingsSub}>
              <PairedBarChart
                rows={summary.map((r) => ({
                  label: monthLabel(r.month),
                  curr: r.bookings,
                  prior: r.priorBookings,
                }))}
                fmt={(n) => num(Math.round(n))}
                fmtFull={(n) => num(Math.round(n))}
                currLabel={tr.current}
                priorLabel={tr.prior}
              />
            </ChartCard>
          )}

          {tab === "occupancy" && (
            <ChartCard title={tr.chartOccupancy} subtitle={tr.chartOccupancySub}>
              <OccupancyChart
                rows={summary.map((r) => ({
                  label: monthLabel(r.month),
                  curr: r.occupancy,
                  prior: r.priorOccupancy,
                }))}
                currLabel={tr.current}
                priorLabel={tr.prior}
              />
            </ChartCard>
          )}

          {tab === "channel" && (
            <ChartCard title={tr.chartChannel} subtitle={tr.chartChannelSub}>
              <ChannelMixChart
                rows={summary.map((r) => ({ label: monthLabel(r.month), channel: r.channel }))}
                channelLabels={channelLabels}
                mix={channelMix}
                total={channelTotal}
                money={money}
                moneyShort={moneyShort}
                fmtPct={fmtPct}
              />
            </ChartCard>
          )}

          {/* Monthly detail table */}
          <section className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
            <div className="border-b border-[var(--app-border)] p-4">
              <h2 className="font-semibold">{tr.detail}</h2>
              <p className="mt-0.5 text-xs text-[var(--app-fg-muted)]">{tr.detailSub}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                  <th className="px-4 py-2.5 font-medium">{tr.month}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr.revenue}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr.delta}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr.bookings}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr.occupancy}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{tr.nights}</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((r) => {
                  const d = pctChange(r.revenue, r.priorRevenue);
                  const up = d > 0;
                  return (
                    <tr
                      key={r.month}
                      className="border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                    >
                      <td className="px-4 py-2.5 font-medium">{monthLabel(r.month)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">{money(r.revenue)}</td>
                      <td
                        className="px-4 py-2.5 text-right whitespace-nowrap"
                        style={{
                          color: isFinite(d)
                            ? up
                              ? "var(--app-success, #10b981)"
                              : d < 0
                                ? "var(--app-danger, #ef4444)"
                                : "var(--app-fg-muted)"
                            : "var(--app-fg-muted)",
                        }}
                      >
                        {isFinite(d) ? `${up ? "+" : ""}${fmtPct(d, 1)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">{num(r.bookings)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtPct(r.occupancy, 0)}</td>
                      <td className="px-4 py-2.5 text-right">{num(r.nights)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

// ─── KPI card with prior-period delta ───────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  curr,
  prior,
  tr,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  curr?: number;
  prior?: number;
  tr: Strings;
}) {
  const showDelta = curr !== undefined && prior !== undefined;
  return (
    <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
      <div className="mb-2 flex items-center gap-2 text-[var(--app-accent)]">
        {icon}
        <span className="text-xs font-medium text-[var(--app-fg-muted)]">{label}</span>
      </div>
      <p className="text-xl font-semibold tracking-tight">{value}</p>
      {showDelta && (
        <div className="mt-1.5 flex items-center gap-2">
          <DeltaBadge curr={curr!} prior={prior!} newLabel={tr.new} />
          <span className="text-[11px] text-[var(--app-fg-muted)]">{tr.vsPrior}</span>
        </div>
      )}
    </div>
  );
}

function DeltaBadge({ curr, prior, newLabel }: { curr: number; prior: number; newLabel: string }) {
  const delta = pctChange(curr, prior);
  const same = curr === prior;
  const up = delta > 0;
  const Icon = same ? Minus : up ? TrendingUp : TrendingDown;
  const text = !isFinite(delta) ? newLabel : `${(Math.abs(delta) * 100).toFixed(1)}%`;
  const cls = same
    ? "bg-[var(--app-surface-2)] text-[var(--app-fg-muted)]"
    : up
      ? "bg-[rgba(16,185,129,0.12)] text-[#10b981]"
      : "bg-[rgba(239,68,68,0.12)] text-[#ef4444]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <Icon size={12} />
      {text}
    </span>
  );
}

// ─── Chart card wrapper ─────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 mb-4 text-xs text-[var(--app-fg-muted)]">{subtitle}</p>}
      {children}
    </section>
  );
}

// ─── Paired bar chart (current vs prior), pure CSS ──────────────────────────

function PairedBarChart({
  rows,
  fmt,
  fmtFull,
  currLabel,
  priorLabel,
}: {
  rows: { label: string; curr: number; prior: number }[];
  fmt: (n: number) => string;
  fmtFull: (n: number) => string;
  currLabel: string;
  priorLabel: string;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.curr, r.prior)));
  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height: 240 }}>
        {rows.map((r) => {
          const cPct = (r.curr / max) * 100;
          const pPct = (r.prior / max) * 100;
          return (
            <div key={r.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div className="flex w-full flex-1 items-end justify-center gap-[3px]">
                <div
                  className="w-1/2 rounded-t bg-[var(--app-fg-muted)] opacity-50 transition-[height] duration-300"
                  style={{ height: `${Math.max(pPct, r.prior > 0 ? 2 : 0)}%` }}
                  title={`${priorLabel} · ${fmtFull(r.prior)}`}
                />
                <div
                  className="w-1/2 rounded-t bg-[var(--app-accent)] transition-[height] duration-300"
                  style={{ height: `${Math.max(cPct, r.curr > 0 ? 2 : 0)}%` }}
                  title={`${currLabel} · ${fmtFull(r.curr)}`}
                />
              </div>
              <span className="text-[11px] text-[var(--app-fg-muted)]">{r.label}</span>
            </div>
          );
        })}
      </div>
      <Legend
        items={[
          { label: currLabel, color: "var(--app-accent)" },
          { label: priorLabel, color: "var(--app-fg-muted)", opacity: 0.5 },
        ]}
      />
    </div>
  );
}

// ─── Occupancy chart (current vs prior) — SVG line chart ────────────────────

function OccupancyChart({
  rows,
  currLabel,
  priorLabel,
}: {
  rows: { label: string; curr: number; prior: number }[];
  currLabel: string;
  priorLabel: string;
}) {
  const W = 720;
  const H = 240;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = rows.length;
  const x = (i: number) => (n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW);
  const y = (v: number) => padT + (1 - Math.min(1, Math.max(0, v))) * innerH;

  const path = (key: "curr" | "prior") =>
    rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(" ");

  const gridY = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 240 }}>
        {gridY.map((g) => (
          <g key={g}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(g)}
              y2={y(g)}
              stroke="var(--app-border)"
              strokeDasharray="3 3"
            />
            <text x={4} y={y(g) + 4} fontSize={11} fill="var(--app-fg-muted)">
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        {/* Prior line */}
        <polyline
          points={rows.map((r, i) => `${x(i)},${y(r.prior)}`).join(" ")}
          fill="none"
          stroke="var(--app-fg-muted)"
          strokeOpacity={0.55}
          strokeWidth={2}
        />
        {/* Current line */}
        <path d={path("curr")} fill="none" stroke="var(--app-accent)" strokeWidth={2.5} />
        {rows.map((r, i) => (
          <circle key={`c${i}`} cx={x(i)} cy={y(r.curr)} r={3} fill="var(--app-accent)">
            <title>{`${r.label} · ${(r.curr * 100).toFixed(1)}%`}</title>
          </circle>
        ))}
        {rows.map((r, i) => (
          <text key={`l${i}`} x={x(i)} y={H - 8} fontSize={11} fill="var(--app-fg-muted)" textAnchor="middle">
            {r.label}
          </text>
        ))}
      </svg>
      <Legend
        items={[
          { label: currLabel, color: "var(--app-accent)" },
          { label: priorLabel, color: "var(--app-fg-muted)", opacity: 0.55 },
        ]}
      />
    </div>
  );
}

// ─── Channel-mix: stacked monthly bars + a per-channel total legend ─────────

function ChannelMixChart({
  rows,
  channelLabels,
  mix,
  total,
  money,
  moneyShort,
  fmtPct,
}: {
  rows: { label: string; channel: Record<string, number> }[];
  channelLabels: string[];
  mix: ChannelSlice[];
  total: number;
  money: (n: number) => string;
  moneyShort: (n: number) => string;
  fmtPct: (n: number, d?: number) => string;
}) {
  const max = Math.max(
    1,
    ...rows.map((r) => channelLabels.reduce((s, k) => s + (r.channel[k] || 0), 0))
  );
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 sm:gap-3" style={{ height: 240 }}>
        {rows.map((r) => {
          const monthTotal = channelLabels.reduce((s, k) => s + (r.channel[k] || 0), 0);
          const hPct = (monthTotal / max) * 100;
          return (
            <div key={r.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div className="flex w-full flex-1 items-end justify-center">
                <div
                  className="flex w-2/3 flex-col-reverse overflow-hidden rounded-t"
                  style={{ height: `${Math.max(hPct, monthTotal > 0 ? 2 : 0)}%` }}
                  title={`${r.label} · ${money(monthTotal)}`}
                >
                  {channelLabels.map((k, idx) => {
                    const v = r.channel[k] || 0;
                    if (v <= 0 || monthTotal <= 0) return null;
                    return (
                      <div
                        key={k}
                        style={{
                          height: `${(v / monthTotal) * 100}%`,
                          background: colorFor(k, idx),
                        }}
                        title={`${k} · ${money(v)}`}
                      />
                    );
                  })}
                </div>
              </div>
              <span className="text-[11px] text-[var(--app-fg-muted)]">{r.label}</span>
            </div>
          );
        })}
      </div>

      {/* Per-channel window totals */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {mix.map((c, idx) => {
          const share = total > 0 ? c.revenue / total : 0;
          return (
            <div
              key={c.label}
              className="flex items-center gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ background: colorFor(c.label, idx) }}
              />
              <span className="text-sm font-medium">{c.label}</span>
              <span className="ml-auto text-sm whitespace-nowrap">{moneyShort(c.revenue)}</span>
              <span className="w-12 text-right text-xs text-[var(--app-fg-muted)]">
                {fmtPct(share, 0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tiny shared legend ─────────────────────────────────────────────────────

function Legend({ items }: { items: { label: string; color: string; opacity?: number }[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-[var(--app-fg-muted)]">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ background: it.color, opacity: it.opacity ?? 1 }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
