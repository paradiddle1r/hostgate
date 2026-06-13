"use client";

// Flat, filterable, exportable list of every booking for the active property.
// Data arrives once via `initialBookings` (server page, fully paged); the date
// window, source / status / type filters, search, and sort all run in-memory
// for zero-latency interaction. Row click jumps to that stay on the calendar.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Download,
  FileSpreadsheet,
  CalendarRange,
  RotateCcw,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type {
  Booking,
  BookingStatus,
  BookingSource,
  BookingType,
} from "@/lib/db/bookings";
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

const SOURCES: BookingSource[] = ["direct", "walk_in", "ota", "web"];

const BOOKING_TYPES: BookingType[] = ["standard", "monthly", "blocked", "oos"];

// Date field the From/To window filters against.
type DateField = "check_in" | "check_out" | "booked_date" | "created_at";

// Sort keys — ten, mirroring hotel-pms's bookings list.
type SortKey =
  | "check_in"
  | "check_out"
  | "booked_date"
  | "total_amount"
  | "room"
  | "guest_name"
  | "source"
  | "status"
  | "reservation_no"
  | "created_at";

// Pill colours per status. checked_out is muted; cancelled reads as struck-out.
const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: "#d97706",
  confirmed: "var(--app-accent)",
  checked_in: "var(--app-success)",
  checked_out: "#6b7280",
  cancelled: "#ef4444",
};

// Local TH+EN strings — keeps this page's i18n in one place (status / source /
// type / sort labels included so we don't reach into the global dict).
const STR = {
  th: {
    title: "การจอง",
    search: "ค้นหาชื่อ / รหัส / เบอร์โทร / ห้อง",
    status: "สถานะ",
    source: "ช่องทาง",
    type: "ประเภท",
    all: "ทั้งหมด",
    code: "รหัส",
    resNo: "เลขที่จอง",
    guest: "ผู้เข้าพัก",
    room: "ห้อง",
    checkIn: "วันเข้า",
    checkOut: "วันออก",
    booked: "วันที่จอง",
    nights: "คืน",
    total: "ยอดรวม",
    empty: "ไม่พบการจอง",
    count: "รายการ",
    of: "จาก",
    dateField: "ช่วงวันที่ตาม",
    from: "ตั้งแต่",
    to: "ถึง",
    sortBy: "เรียงตาม",
    asc: "น้อย→มาก",
    desc: "มาก→น้อย",
    reset: "ล้างตัวกรอง",
    open: "— เปิด —",
    df_check_in: "วันเข้าพัก",
    df_check_out: "วันออก",
    df_booked_date: "วันที่จอง",
    df_created_at: "วันที่สร้าง",
    st_pending: "รอยืนยัน",
    st_confirmed: "ยืนยันแล้ว",
    st_checked_in: "เข้าพักแล้ว",
    st_checked_out: "ออกแล้ว",
    st_cancelled: "ยกเลิก",
    src_direct: "จองตรง",
    src_walk_in: "Walk-in",
    src_ota: "OTA",
    src_web: "เว็บไซต์",
    bt_standard: "รายวัน",
    bt_monthly: "รายเดือน",
    bt_blocked: "บล็อก",
    bt_oos: "งดขาย",
    sk_check_in: "วันเข้าพัก",
    sk_check_out: "วันออก",
    sk_booked_date: "วันที่จอง",
    sk_total_amount: "ยอดรวม",
    sk_room: "ห้อง",
    sk_guest_name: "ชื่อผู้เข้าพัก",
    sk_source: "ช่องทาง",
    sk_status: "สถานะ",
    sk_reservation_no: "เลขที่จอง",
    sk_created_at: "วันที่สร้าง",
  },
  en: {
    title: "Bookings",
    search: "Search name / code / phone / room",
    status: "Status",
    source: "Source",
    type: "Type",
    all: "All",
    code: "Code",
    resNo: "Res. No.",
    guest: "Guest",
    room: "Room",
    checkIn: "Check-in",
    checkOut: "Check-out",
    booked: "Booked",
    nights: "Nights",
    total: "Total",
    empty: "No bookings found",
    count: "bookings",
    of: "of",
    dateField: "Date field",
    from: "From",
    to: "To",
    sortBy: "Sort by",
    asc: "Asc",
    desc: "Desc",
    reset: "Reset",
    open: "— open —",
    df_check_in: "Arrival (check-in)",
    df_check_out: "Departure (check-out)",
    df_booked_date: "Booked date",
    df_created_at: "Created at",
    st_pending: "Pending",
    st_confirmed: "Confirmed",
    st_checked_in: "Checked in",
    st_checked_out: "Checked out",
    st_cancelled: "Cancelled",
    src_direct: "Direct",
    src_walk_in: "Walk-in",
    src_ota: "OTA",
    src_web: "Web",
    bt_standard: "Standard",
    bt_monthly: "Monthly",
    bt_blocked: "Blocked",
    bt_oos: "Out of service",
    sk_check_in: "Arrival date (check-in)",
    sk_check_out: "Departure (check-out)",
    sk_booked_date: "Booked date",
    sk_total_amount: "Total amount",
    sk_room: "Room",
    sk_guest_name: "Guest name",
    sk_source: "Source",
    sk_status: "Status",
    sk_reservation_no: "Reservation no.",
    sk_created_at: "Created at",
  },
} as const;

const SORT_KEYS: SortKey[] = [
  "check_in",
  "check_out",
  "booked_date",
  "total_amount",
  "room",
  "guest_name",
  "source",
  "status",
  "reservation_no",
  "created_at",
];

const OPEN_ENDED_DATE = "2099-12-31";

/** UTC-anchored whole-night diff (matches the export + avoids +07 drift). */
function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn + "T00:00:00Z");
  const b = Date.parse(checkOut + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

// ISO date helpers for the default window (-30d .. +90d).
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysFromToday(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

// Null-aware compare: nulls/empties sort last on asc, first on desc, so rows
// with missing values stay grouped rather than scattered.
function cmp(a: unknown, b: unknown, dir: "asc" | "desc"): number {
  const an = a === null || a === undefined || a === "";
  const bn = b === null || b === undefined || b === "";
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  const na = Number(a),
    nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    return dir === "asc" ? na - nb : nb - na;
  }
  const sa = String(a),
    sb = String(b);
  if (sa < sb) return dir === "asc" ? -1 : 1;
  if (sa > sb) return dir === "asc" ? 1 : -1;
  return 0;
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
  // Default window: arrivals from 30 days ago through 90 days ahead — the
  // "current operating window" (recent stays for accounting + upcoming stays).
  const [dateFrom, setDateFrom] = useState(() => daysFromToday(-30));
  const [dateTo, setDateTo] = useState(() => daysFromToday(90));
  const [dateField, setDateField] = useState<DateField>("check_in");

  // Multi-select chip filters. Status + Source default to "all selected";
  // Type defaults to just `standard` (the common front-desk case).
  const [statusFilter, setStatusFilter] = useState<Set<BookingStatus>>(
    new Set(STATUSES)
  );
  const [sourceFilter, setSourceFilter] = useState<Set<BookingSource>>(
    new Set(SOURCES)
  );
  const [typeFilter, setTypeFilter] = useState<Set<BookingType>>(
    new Set<BookingType>(["standard"])
  );

  const [sortKey, setSortKey] = useState<SortKey>("check_in");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const statusLabel = (s: BookingStatus) =>
    tr[`st_${s}` as keyof typeof tr] as string;
  const sourceLabel = (s: BookingSource) =>
    tr[`src_${s}` as keyof typeof tr] as string;
  const typeLabel = (t: BookingType) =>
    tr[`bt_${t}` as keyof typeof tr] as string;
  const dateFieldLabel = (d: DateField) =>
    tr[`df_${d}` as keyof typeof tr] as string;
  const sortLabel = (k: SortKey) => tr[`sk_${k}` as keyof typeof tr] as string;

  const money = (n: number) =>
    `${currency} ${n.toLocaleString(locale === "en" ? "en-US" : "th-TH")}`;

  const roomLabel = (id: string | null) =>
    (id ? roomNumberById[id] : undefined) ?? "—";

  // Toggle a value in/out of a multi-select Set filter.
  function toggleSet<T>(
    set: Set<T>,
    val: T,
    setter: (s: Set<T>) => void
  ): void {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  }

  // ── filter pipeline ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initialBookings.filter((b) => {
      // Date window — half-open against the selected date field.
      if (dateFrom || dateTo) {
        const v = b[dateField];
        if (!v) return false;
        if (dateFrom && v < dateFrom) return false;
        if (dateTo && v > dateTo) return false;
      }
      // Booking type.
      if (typeFilter.size && !typeFilter.has(b.booking_type)) return false;
      // Status only meaningfully exists on standard/monthly bookings — for
      // blocked/oos we don't filter by status (it's irrelevant to operations).
      if (
        (b.booking_type === "standard" || b.booking_type === "monthly") &&
        statusFilter.size &&
        !statusFilter.has(b.status)
      )
        return false;
      // Source.
      if (sourceFilter.size && !sourceFilter.has(b.source)) return false;
      // Free-text search across the operator-relevant fields.
      if (needle) {
        const hay = [
          b.reservation_no,
          b.code,
          b.guest_name,
          b.guest_first_name,
          b.guest_last_name,
          b.thai_name,
          b.phone,
          b.car_plate,
          b.notes,
          roomLabel(b.room_id),
          b.ota,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    // roomLabel is stable for a given roomNumberById (which never changes here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialBookings,
    q,
    dateFrom,
    dateTo,
    dateField,
    statusFilter,
    sourceFilter,
    typeFilter,
  ]);

  // ── sort ──────────────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const arr = [...filtered];
    const keyOf = (b: Booking): unknown =>
      sortKey === "room" ? roomLabel(b.room_id) : b[sortKey as keyof Booking];
    arr.sort((a, b) => cmp(keyOf(a), keyOf(b), sortDir));
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir]);

  function resetFilters() {
    setQ("");
    setDateFrom(daysFromToday(-30));
    setDateTo(daysFromToday(90));
    setDateField("check_in");
    setStatusFilter(new Set(STATUSES));
    setSourceFilter(new Set(SOURCES));
    setTypeFilter(new Set<BookingType>(["standard"]));
    setSortKey("check_in");
    setSortDir("asc");
  }

  // Click a sortable header: same column → flip dir; else switch + asc.
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs transition-colors ${
      active
        ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)] font-medium"
        : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
    }`;

  const Th = ({
    label,
    k,
    align = "left",
  }: {
    label: string;
    k?: SortKey;
    align?: "left" | "right" | "center";
  }) => {
    const alignCls =
      align === "right"
        ? "text-right"
        : align === "center"
          ? "text-center"
          : "text-left";
    if (!k) return <th className={`px-4 py-2.5 font-medium ${alignCls}`}>{label}</th>;
    const active = sortKey === k;
    return (
      <th
        onClick={() => toggleSort(k)}
        className={`cursor-pointer select-none px-4 py-2.5 font-medium ${alignCls} hover:text-[var(--app-fg)]`}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (
            sortDir === "asc" ? (
              <ArrowUp size={12} />
            ) : (
              <ArrowDown size={12} />
            )
          ) : null}
        </span>
      </th>
    );
  };

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <span className="text-sm text-[var(--app-fg-muted)]">
          {rows.length.toLocaleString()} {tr.of}{" "}
          {initialBookings.length.toLocaleString()} {tr.count}
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

      {/* Filters card */}
      <div className="app-surface mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] p-3">
        {/* Row 1: search + date window + sort */}
        <div className="flex flex-wrap items-end gap-2">
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

          <label className="flex flex-col gap-1 text-xs text-[var(--app-fg-muted)]">
            {tr.dateField}
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as DateField)}
              className={field}
            >
              {(
                [
                  "check_in",
                  "check_out",
                  "booked_date",
                  "created_at",
                ] as DateField[]
              ).map((d) => (
                <option key={d} value={d}>
                  {dateFieldLabel(d)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--app-fg-muted)]">
            {tr.from}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--app-fg-muted)]">
            {tr.to}
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--app-fg-muted)]">
            {tr.sortBy}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className={field}
            >
              {SORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {sortLabel(k)}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className={`${field} inline-flex items-center gap-1 text-[var(--app-fg)]`}
            title={sortDir === "asc" ? tr.asc : tr.desc}
          >
            {sortDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {sortDir === "asc" ? tr.asc : tr.desc}
          </button>

          <button
            onClick={resetFilters}
            className={`${field} inline-flex items-center gap-1 text-[var(--app-fg-muted)] hover:text-[var(--app-fg)]`}
          >
            <RotateCcw size={13} /> {tr.reset}
          </button>
        </div>

        {/* Source chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
            {tr.source}
          </span>
          {SOURCES.map((s) => (
            <button
              key={s}
              onClick={() => toggleSet(sourceFilter, s, setSourceFilter)}
              className={chip(sourceFilter.has(s))}
            >
              {sourceLabel(s)}
            </button>
          ))}
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
            {tr.status}
          </span>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => toggleSet(statusFilter, s, setStatusFilter)}
              className={chip(statusFilter.has(s))}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>

        {/* Booking-type chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
            {tr.type}
          </span>
          {BOOKING_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggleSet(typeFilter, t, setTypeFilter)}
              className={chip(typeFilter.has(t))}
            >
              {typeLabel(t)}
            </button>
          ))}
        </div>
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
                <Th label={tr.resNo} k="reservation_no" />
                <Th label={tr.code} />
                <Th label={tr.source} k="source" />
                <Th label={tr.type} k="status" />
                <Th label={tr.guest} k="guest_name" />
                <Th label={tr.room} k="room" align="center" />
                <Th label={tr.checkIn} k="check_in" />
                <Th label={tr.checkOut} k="check_out" />
                <Th label={tr.nights} align="right" />
                <Th label={tr.booked} k="booked_date" />
                <Th label={tr.status} k="status" />
                <Th label={tr.total} k="total_amount" align="right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const cancelled = b.status === "cancelled";
                const isStay =
                  b.booking_type === "standard" || b.booking_type === "monthly";
                return (
                  <tr
                    key={b.id}
                    onClick={() =>
                      router.push(`/app/calendar?from=${b.check_in}`)
                    }
                    className="cursor-pointer border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {b.reservation_no ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{b.code}</td>
                    <td className="px-4 py-2.5 text-[var(--app-fg-muted)]">
                      {b.ota?.trim() ? b.ota : sourceLabel(b.source)}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--app-fg-muted)]">
                      {typeLabel(b.booking_type)}
                    </td>
                    <td
                      className={`px-4 py-2.5 ${
                        cancelled
                          ? "text-[var(--app-fg-muted)] line-through"
                          : ""
                      }`}
                    >
                      {b.guest_name}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {roomLabel(b.room_id)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {b.check_in}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {b.check_out === OPEN_ENDED_DATE ? tr.open : b.check_out}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {nightsBetween(b.check_in, b.check_out) || "—"}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-[var(--app-fg-muted)]">
                      {b.booked_date ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {isStay ? (
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                          style={{
                            background: STATUS_COLOR[b.status],
                            opacity: cancelled ? 0.7 : 1,
                          }}
                        >
                          {statusLabel(b.status)}
                        </span>
                      ) : (
                        <span className="text-[var(--app-fg-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-right">
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
