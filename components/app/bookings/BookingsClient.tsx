"use client";

// Flat, filterable, exportable list of every booking for the active property.
// Data arrives once via `initialBookings` (server page); search + status filter
// run entirely in-memory. Row click jumps to that stay on the calendar.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Download, FileSpreadsheet, CalendarRange } from "lucide-react";
import type { Booking, BookingStatus } from "@/lib/db/bookings";
import { useI18n } from "@/lib/i18n";
import EmptyState from "@/components/app/ui/EmptyState";
import Button from "@/components/app/ui/Button";
import { exportBookingsCsv, exportBookingsExcel } from "@/lib/bookings-export";

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

const STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
];

// Pill colours per status. checked_out is muted; cancelled reads as struck-out.
const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: "#d97706",
  confirmed: "var(--app-accent)",
  checked_in: "var(--app-success)",
  checked_out: "#6b7280",
  cancelled: "#ef4444",
};

// Local TH+EN strings — keeps this page's i18n in one place (status labels
// included so we don't reach into useAppT for them).
const STR = {
  th: {
    title: "การจอง",
    search: "ค้นหาชื่อ / รหัส / เบอร์โทร",
    status: "สถานะ",
    all: "ทั้งหมด",
    code: "รหัส",
    guest: "ผู้เข้าพัก",
    room: "ห้อง",
    checkIn: "วันเข้า",
    checkOut: "วันออก",
    nights: "คืน",
    source: "ช่องทาง",
    total: "ยอดรวม",
    export: "ส่งออก",
    empty: "ไม่พบการจอง",
    count: "รายการ",
    st_pending: "รอยืนยัน",
    st_confirmed: "ยืนยันแล้ว",
    st_checked_in: "เข้าพักแล้ว",
    st_checked_out: "ออกแล้ว",
    st_cancelled: "ยกเลิก",
    src_direct: "จองตรง",
    src_walk_in: "Walk-in",
    src_ota: "OTA",
    src_web: "เว็บไซต์",
  },
  en: {
    title: "Bookings",
    search: "Search name / code / phone",
    status: "Status",
    all: "All",
    code: "Code",
    guest: "Guest",
    room: "Room",
    checkIn: "Check-in",
    checkOut: "Check-out",
    nights: "Nights",
    source: "Source",
    total: "Total",
    export: "Export",
    empty: "No bookings found",
    count: "bookings",
    st_pending: "Pending",
    st_confirmed: "Confirmed",
    st_checked_in: "Checked in",
    st_checked_out: "Checked out",
    st_cancelled: "Cancelled",
    src_direct: "Direct",
    src_walk_in: "Walk-in",
    src_ota: "OTA",
    src_web: "Web",
  },
} as const;

/** UTC-anchored whole-night diff (matches the export + avoids +07 drift). */
function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn + "T00:00:00Z");
  const b = Date.parse(checkOut + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export default function BookingsClient({
  initialBookings,
  roomNumberById,
  currency,
}: {
  initialBookings: Booking[];
  roomNumberById: Record<string, string>;
  currency: string;
}) {
  const router = useRouter();
  const { locale } = useI18n();
  const tr = STR[locale === "en" ? "en" : "th"];

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BookingStatus | "all">("all");

  const statusLabel = (s: BookingStatus) =>
    tr[`st_${s}` as keyof typeof tr] as string;
  const sourceLabel = (s: Booking["source"]) =>
    tr[`src_${s}` as keyof typeof tr] as string;

  const money = (n: number) =>
    `${currency} ${n.toLocaleString(locale === "en" ? "en-US" : "th-TH")}`;

  // In-memory filter: status + fuzzy guest/code/phone match.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initialBookings.filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (!needle) return true;
      return (
        b.guest_name.toLowerCase().includes(needle) ||
        b.code.toLowerCase().includes(needle) ||
        (b.phone ?? "").toLowerCase().includes(needle)
      );
    });
  }, [initialBookings, q, status]);

  const roomLabel = (id: string | null) =>
    (id ? roomNumberById[id] : undefined) ?? "—";

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <span className="text-sm text-[var(--app-fg-muted)]">
          {rows.length} {tr.count}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportBookingsCsv(rows, roomNumberById)}
            disabled={rows.length === 0}
          >
            <Download size={15} /> CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportBookingsExcel(rows, roomNumberById)}
            disabled={rows.length === 0}
          >
            <FileSpreadsheet size={15} /> Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-fg-muted)]"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr.search}
            className={`${field} w-full pl-8`}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BookingStatus | "all")}
          className={field}
        >
          <option value="all">{tr.status}: {tr.all}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState icon={<CalendarRange size={22} />} title={tr.empty} />
        </div>
      ) : (
        <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                <th className="px-4 py-2.5 font-medium">{tr.code}</th>
                <th className="px-4 py-2.5 font-medium">{tr.guest}</th>
                <th className="px-4 py-2.5 font-medium">{tr.room}</th>
                <th className="px-4 py-2.5 font-medium">{tr.checkIn}</th>
                <th className="px-4 py-2.5 font-medium">{tr.checkOut}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.nights}</th>
                <th className="px-4 py-2.5 font-medium">{tr.status}</th>
                <th className="px-4 py-2.5 font-medium">{tr.source}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.total}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const cancelled = b.status === "cancelled";
                return (
                  <tr
                    key={b.id}
                    onClick={() =>
                      router.push(`/app/calendar?from=${b.check_in}`)
                    }
                    className="cursor-pointer border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                  >
                    <td className="px-4 py-2.5 font-medium">{b.code}</td>
                    <td
                      className={`px-4 py-2.5 ${
                        cancelled
                          ? "text-[var(--app-fg-muted)] line-through"
                          : ""
                      }`}
                    >
                      {b.guest_name}
                    </td>
                    <td className="px-4 py-2.5">{roomLabel(b.room_id)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{b.check_in}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{b.check_out}</td>
                    <td className="px-4 py-2.5 text-right">
                      {nightsBetween(b.check_in, b.check_out)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{
                          background: STATUS_COLOR[b.status],
                          opacity: cancelled ? 0.7 : 1,
                        }}
                      >
                        {statusLabel(b.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--app-fg-muted)]">
                      {sourceLabel(b.source)}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {b.total_amount == null ? "—" : money(b.total_amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
