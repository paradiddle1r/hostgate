import { getActiveProperty } from "@/lib/active-property-server";
import { listInvoices } from "@/lib/db/invoices";
import { listAllBookings } from "@/lib/db/bookings";
import ReportsClient from "@/components/app/reports/ReportsClient";
import type { MonthRow, Kpis } from "@/components/app/reports/ReportsClient";

export const dynamic = "force-dynamic";

// Booking statuses that count as realized stays for the booking-based fallback.
const REALIZED: ReadonlyArray<string> = ["confirmed", "checked_in", "checked_out"];

/** UTC-anchored whole-night diff — matches BookingsClient, avoids +07 drift. */
function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn + "T00:00:00Z");
  const b = Date.parse(checkOut + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** The 6 'YYYY-MM' keys ending at `nowMonth`, oldest first. */
function lastSixMonths(now: Date): string[] {
  const keys: string[] = [];
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

export default async function ReportsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;

  const [invRes, bookRes] = await Promise.all([
    listInvoices(property.id),
    listAllBookings(property.id),
  ]);
  const invoices = invRes.ok ? invRes.data : [];
  const bookings = bookRes.ok ? bookRes.data : [];

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  // ── Monthly summary (last 6 months) ───────────────────────────────────────
  // Seed all 6 buckets to zero so zero-revenue months still render a bar.
  const months = lastSixMonths(today);
  const byMonth = new Map<string, MonthRow>(
    months.map((month) => [month, { month, revenue: 0, bookings: 0, nights: 0 }])
  );

  // Revenue source: prefer issued/paid invoices (keeps bars reconciled with the
  // headline KPI). Fall back to booking totals only when there are no invoices.
  const useInvoiceRevenue = invoices.length > 0;
  if (useInvoiceRevenue) {
    for (const inv of invoices) {
      if (inv.status === "void") continue;
      const paid = Number(inv.amount_paid) || 0;
      if (paid <= 0) continue;
      const dateKey = (inv.issue_date ?? inv.created_at ?? "").slice(0, 7);
      const row = byMonth.get(dateKey);
      if (row) row.revenue += paid;
    }
  }

  // Bookings + nights (and the revenue fallback) keyed by check-in month.
  for (const b of bookings) {
    const monthKey = (b.check_in ?? "").slice(0, 7);
    const row = byMonth.get(monthKey);
    if (!row) continue;
    const realized = REALIZED.includes(b.status);
    if (realized) {
      row.bookings += 1;
      row.nights += nightsBetween(b.check_in, b.check_out);
      if (!useInvoiceRevenue) row.revenue += Number(b.total_amount) || 0;
    }
  }

  const summary: MonthRow[] = months.map((m) => {
    const row = byMonth.get(m)!;
    return { ...row, revenue: Math.round(row.revenue * 100) / 100 };
  });

  // ── Overall KPIs ──────────────────────────────────────────────────────────
  let totalRevenue = 0;
  let outstanding = 0;
  for (const inv of invoices) {
    if (inv.status === "void") continue;
    totalRevenue += Number(inv.amount_paid) || 0;
    if (inv.status === "issued" || inv.status === "partial") {
      outstanding += Number(inv.balance) || 0;
    }
  }
  // Booking-revenue fallback for the headline number when no invoices exist yet.
  if (!useInvoiceRevenue) {
    for (const b of bookings) {
      if (REALIZED.includes(b.status)) totalRevenue += Number(b.total_amount) || 0;
    }
  }

  // In-house today: checked_in stays spanning today (check_in ≤ today < check_out).
  const inHouseToday = bookings.filter(
    (b) =>
      b.status === "checked_in" &&
      b.check_in <= todayISO &&
      b.check_out > todayISO
  ).length;

  const totalBookings = bookings.filter((b) => REALIZED.includes(b.status)).length;

  const kpis: Kpis = {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    outstanding: Math.round(outstanding * 100) / 100,
    bookings: totalBookings,
    inHouseToday,
  };

  return <ReportsClient summary={summary} kpis={kpis} currency={property.currency} />;
}
