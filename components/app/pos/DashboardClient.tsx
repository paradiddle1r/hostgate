"use client";

// Mini-bar POS dashboard. KPI cards (revenue + sales, today + 30 days), a
// hand-built 7-day revenue bar chart (inline SVG, no chart library — HostGate
// doesn't ship recharts), and a top-products table. All figures exclude voided
// sales. Data arrives once via server props; everything below is in-memory.

import { useMemo } from "react";
import { TrendingUp, ShoppingBag, BarChart3, Trophy } from "lucide-react";
import type { PosSale, PosSaleItem } from "@/lib/db/pos";
import { useI18n } from "@/lib/i18n";
import EmptyState from "@/components/app/ui/EmptyState";

const STR = {
  th: {
    title: "แดชบอร์ด",
    sub: "ภาพรวม 30 วันล่าสุด",
    revenueToday: "รายได้วันนี้",
    salesToday: "ยอดขายวันนี้",
    revenue30: "รายได้ · 30 วัน",
    sales30: "ยอดขาย · 30 วัน",
    last7: "7 วันล่าสุด",
    topSellers: "สินค้าขายดี",
    product: "สินค้า",
    qtySold: "จำนวนที่ขาย",
    revenue: "รายได้",
    noItems: "ยังไม่มีการขายสินค้า",
    noItemsHint: "เมื่อมีการขาย สินค้าขายดีจะแสดงที่นี่",
    sales: "ครั้ง",
  },
  en: {
    title: "Dashboard",
    sub: "Last 30 days overview",
    revenueToday: "Revenue today",
    salesToday: "Sales today",
    revenue30: "Revenue · 30 days",
    sales30: "Sales · 30 days",
    last7: "Last 7 days",
    topSellers: "Top sellers",
    product: "Product",
    qtySold: "Qty sold",
    revenue: "Revenue",
    noItems: "No items sold yet",
    noItemsHint: "Top-selling products will appear here once you ring up sales.",
    sales: "sales",
  },
} as const;

export default function DashboardClient({
  sales,
  items,
  currency,
}: {
  sales: PosSale[];
  items: PosSaleItem[];
  currency: string;
}) {
  const { locale } = useI18n();
  const tr = STR[locale === "en" ? "en" : "th"];
  const money = (n: number) => `${currency} ${(Number(n) || 0).toLocaleString()}`;

  const validSales = useMemo(() => sales.filter((s) => !s.voided), [sales]);

  const { todayRevenue, todayCount } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    let rev = 0;
    let count = 0;
    for (const s of validSales) {
      if (new Date(s.created_at) >= start) {
        rev += Number(s.total) || 0;
        count += 1;
      }
    }
    return { todayRevenue: rev, todayCount: count };
  }, [validSales]);

  const totalRevenue = useMemo(
    () => validSales.reduce((a, s) => a + (Number(s.total) || 0), 0),
    [validSales],
  );

  const last7 = useMemo(() => {
    const days: { label: string; revenue: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const label = d.toLocaleDateString(locale === "en" ? "en-US" : "th-TH", {
        weekday: "short",
        day: "numeric",
      });
      let revenue = 0;
      let count = 0;
      for (const s of validSales) {
        const t = new Date(s.created_at);
        if (t >= d && t < next) {
          revenue += Number(s.total) || 0;
          count += 1;
        }
      }
      days.push({ label, revenue, count });
    }
    return days;
  }, [validSales, locale]);

  const topItems = useMemo(() => {
    const validIds = new Set(validSales.map((s) => s.id));
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of items) {
      if (!validIds.has(it.sale_id)) continue;
      const key = it.product_id || it.name;
      const cur = map.get(key) || { name: it.name, qty: 0, revenue: 0 };
      cur.qty += Number(it.qty) || 0;
      cur.revenue += Number(it.line_total) || 0;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [items, validSales]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <p className="text-sm text-[var(--app-fg-muted)]">{tr.sub}</p>
      </div>

      <div className="space-y-5">
        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={<TrendingUp size={16} />}
            label={tr.revenueToday}
            value={money(todayRevenue)}
          />
          <Stat
            icon={<ShoppingBag size={16} />}
            label={tr.salesToday}
            value={String(todayCount)}
          />
          <Stat
            icon={<TrendingUp size={16} />}
            label={tr.revenue30}
            value={money(totalRevenue)}
          />
          <Stat
            icon={<ShoppingBag size={16} />}
            label={tr.sales30}
            value={String(validSales.length)}
          />
        </div>

        {/* 7-day revenue chart */}
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <BarChart3 size={16} /> {tr.last7}
          </h2>
          <BarChart days={last7} money={money} />
        </div>

        {/* Top sellers */}
        <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
          <div className="border-b border-[var(--app-border)] px-5 py-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <Trophy size={16} /> {tr.topSellers}
            </h2>
          </div>
          {topItems.length === 0 ? (
            <EmptyState
              icon={<Trophy size={22} />}
              title={tr.noItems}
              hint={tr.noItemsHint}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--app-border)] text-left text-xs font-medium text-[var(--app-fg-muted)]">
                    <th className="px-5 py-2 font-medium">{tr.product}</th>
                    <th className="px-3 py-2 text-right font-medium">{tr.qtySold}</th>
                    <th className="px-5 py-2 text-right font-medium">{tr.revenue}</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((p) => (
                    <tr
                      key={p.name}
                      className="border-b border-[var(--app-border)] last:border-0"
                    >
                      <td className="px-5 py-2.5 font-medium">{p.name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.qty}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {money(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="app-surface rounded-2xl border border-[var(--app-border)] px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--app-fg)]">
        {value}
      </div>
    </div>
  );
}

// Hand-built bar chart — inline SVG, no chart library. Bars scale to the max
// revenue day; an all-zero week renders flat bars with a baseline.
function BarChart({
  days,
  money,
}: {
  days: { label: string; revenue: number; count: number }[];
  money: (n: number) => string;
}) {
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const W = 700;
  const H = 220;
  const padX = 8;
  const padTop = 16;
  const padBottom = 28;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const slot = innerW / days.length;
  const barW = Math.min(56, slot * 0.6);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full min-w-[480px]"
        role="img"
        aria-label="7-day revenue"
      >
        {/* baseline */}
        <line
          x1={padX}
          y1={padTop + innerH}
          x2={W - padX}
          y2={padTop + innerH}
          stroke="var(--app-border)"
          strokeWidth={1}
        />
        {days.map((d, i) => {
          const h = d.revenue > 0 ? (d.revenue / max) * innerH : 0;
          const x = padX + i * slot + (slot - barW) / 2;
          const y = padTop + innerH - h;
          return (
            <g key={i}>
              {d.revenue > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-[var(--app-fg-muted)]"
                  style={{ fontSize: 10 }}
                >
                  {money(d.revenue)}
                </text>
              )}
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 2)}
                rx={4}
                fill="var(--app-accent)"
                opacity={d.revenue > 0 ? 1 : 0.25}
              >
                <title>{`${d.label}: ${money(d.revenue)} · ${d.count}`}</title>
              </rect>
              <text
                x={x + barW / 2}
                y={H - 8}
                textAnchor="middle"
                className="fill-[var(--app-fg-muted)]"
                style={{ fontSize: 11 }}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
