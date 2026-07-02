import { getActiveProperty } from "@/lib/active-property-server";
import { listInvoices } from "@/lib/db/invoices";
import { createClient } from "@/lib/supabase/server";
import ReportsClient from "@/components/app/reports/ReportsClient";
import type { MonthRow, Kpis, ChannelSlice } from "@/components/app/reports/ReportsClient";

export const dynamic = "force-dynamic";

// Revenue / bookings / occupancy / channel-mix report for the active property.
//
// Parity with hotel-pms's Reports page: a date-range selector (?from / ?to)
// drives a current window plus an equal-length PRIOR window immediately before
// it, so every KPI and chart can show a period-over-period delta. All charts
// are booking-based (so the headline Revenue reconciles with the monthly bars);
// `Outstanding` is the one invoice-derived card and carries no delta.
//
// Everything is UTC-anchored (Date.UTC / slice(0,7) / T00:00:00Z) to match the
// rest of the app and avoid +07 month-boundary drift.

const MS_PER_DAY = 86_400_000;

// Statuses that count as a realized stay (cancelled excluded everywhere).
const REALIZED: ReadonlySet<string> = new Set([
  "confirmed",
  "checked_in",
  "checked_out",
]);

const OPEN_ENDED = "2099-12-31";

interface RangeParam {
  from: string; // 'YYYY-MM-01'
  to: string; // 'YYYY-MM-01' (first of the LAST month, inclusive)
}

interface MonthMeta {
  key: string; // 'YYYY-MM'
  year: number;
  month: number; // 0-based
  start: number; // ms, first of month
  nextStart: number; // ms, first of next month (exclusive)
  days: number;
}

/** Parse a 'YYYY-MM-DD' query string to a UTC first-of-month, or null. */
function parseYmdToMonth(s: unknown): { year: number; month: number } | null {
  if (typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) return null;
  return { year: y, month: mo };
}

/**
 * Resolve the selected window from search params, snapped to month
 * boundaries. Defaults to the rolling 6 months ending with the current month
 * (the report's behaviour before the range selector existed).
 */
function parseRange(sp: Record<string, string | string[] | undefined>): RangeParam {
  const now = new Date();
  const nowY = now.getUTCFullYear();
  const nowM = now.getUTCMonth();

  const fromParsed = parseYmdToMonth(sp.from);
  const toParsed = parseYmdToMonth(sp.to);

  const defFrom = new Date(Date.UTC(nowY, nowM - 5, 1));
  const defTo = new Date(Date.UTC(nowY, nowM, 1));

  let from = fromParsed ? new Date(Date.UTC(fromParsed.year, fromParsed.month, 1)) : defFrom;
  let to = toParsed ? new Date(Date.UTC(toParsed.year, toParsed.month, 1)) : defTo;
  if (to.getTime() < from.getTime()) to = from;

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** Build month metadata from `startY/startM`, `count` months, oldest first. */
function buildMonths(startY: number, startM: number, count: number): MonthMeta[] {
  const out: MonthMeta[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(startY, startM + i, 1));
    const next = new Date(Date.UTC(startY, startM + i + 1, 1));
    out.push({
      key: d.toISOString().slice(0, 7),
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      start: d.getTime(),
      nextStart: next.getTime(),
      days: Math.round((next.getTime() - d.getTime()) / MS_PER_DAY),
    });
  }
  return out;
}

// Minimal booking row we aggregate over (only the columns we select).
interface BkRow {
  check_in: string | null;
  check_out: string | null;
  total_amount: number | null;
  ota: string | null;
  source: string | null;
  status: string;
  booking_type: string;
}

// A working aggregate per month before we shape it for the client.
interface MonthAgg {
  key: string;
  year: number;
  revenue: number;
  bookings: number;
  nights: number; // standard-only nights (occupancy numerator)
  days: number;
  channel: Map<string, number>; // label → revenue
}

/** Map a booking to its channel-mix label: `ota` when set, else `source`. */
function channelOf(b: BkRow): string {
  const ota = b.ota?.trim();
  if (ota) return ota;
  switch (b.source) {
    case "ota":
      return "OTA";
    case "walk_in":
      return "Walk-in";
    case "web":
      return "Web";
    case "direct":
    default:
      return "Direct";
  }
}

/**
 * Bucket bookings into the given months. Each booking spreads its revenue and
 * nights across every month its stay overlaps (per-night). Cancelled stays are
 * handled by the caller's pre-filter; non-standard booking_types (blocked/oos
 * placeholders) are excluded here so they never count toward revenue,
 * bookings, occupancy nights, or channel totals. Returns one MonthAgg per
 * input month.
 */
function bucket(bookings: BkRow[], months: MonthMeta[]): MonthAgg[] {
  const by = new Map<string, MonthAgg>();
  for (const m of months) {
    by.set(m.key, {
      key: m.key,
      year: m.year,
      revenue: 0,
      bookings: 0,
      nights: 0,
      days: m.days,
      channel: new Map(),
    });
  }

  for (const b of bookings) {
    if (!REALIZED.has(b.status)) continue;
    if (!b.check_in || !b.check_out) continue;
    const ci = Date.parse(b.check_in + "T00:00:00Z");
    // Open-ended monthly leases: clip to now+30d so they don't dominate.
    const co =
      b.check_out === OPEN_ENDED
        ? Date.now() + 30 * MS_PER_DAY
        : Date.parse(b.check_out + "T00:00:00Z");
    if (Number.isNaN(ci) || Number.isNaN(co) || co <= ci) continue;

    const totalNights = Math.max(1, Math.round((co - ci) / MS_PER_DAY));
    const amount = Number(b.total_amount) || 0;
    const perNight = amount / totalNights;
    const isStandard = b.booking_type === "standard";
    const label = channelOf(b);

    for (const m of months) {
      if (co <= m.start || ci >= m.nextStart) continue;
      const overlapStart = ci > m.start ? ci : m.start;
      const overlapEnd = co < m.nextStart ? co : m.nextStart;
      const nights = Math.round((overlapEnd - overlapStart) / MS_PER_DAY);
      if (nights <= 0) continue;

      const slot = by.get(m.key)!;
      const rev = perNight * nights;
      if (!isStandard) continue;
      slot.revenue += rev;
      slot.nights += nights;
      // Count a booking in the month its check-in falls in (no double count).
      if (ci >= m.start && ci < m.nextStart) slot.bookings += 1;
      slot.channel.set(label, (slot.channel.get(label) || 0) + rev);
    }
  }

  return months.map((m) => by.get(m.key)!);
}

function occupancy(agg: MonthAgg, activeRooms: number): number {
  const denom = activeRooms * agg.days;
  return denom > 0 ? agg.nights / denom : 0;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;

  const sp = (await searchParams) ?? {};
  const range = parseRange(sp);

  // Current window months.
  const [fy, fm] = range.from.split("-").map(Number); // fy, fm(1-based)
  const [ty, tm] = range.to.split("-").map(Number);
  const monthsCount = (ty - fy) * 12 + (tm - fm) + 1;

  const currMonths = buildMonths(fy, fm - 1, monthsCount);
  // Prior window: same length, immediately before `from`.
  const priorStartM = fm - 1 - monthsCount;
  const priorMonths = buildMonths(fy, priorStartM, monthsCount);

  // Fetch every booking whose check-in falls anywhere in the 2× window, plus
  // active room count + invoices (Outstanding). Inline, property-scoped query.
  const supabase = createClient();
  const windowStart = priorMonths[0].key + "-01";
  const windowEnd = new Date(
    Date.UTC(currMonths[currMonths.length - 1].year, currMonths[currMonths.length - 1].month + 1, 1)
  )
    .toISOString()
    .slice(0, 10);

  const [bkRes, roomRes, invRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("check_in, check_out, total_amount, ota, source, status, booking_type")
      .eq("property_id", property.id)
      .gte("check_out", windowStart)
      .lt("check_in", windowEnd)
      .order("check_in", { ascending: true })
      .limit(5000),
    supabase
      .from("rooms")
      .select("id", { count: "exact", head: true })
      .eq("property_id", property.id)
      .eq("status", "active"),
    listInvoices(property.id),
  ]);

  const bookings = (bkRes.data ?? []) as BkRow[];
  const activeRooms = roomRes.count ?? 0;
  const invoices = invRes.ok ? invRes.data : [];

  const curr = bucket(bookings, currMonths);
  const prior = bucket(bookings, priorMonths);

  // Channel labels union across the current window (stable legend order).
  const channelTotals = new Map<string, number>();
  for (const a of curr) {
    for (const [k, v] of a.channel) channelTotals.set(k, (channelTotals.get(k) || 0) + v);
  }
  const channelLabels = [...channelTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  // Shape one row per current month with both periods side by side.
  const summary: MonthRow[] = currMonths.map((m, i) => {
    const c = curr[i];
    const p = prior[i];
    const ch: Record<string, number> = {};
    for (const k of channelLabels) ch[k] = Math.round(c.channel.get(k) || 0);
    return {
      month: m.key,
      priorMonth: priorMonths[i].key,
      revenue: Math.round(c.revenue),
      priorRevenue: Math.round(p.revenue),
      bookings: c.bookings,
      priorBookings: p.bookings,
      nights: c.nights,
      occupancy: occupancy(c, activeRooms),
      priorOccupancy: occupancy(p, activeRooms),
      channel: ch,
    };
  });

  // Channel-mix totals over the whole current window (for the donut/legend).
  const channelMix: ChannelSlice[] = channelLabels.map((label) => ({
    label,
    revenue: Math.round(channelTotals.get(label) || 0),
  }));

  // ── KPIs (current vs prior) ───────────────────────────────────────────────
  const sum = (rows: MonthRow[], k: "revenue" | "priorRevenue" | "bookings" | "priorBookings") =>
    rows.reduce((s, r) => s + (r[k] as number), 0);

  const avgOcc = (rows: MonthRow[], k: "occupancy" | "priorOccupancy") =>
    rows.length ? rows.reduce((s, r) => s + (r[k] as number), 0) / rows.length : 0;

  // Outstanding — invoice-derived, no delta (issued/partial balances).
  let outstanding = 0;
  for (const inv of invoices) {
    if (inv.status === "void") continue;
    if (inv.status === "issued" || inv.status === "partial") {
      outstanding += Number(inv.balance) || 0;
    }
  }

  const kpis: Kpis = {
    revenue: sum(summary, "revenue"),
    priorRevenue: sum(summary, "priorRevenue"),
    bookings: sum(summary, "bookings"),
    priorBookings: sum(summary, "priorBookings"),
    occupancy: avgOcc(summary, "occupancy"),
    priorOccupancy: avgOcc(summary, "priorOccupancy"),
    outstanding: Math.round(outstanding * 100) / 100,
  };

  // The selected range, day-precision, for the picker round-trip.
  const lastMonth = currMonths[currMonths.length - 1];
  const selectedRange = {
    from: range.from,
    to: new Date(Date.UTC(lastMonth.year, lastMonth.month + 1, 0)).toISOString().slice(0, 10),
  };

  return (
    <ReportsClient
      summary={summary}
      kpis={kpis}
      channelMix={channelMix}
      channelLabels={channelLabels}
      currency={property.currency}
      selectedRange={selectedRange}
      monthsCount={monthsCount}
      currentRange={{ start: currMonths[0].key, end: lastMonth.key }}
      priorRange={{ start: priorMonths[0].key, end: priorMonths[priorMonths.length - 1].key }}
    />
  );
}
