"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, BedDouble, ClipboardPaste, Coins, Search, X } from "lucide-react";
import type { Room } from "@/lib/db/rooms";
import type { Booking, BookingStatus, BookingType } from "@/lib/db/bookings";
import type { RateMap } from "@/lib/db/rates";
import type { RatePlan } from "@/lib/db/rate-plans";
import { stayTotal } from "@/lib/booking-calc";
import { useAppT } from "@/lib/app-i18n";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import EmptyState from "@/components/app/ui/EmptyState";
import Button from "@/components/app/ui/Button";
import Modal from "@/components/app/ui/Modal";
import BookingModal, { ModalSeed } from "./BookingModal";
import PasteImportModal from "./PasteImportModal";
import BulkRateModal from "./BulkRateModal";
import { setStatusAction, updateBookingAction } from "@/app/app/calendar/actions";

export interface RoomTypeBrief {
  id: string;
  name: string;
  daily_rate: number | null;
}

// A booking enriched with its lease group size, for the Today panel rows.
type TpRow = Booking & { _groupSize: number };
const TODAY_CAPS = { arr: 6, dep: 6, ih: 8, iss: 5 } as const;

const LABEL = 60; // px room-label column

// Day-column width shrinks as the window widens so a 30-day frame still fits
// (and the grid's own overflow-x-auto scrolls when it doesn't).
function colWidth(windowDays: number): number {
  if (windowDays >= 30) return 30;
  if (windowDays >= 14) return 46;
  return 64;
}

// Selectable time frames (must mirror page.tsx ALLOWED_DAYS).
const DAY_OPTIONS = [7, 14, 30] as const;
const DAYS_LS_KEY = "hg.cal.days";

// ── Bilingual copy (local STR — app-i18n is owned elsewhere) ──────────────────
const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    availLabel: "ว่าง",
    occupancy: "อัตราเข้าพัก",
    gross: "รวมทุกประเภท",
    net: "ห้องขายได้",
    excludeOOS: "ไม่รวมห้องปิด",
    excludeMonthly: "ไม่รวมรายเดือน",
    legend: "คำอธิบาย",
    regular: "รายวัน",
    monthly: "รายเดือน",
    blocked: "บล็อก",
    oos: "ห้องเสีย",
    analytics: "ภาพรวมช่วงนี้",
    kBookings: "การจอง",
    kRevenue: "รายได้",
    kADR: "ADR (ราคาเฉลี่ย)",
    kRevPAR: "RevPAR",
    kAvgStay: "พักเฉลี่ย",
    kCheckins: "เช็คอินวันนี้",
    occTrend: "แนวโน้มอัตราเข้าพัก",
    dailyRev: "รายได้รายวัน",
    search: "ค้นหา ชื่อ/เลขจอง/เบอร์โทร…",
    matches: "ตรง",
    floor: "ชั้น",
    nights: "คืน",
    unset: "—",
    room: "ห้อง",
    dates: "วันที่",
    res: "เลขจอง",
    total: "ยอดรวม",
    phone: "โทร",
    timeframe: "ช่วงเวลา",
    days7: "7 วัน",
    days14: "14 วัน",
    days30: "30 วัน",
    statusPending: "รอยืนยัน",
    statusConfirmed: "ยืนยันแล้ว",
    statusCheckedIn: "เข้าพักแล้ว",
    statusCheckedOut: "ออกแล้ว",
    typeMonthly: "รายเดือน",
    typeBlocked: "บล็อก",
    typeOOS: "ห้องเสีย",
    openEnded: "ไม่มีกำหนด",
    guest: "ผู้เข้าพัก",
    moveTitle: "ย้ายการจอง?",
    moveFrom: "จาก",
    moveTo: "ไป",
    moveCancel: "ยกเลิก",
    moveConfirmBtn: "ยืนยันการย้าย",
    conflictTitle: "ย้ายไม่ได้ — ห้องไม่ว่าง",
    conflictBody: "ห้องนี้มีการจองทับช่วงเวลาที่เลือกอยู่แล้ว",
  },
  en: {
    availLabel: "avail",
    occupancy: "Occupancy",
    gross: "Gross",
    net: "Net (sellable)",
    excludeOOS: "Exclude OOS",
    excludeMonthly: "Exclude monthly",
    legend: "Legend",
    regular: "Nightly",
    monthly: "Monthly",
    blocked: "Blocked",
    oos: "Out of service",
    analytics: "This window",
    kBookings: "Bookings",
    kRevenue: "Revenue",
    kADR: "ADR",
    kRevPAR: "RevPAR",
    kAvgStay: "Avg stay",
    kCheckins: "Check-ins today",
    occTrend: "Occupancy trend",
    dailyRev: "Daily revenue",
    search: "Search name / code / phone…",
    matches: "matches",
    floor: "Floor",
    nights: "nights",
    unset: "—",
    room: "Room",
    dates: "Dates",
    res: "Code",
    total: "Total",
    phone: "Phone",
    timeframe: "Time frame",
    days7: "7 days",
    days14: "14 days",
    days30: "30 days",
    statusPending: "Pending",
    statusConfirmed: "Confirmed",
    statusCheckedIn: "Checked in",
    statusCheckedOut: "Checked out",
    typeMonthly: "Monthly",
    typeBlocked: "Blocked",
    typeOOS: "Out of service",
    openEnded: "Open-ended",
    guest: "Guest",
    moveTitle: "Move booking?",
    moveFrom: "From",
    moveTo: "To",
    moveCancel: "Cancel",
    moveConfirmBtn: "Confirm move",
    conflictTitle: "Can't move — room busy",
    conflictBody: "This room already has a booking overlapping the selected dates.",
  },
};

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dayIdx(from: string, date: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(date + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}
function nightsBetween(ci: string, co: string): number {
  return Math.max(1, dayIdx(ci, co));
}

// Bar colour by booking_type first (operational lanes), then by status.
const TYPE_BG: Partial<Record<BookingType, string>> = {
  monthly: "#7c3aed", // violet — long-stay lease
  blocked: "#475569", // slate — held / blocked
  oos: "#dc2626", // red — out of service / maintenance
};
const STATUS_BG: Record<BookingStatus, string> = {
  pending: "#d97706",
  confirmed: "var(--app-accent)",
  checked_in: "var(--app-success)",
  checked_out: "#6b7280",
  cancelled: "transparent",
};
function barBg(b: Booking): string {
  const t = (b.booking_type ?? "standard") as BookingType;
  if (t !== "standard" && TYPE_BG[t]) return TYPE_BG[t] as string;
  return STATUS_BG[b.status];
}

export default function CalendarClient({
  from: fromProp,
  windowDays: windowDaysProp,
  today,
  rooms,
  roomTypes,
  bookings,
  rates,
  plans,
  planByDate = {},
  currency,
  role = "staff",
}: {
  from: string;
  windowDays: number;
  today: string;
  rooms: Room[];
  roomTypes: RoomTypeBrief[];
  bookings: Booking[];
  rates: RateMap;
  plans: RatePlan[];
  planByDate?: Record<string, string>;
  currency: string;
  role?: "owner" | "admin" | "staff";
}) {
  const t = useAppT();
  const { locale } = useI18n();
  const lang: "th" | "en" = locale === "en" ? "en" : "th";
  const s = STR[lang];
  const toast = useToast();
  const router = useRouter();
  const [seed, setSeed] = useState<ModalSeed | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);

  // Net-occupancy toggles. Operators almost always want occupancy to reflect
  // *sellable* rooms, and monthly tenants sell on a different rate sheet.
  const [excludeOOS, setExcludeOOS] = useState(true);
  const [excludeMonthly, setExcludeMonthly] = useState(true);
  const [search, setSearch] = useState("");

  const canManage = role === "owner" || role === "admin";

  // Optimistic window state. `from` + `windowDays` mirror the server props but
  // update INSTANTLY when the operator changes the timeframe or pages — the grid
  // reflows immediately from already-loaded data while the URL push refetches
  // the fuller range in the background (no waiting on the slow DB to reflow).
  // Every reference below uses these locals; they re-sync when fresh props land.
  const [from, setFrom] = useState(fromProp);
  const [windowDays, setWindowDays] = useState(windowDaysProp);
  const [, startNav] = useTransition();
  useEffect(() => {
    setFrom(fromProp);
    setWindowDays(windowDaysProp);
  }, [fromProp, windowDaysProp]);

  // Day-column width: starts at the window's natural base (7→64, 14→46, 30→30)
  // but stretches to fill the grid's available width on wide screens so the
  // table never leaves dead space on the right. We measure the scroll viewport
  // and, when it's wider than the natural grid, grow every column evenly. When
  // it's narrower (small laptops, 30-day window) we keep the base width and let
  // the viewport scroll horizontally.
  const gridViewRef = useRef<HTMLDivElement | null>(null);
  const [gridW, setGridW] = useState(0);
  useEffect(() => {
    const el = gridViewRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      setGridW(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Float (not floored): when stretching, LABEL + windowDays*COL == gridW
  // exactly, so the grid fills the viewport edge-to-edge with no right gap.
  // Flooring lost up to `windowDays` px — very visible at the 30-day window.
  const baseCol = colWidth(windowDays);
  const COL = Math.max(
    baseCol,
    gridW ? (gridW - LABEL) / windowDays : baseCol,
  );

  const dates = useMemo(
    () => Array.from({ length: windowDays }, (_, i) => addDays(from, i)),
    [from, windowDays]
  );
  // Local mirror of the server bookings so a drag-move can patch the bar's
  // position OPTIMISTICALLY — it lands instantly, without waiting on the server
  // round-trip + a full page re-fetch. Re-syncs whenever fresh props arrive.
  const [rows, setRows] = useState(bookings);
  useEffect(() => {
    setRows(bookings);
  }, [bookings]);
  const live = rows.filter((b) => b.status !== "cancelled");

  // Plan lookup by id for colour chip + tooltip name.
  const planById = useMemo(() => {
    const m: Record<string, RatePlan> = {};
    for (const p of plans) m[p.id] = p;
    return m;
  }, [plans]);

  // The first two room types drive the header rate markers (parity with the
  // hotel-pms Deluxe/Standard double-row). Marker = first letter of the type
  // name (e.g. "D"/"S") — generalises beyond two fixed types.
  const headerTypes = useMemo(() => roomTypes.slice(0, 2), [roomTypes]);
  const rateFor = (rtId: string, date: string): number | null => {
    const override = rates[rtId]?.[date];
    if (override != null) return override;
    const base = roomTypes.find((rt) => rt.id === rtId)?.daily_rate;
    return base != null ? base : null;
  };

  // ── drag-to-move (hotel-pms feel) ──────────────────────────────────────────
  // Smoothness rule: NO setState during pointermove. Instead of a separate ghost
  // clone, the REAL bar lifts and tracks the cursor in 2D — its `transform` is
  // written directly to the ref'd node every move (rAF-coalesced) and it gets a
  // `.app-cal-bar-dragging` class (shadow + lift + grabbing cursor), exactly like
  // hotel-pms's `.bbar.dragging`. The drop-target row + day-cell highlight is
  // toggled via direct DOM class flips in the same rAF, never React state.
  const [dragB, setDragB] = useState<Booking | null>(null); // identity only — tooltip suppression + listener gate
  const [dragMoved, setDragMoved] = useState(false); // true once past the move threshold (drives the lift class)
  // Live drop target: which room row + day span the bar would land in. Updated
  // only when the target actually changes (a few times per drag), so the React
  // re-render that paints the highlight is cheap and never per-frame.
  const [drop, setDrop] = useState<{ roomId: string | null; s: number; e: number } | null>(null);
  const dropKeyRef = useRef("");
  // Pending move awaiting confirmation in the dialog.
  const [moveConfirm, setMoveConfirm] = useState<{
    b: Booking;
    newRoomId: string | null;
    fromRoom: string;
    toRoom: string;
    newCI: string;
    newCO: string;
  } | null>(null);
  const startRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const justDraggedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastPtRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const srcBarRef = useRef<HTMLElement | null>(null); // the bar being dragged (lifted in place)
  // Refs so the [dragB]-scoped drag effect always reads the freshest COL +
  // bookings (for the drop-span geometry + conflict pre-check) without
  // re-subscribing its window listeners mid-drag.
  const colRef = useRef(COL);
  colRef.current = COL;
  const bookingsRef = useRef(rows);
  bookingsRef.current = rows;

  // Rich hover tooltip: the booking + pointer coords.
  const [tip, setTip] = useState<{ b: Booking; x: number; y: number } | null>(null);

  function recomputeTotal(roomId: string | null, ci: string, co: string): number | null {
    const rtId = rooms.find((r) => r.id === roomId)?.room_type_id ?? null;
    const base = roomTypes.find((rt) => rt.id === rtId)?.daily_rate ?? 0;
    const rm = rtId ? rates[rtId] ?? {} : {};
    return stayTotal(rm, Number(base) || 0, ci, co).total || null;
  }

  function restoreSrcBar() {
    if (srcBarRef.current) {
      srcBarRef.current.style.transform = "";
      srcBarRef.current.style.zIndex = "";
      srcBarRef.current.style.pointerEvents = "";
      srcBarRef.current.classList.remove("app-cal-bar-dragging");
      srcBarRef.current = null;
    }
  }

  function onBarPointerDown(e: React.PointerEvent, b: Booking) {
    if (e.button !== 0) return;
    // Monthly leases + cancelled bars are drag-locked (parity with hotel-pms):
    // moving them would silently invalidate linked tenant/contract/meter rows or
    // re-activate a cancelled booking. A plain click still opens the modal.
    if (b.booking_type === "monthly" || b.status === "cancelled") return;
    startRef.current = { x: e.clientX, y: e.clientY };
    lastPtRef.current = { x: e.clientX, y: e.clientY };
    // Grab the real bar node — it's the element we lift and translate. We don't
    // touch it until the move threshold is crossed, so a plain click stays a
    // click that opens the edit modal.
    srcBarRef.current = e.currentTarget as HTMLElement;
    movedRef.current = false;
    setTip(null);
    setDragB(b);
  }

  useEffect(() => {
    if (!dragB) return;
    document.body.style.userSelect = "";
    // Fixed for the whole drag: the bar's start column + its length in nights.
    const baseStart = dayIdx(from, dragB.check_in);
    const nights = nightsBetween(dragB.check_in, dragB.check_out);

    // One rAF does BOTH the bar's lift-transform AND the drop-target compute.
    // Crucially elementFromPoint() — a synchronous layout hit-test — runs here
    // (≤ once per frame), NOT on every raw pointermove (pointers fire 120–1000
    // Hz; calling it per event was the real jank).
    function applyFrame() {
      rafRef.current = null;
      const { x, y } = lastPtRef.current;
      const src = srcBarRef.current;
      if (src) {
        const dx = x - startRef.current.x;
        const dy = y - startRef.current.y;
        src.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }
      updateDropTarget(x, y);
    }

    // Resolve the room row + day span under the cursor and, only when it
    // changes, push it to React state — that paints the drop highlight.
    function updateDropTarget(x: number, y: number) {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const rowEl = el?.closest("[data-room-id]") as HTMLElement | null;
      const roomId = rowEl ? rowEl.getAttribute("data-room-id") : dragB!.room_id;
      const deltaDays = Math.round((x - startRef.current.x) / colRef.current);
      const s = baseStart + deltaDays;
      const key = `${roomId}:${s}`;
      if (key !== dropKeyRef.current) {
        dropKeyRef.current = key;
        setDrop({ roomId, s, e: s + nights });
      }
    }

    function move(e: PointerEvent) {
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      lastPtRef.current = { x: e.clientX, y: e.clientY };
      if (!movedRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        movedRef.current = true;
        document.body.style.userSelect = "none";
        // Lift the real bar only once a real drag begins (so a click stays a
        // click). pointer-events:none lets the drop hit-test see the grid
        // beneath, not this bar. The lift CLASS is React-driven (dragMoved) so
        // it survives the drop-highlight re-renders; transform/zIndex stay
        // direct-DOM (React never touches props it doesn't own).
        if (srcBarRef.current) {
          srcBarRef.current.style.zIndex = "40";
          srcBarRef.current.style.pointerEvents = "none";
        }
        setDragMoved(true);
        applyFrame(); // position synchronously so it never flashes at origin
      }
      if (!movedRef.current) return;
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(applyFrame);
    }

    function up(e: PointerEvent) {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      document.body.style.userSelect = "";
      const b = dragB!;
      const moved = movedRef.current;
      // Read the drop target BEFORE restoring the source bar (it's pointer-events
      // none right now, so elementFromPoint correctly sees the grid beneath).
      const dropEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      restoreSrcBar();
      setDragMoved(false);
      setDrop(null);
      dropKeyRef.current = "";
      setDragB(null);
      if (!moved) return;
      justDraggedRef.current = true;
      setTimeout(() => (justDraggedRef.current = false), 0);

      const deltaDays = Math.round((e.clientX - startRef.current.x) / colRef.current);
      const rowEl = dropEl?.closest("[data-room-id]") as HTMLElement | null;
      const newRoomId = rowEl ? rowEl.getAttribute("data-room-id") || null : b.room_id;
      if (newRoomId === b.room_id && deltaDays === 0) return; // no-op drop
      const newCI = deltaDays ? addDays(b.check_in, deltaDays) : b.check_in;
      const newCO = deltaDays ? addDays(b.check_out, deltaDays) : b.check_out;

      // Conflict pre-check (parity with hotel-pms): block an overlap in the
      // target room before even asking to confirm.
      const conflict = bookingsRef.current.find(
        (x) =>
          x.id !== b.id &&
          x.status !== "cancelled" &&
          (b.booking_group_id == null || x.booking_group_id !== b.booking_group_id) &&
          x.room_id === newRoomId &&
          x.check_in < newCO &&
          newCI < x.check_out,
      );
      if (conflict) {
        toast.error(`${s.conflictTitle} · ${s.conflictBody}`);
        return;
      }

      // Ask before applying — show the change details in a dialog.
      setMoveConfirm({
        b,
        newRoomId,
        fromRoom: roomLabel(b.room_id),
        toRoom: roomLabel(newRoomId),
        newCI,
        newCO,
      });
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      restoreSrcBar();
      document.body.style.userSelect = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragB]);

  // Apply the move the operator confirmed in the dialog.
  async function confirmMove() {
    const mc = moveConfirm;
    if (!mc) return;
    setMoveConfirm(null);
    const roomTypeId = rooms.find((r) => r.id === mc.newRoomId)?.room_type_id ?? null;
    const total = recomputeTotal(mc.newRoomId, mc.newCI, mc.newCO);
    // Optimistic: move the bar in local state NOW so it lands instantly. The
    // server write + reconcile happen in the background.
    setRows((prev) =>
      prev.map((x) =>
        x.id === mc.b.id
          ? { ...x, room_id: mc.newRoomId, room_type_id: roomTypeId, check_in: mc.newCI, check_out: mc.newCO, total_amount: total }
          : x,
      ),
    );
    const res = await updateBookingAction(mc.b.id, {
      room_id: mc.newRoomId,
      room_type_id: roomTypeId,
      check_in: mc.newCI,
      check_out: mc.newCO,
      total_amount: total,
    });
    if (res.ok) {
      toast.success(t("cal.saved"));
      // No router.refresh() — the optimistic state already matches the server,
      // so re-fetching would only add a slow flash. Next navigation reconciles.
    } else {
      toast.error(`${res.code} · ${res.message}`);
      router.refresh(); // failed — pull the truth back to revert the optimistic move
    }
  }

  // Carry BOTH from + days through every navigation so changing one never
  // silently resets the other. Update the local window FIRST (instant reflow),
  // then push the URL in a transition so the background refetch never blocks the
  // UI from repainting.
  function pushWindow(nextFrom: string, nextDays: number) {
    setFrom(nextFrom);
    setWindowDays(nextDays);
    startNav(() => router.push(`/app/calendar?from=${nextFrom}&days=${nextDays}`));
  }
  function nav(deltaDays: number) {
    pushWindow(addDays(from, deltaDays), windowDays);
  }
  function goToday() {
    pushWindow(today, windowDays);
  }
  function setDays(n: number) {
    if (n === windowDays) return;
    try { localStorage.setItem(DAYS_LS_KEY, String(n)); } catch { /* ignore */ }
    pushWindow(from, n);
  }

  // On mount, restore the saved time frame — but ONLY when the URL didn't
  // already pin ?days= (avoids fighting an explicit choice / redirect loops).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).has("days")) return;
    let saved: number | null = null;
    try { saved = Number(localStorage.getItem(DAYS_LS_KEY)) || null; } catch { /* ignore */ }
    if (saved && DAY_OPTIONS.includes(saved as (typeof DAY_OPTIONS)[number]) && saved !== windowDays) {
      pushWindow(from, saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function quick(b: Booking, status: BookingStatus) {
    const res = await setStatusAction(b.id, status);
    if (res.ok) {
      toast.success(t("cal.saved"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  // Today panel "Confirm" quick-action for pending bookings (mostly from the
  // public booking widget, source='web'). Reuses the same setStatusAction
  // server action as quick()/BookingModal's quickStatus() — no new server
  // logic — and tracks per-booking loading state so the button disables
  // itself while the request is in flight.
  const [confirmingIds, setConfirmingIds] = useState<Set<string>>(new Set());
  async function confirmPending(b: Booking) {
    if (confirmingIds.has(b.id)) return;
    setConfirmingIds((s) => new Set(s).add(b.id));
    try {
      const res = await setStatusAction(b.id, "confirmed");
      if (res.ok) {
        toast.success(t("cal.confirmed"));
        router.refresh();
      } else {
        toast.error(`${res.code} · ${res.message}`);
      }
    } finally {
      setConfirmingIds((s) => {
        const n = new Set(s);
        n.delete(b.id);
        return n;
      });
    }
  }

  // Today panel buckets — group-deduped (one row per lease), with _groupSize.
  // Stays (standard/monthly) drive arrivals/departures/in-house; OOS rooms
  // overlapping today land in `issues`. Mirrors hotel-pms's computeTodayPanel.
  const todayPanel = useMemo(() => {
    const liveRows = rows.filter((b) => b.status !== "cancelled");
    const seen = new Set<string>();
    const arr: TpRow[] = [], dep: TpRow[] = [], ih: TpRow[] = [], iss: TpRow[] = [];
    for (const b of liveRows) {
      if (b.booking_group_id) {
        if (seen.has(b.booking_group_id)) continue;
        seen.add(b.booking_group_id);
      }
      const type = b.booking_type ?? "standard";
      const isStay = type === "standard" || type === "monthly";
      const groupSize = b.booking_group_id
        ? liveRows.filter((x) => x.booking_group_id === b.booking_group_id).length
        : 1;
      const e: TpRow = { ...b, _groupSize: groupSize };
      if (isStay) {
        if (b.check_in === today) arr.push(e);
        if (b.check_out === today) dep.push(e);
        if (b.check_in <= today && b.check_out > today) ih.push(e);
      }
      if (type === "oos" && b.check_in <= today && b.check_out > today) iss.push(e);
    }
    return { arr, dep, ih, iss };
  }, [rows, today]);

  const roomLabel = (id: string | null) => rooms.find((r) => r.id === id)?.number ?? t("cal.unassigned");

  // ── Search: which booking ids match the free-text query ──────────────────
  const matchedIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const out = new Set<string>();
    for (const b of rows) {
      const hay = [
        b.guest_name,
        b.guest_first_name,
        b.guest_last_name,
        b.thai_name,
        b.phone,
        b.code,
        b.reservation_no,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (hay.includes(q)) out.add(b.id);
    }
    return out;
  }, [rows, search]);

  // ── Occupancy + KPI math (dedupe room/day) ───────────────────────────────
  const stats = useMemo(() => {
    const dim = windowDays;
    const dayRegular = new Array(dim).fill(0);
    const dayMonthly = new Array(dim).fill(0);
    const dayBlocked = new Array(dim).fill(0);
    const dayOOS = new Array(dim).fill(0);
    const revByDay = new Array(dim).fill(0);
    const seenReg = Array.from({ length: dim }, () => new Set<string>());
    const seenMon = Array.from({ length: dim }, () => new Set<string>());
    const seenBlk = Array.from({ length: dim }, () => new Set<string>());
    const seenOOS = Array.from({ length: dim }, () => new Set<string>());

    let totalRevenue = 0;
    let regularRevenue = 0;
    let regularNights = 0;
    let stayNightsSum = 0;
    let paidBookings = 0;
    let checkinsToday = 0;

    for (const b of live) {
      const type = (b.booking_type ?? "standard") as BookingType;
      const ci = b.check_in;
      const co = b.is_open_ended ? dates[dim - 1] : b.check_out; // open-ended clamps to window end
      const dedupeKey = b.booking_group_id || b.room_id || `b-${b.id}`;

      for (let i = 0; i < dim; i++) {
        const d = dates[i];
        if (d >= ci && d < co) {
          if (type === "monthly") {
            if (!seenMon[i].has(dedupeKey)) { dayMonthly[i]++; seenMon[i].add(dedupeKey); }
          } else if (type === "oos") {
            if (!seenOOS[i].has(dedupeKey)) { dayOOS[i]++; seenOOS[i].add(dedupeKey); }
          } else if (type === "blocked") {
            if (!seenBlk[i].has(dedupeKey)) { dayBlocked[i]++; seenBlk[i].add(dedupeKey); }
          } else {
            if (!seenReg[i].has(dedupeKey)) { dayRegular[i]++; seenReg[i].add(dedupeKey); }
          }
        }
      }

      const isPaid = type === "standard" || type === "monthly";
      if (isPaid) {
        const totalNights = nightsBetween(ci, b.is_open_ended ? co : b.check_out);
        const amt = Number(b.total_amount) || 0;
        const perNight = amt / totalNights;
        let nightsInWindow = 0;
        for (let i = 0; i < dim; i++) {
          const d = dates[i];
          if (d >= ci && d < co) { revByDay[i] += perNight; nightsInWindow++; }
        }
        totalRevenue += perNight * nightsInWindow;
        stayNightsSum += nightsInWindow;
        paidBookings += 1;
        if (type === "standard") {
          regularRevenue += perNight * nightsInWindow;
          regularNights += nightsInWindow;
        }
      }
      if (b.check_in === today) checkinsToday++;
    }

    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    return {
      dayRegular, dayMonthly, dayBlocked, dayOOS, revByDay,
      sumRegular: sum(dayRegular), sumMonthly: sum(dayMonthly),
      sumBlocked: sum(dayBlocked), sumOOS: sum(dayOOS),
      totalRevenue, regularRevenue, regularNights, stayNightsSum,
      paidBookings, checkinsToday,
    };
  }, [live, dates, windowDays, today]);

  const TOTAL = rooms.length;
  const totalCells = TOTAL * windowDays;
  const grossNum = stats.sumRegular + stats.sumMonthly + stats.sumBlocked + stats.sumOOS;
  const grossPct = totalCells > 0 ? Math.round((grossNum / totalCells) * 100) : 0;

  let netDen = totalCells;
  if (excludeOOS) netDen -= stats.sumOOS;
  if (excludeMonthly) netDen -= stats.sumMonthly;
  let netNum = stats.sumRegular + stats.sumBlocked;
  if (!excludeMonthly) netNum += stats.sumMonthly;
  if (!excludeOOS) netNum += stats.sumOOS;
  const netPct = netDen > 0 ? Math.round((netNum / netDen) * 100) : 0;

  const adr = stats.regularNights > 0 ? Math.round(stats.regularRevenue / stats.regularNights) : 0;
  const revpar = totalCells > 0 ? Math.round(stats.regularRevenue / totalCells) : 0;
  const avgStay = stats.paidBookings > 0 ? Math.round((stats.stayNightsSum / stats.paidBookings) * 10) / 10 : 0;

  // Per-day occupancy + remaining availability for the header.
  const dayOccupied = (i: number) =>
    stats.dayRegular[i] + stats.dayMonthly[i] + stats.dayBlocked[i] + stats.dayOOS[i];
  const occNetPct = dates.map((_, i) =>
    TOTAL > 0 ? Math.round(((stats.dayRegular[i] + stats.dayMonthly[i]) / TOTAL) * 100) : 0
  );

  const money = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`;
  const moneyK = (n: number) =>
    n >= 1000 ? `${currency} ${(n / 1000).toFixed(1)}k` : `${currency} ${Math.round(n)}`;

  // Group active rooms by floor (tinted floor band before each group).
  // Computed here — before the early return — so the hook order stays stable.
  const floors = useMemo(() => {
    const m = new Map<number, Room[]>();
    for (const r of rooms) {
      const f = r.floor ?? 0;
      if (!m.has(f)) m.set(f, []);
      m.get(f)!.push(r);
    }
    return Array.from(m.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, rs]) => ({ floor, rooms: rs }));
  }, [rooms]);

  if (rooms.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <EmptyState
          icon={<BedDouble size={22} />}
          title={t("cal.noRooms")}
          hint={t("cal.noRoomsHint")}
          action={<Button onClick={() => router.push("/app/rooms")}>{t("nav.rooms")}</Button>}
        />
      </div>
    );
  }

  // Thai weekday short names (matches hotel-pms tone).
  const TH_DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const fmtCol = (iso: string) => {
    const d = new Date(iso + "T00:00:00Z");
    const dow = lang === "th" ? TH_DOW[d.getUTCDay()] : d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    return { dow, day: d.getUTCDate(), dowNum: d.getUTCDay() };
  };

  // Bars for one room within the window.
  const barsFor = (roomId: string | null) =>
    live
      .filter((b) => b.room_id === roomId)
      .map((b) => {
        const s2 = Math.max(0, dayIdx(from, b.check_in));
        const e2 = Math.min(windowDays, dayIdx(from, b.is_open_ended ? dates[windowDays - 1] : b.check_out));
        return { b, s: s2, e: e2 };
      })
      .filter((x) => x.e > x.s);

  const unassigned = barsFor(null);

  // Availability colour: low (<=3) red, mid (<=10) amber, else muted.
  const availTone = (avail: number) =>
    avail <= 3 ? "#dc2626" : avail <= 10 ? "#d97706" : "var(--app-fg-muted)";

  // SVG chart geometry
  const CW = 280;
  const CH = 64;
  const maxRev = Math.max(1, ...stats.revByDay);

  return (
    <div className="w-full">
      {/* Drag drop-target highlight styles (toggled via classList during drag,
          so they never round-trip through React state). */}
      <style>{`
        .app-cal-droprow { background: color-mix(in srgb, var(--app-accent) 9%, transparent); }
        .app-cal-dropcell { box-shadow: inset 0 0 0 2px var(--app-accent); }
      `}</style>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("cal.title")}</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => nav(-windowDays)} className="rounded-lg p-1.5 hover:bg-[var(--app-surface-2)]" aria-label={t("cal.prev")}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={goToday} className="rounded-lg border border-[var(--app-border)] px-3 py-1 text-sm hover:bg-[var(--app-surface-2)]">
            {t("cal.today")}
          </button>
          <button onClick={() => nav(windowDays)} className="rounded-lg p-1.5 hover:bg-[var(--app-surface-2)]" aria-label={t("cal.next")}>
            <ChevronRight size={18} />
          </button>
        </div>
        {/* time-frame segmented control */}
        <div
          className="flex items-center gap-0.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-0.5"
          role="group"
          aria-label={s.timeframe}
        >
          {DAY_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setDays(n)}
              aria-pressed={windowDays === n}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                windowDays === n
                  ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                  : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
              }`}
            >
              {n === 7 ? s.days7 : n === 14 ? s.days14 : s.days30}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* search */}
          <div className="relative hidden md:block">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-fg-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={s.search}
              className="w-56 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] py-1.5 pl-8 pr-7 text-sm outline-none focus:border-[var(--app-accent)]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-fg-muted)] hover:text-[var(--app-fg)]" aria-label="clear">
                <X size={13} />
              </button>
            )}
          </div>
          <Button variant="ghost" onClick={() => setRateOpen(true)}>
            <Coins size={16} /> {t("cal.rates")}
          </Button>
          <Button variant="ghost" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste size={16} /> {t("cal.paste")}
          </Button>
          <Button onClick={() => setSeed({ checkIn: today, checkOut: addDays(today, 1) })}>
            <Plus size={16} /> {t("cal.newBooking")}
          </Button>
        </div>
        {matchedIds && (
          <div className="w-full text-xs text-[var(--app-fg-muted)]">
            {matchedIds.size} {s.matches}
          </div>
        )}
      </div>

      {/* Occupancy legend + gross/net box */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-[var(--app-fg-muted)]">{s.gross}</span>{" "}
            <span className="font-semibold">{grossPct}%</span>
          </div>
          <div>
            <span className="text-[var(--app-fg-muted)]">{s.net}</span>{" "}
            <span className="font-semibold text-[var(--app-accent)]">{netPct}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Toggle on={excludeOOS} onClick={() => setExcludeOOS((v) => !v)} label={s.excludeOOS} />
          <Toggle on={excludeMonthly} onClick={() => setExcludeMonthly((v) => !v)} label={s.excludeMonthly} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
          <LegendDot color="var(--app-accent)" label={s.regular} />
          <LegendDot color={TYPE_BG.monthly!} label={s.monthly} />
          <LegendDot color={TYPE_BG.blocked!} label={s.blocked} />
          <LegendDot color={TYPE_BG.oos!} label={s.oos} />
        </div>
      </div>

      {/* Admin/owner analytics block */}
      {canManage && (
        <div className="mb-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--app-fg-muted)]">{s.analytics}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label={s.kBookings} value={String(stats.paidBookings)} />
            <Kpi label={s.kRevenue} value={moneyK(stats.totalRevenue)} />
            <Kpi label={s.kADR} value={money(adr)} />
            <Kpi label={s.kRevPAR} value={money(revpar)} />
            <Kpi label={s.kAvgStay} value={`${avgStay} ${s.nights}`} />
            <Kpi label={s.kCheckins} value={String(stats.checkinsToday)} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* occupancy trend (line) */}
            <Chart title={s.occTrend}>
              <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" preserveAspectRatio="none" style={{ height: CH }}>
                <polyline
                  fill="none"
                  stroke="var(--app-accent)"
                  strokeWidth={1.5}
                  points={occNetPct
                    .map((p, i) => `${(i / Math.max(1, windowDays - 1)) * CW},${CH - (p / 100) * (CH - 6) - 3}`)
                    .join(" ")}
                />
                {occNetPct.map((p, i) => (
                  <circle key={i} cx={(i / Math.max(1, windowDays - 1)) * CW} cy={CH - (p / 100) * (CH - 6) - 3} r={1.6} fill="var(--app-accent)" />
                ))}
              </svg>
            </Chart>
            {/* daily revenue (bars) */}
            <Chart title={s.dailyRev}>
              <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" preserveAspectRatio="none" style={{ height: CH }}>
                {stats.revByDay.map((r, i) => {
                  const bw = CW / windowDays;
                  const h = (r / maxRev) * (CH - 4);
                  return <rect key={i} x={i * bw + 1} y={CH - h} width={Math.max(1, bw - 2)} height={h} rx={1} fill="var(--app-success)" opacity={0.85} />;
                })}
              </svg>
            </Chart>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* ── Grid (desktop) ── */}
        {/* min-w-0 lets this 1fr grid item shrink so its fixed-width inner div
            scrolls internally (overflow-x-auto) instead of blowing out the page. */}
        <div ref={gridViewRef} className="hidden min-w-0 overflow-x-auto rounded-2xl border border-[var(--app-border)] lg:block">
          <div style={{ width: LABEL + windowDays * COL }}>
            {/* date header — weekday + day */}
            <div className="flex border-b border-[var(--app-border)] bg-[var(--app-surface-2)]">
              <div style={{ width: LABEL }} className="shrink-0" />
              {dates.map((d, di) => {
                const { dow, day, dowNum } = fmtCol(d);
                const isToday = d === today;
                const isWeekend = dowNum === 0 || dowNum === 6;
                const planId = planByDate[d];
                const plan = planId ? planById[planId] : undefined;
                const avail = TOTAL - dayOccupied(di);
                return (
                  <div
                    key={d}
                    style={{ width: COL }}
                    className={`shrink-0 py-1 text-center text-[11px] ${
                      isToday
                        ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                        : isWeekend
                          ? "bg-[var(--app-surface)] text-[var(--app-fg-muted)]"
                          : "text-[var(--app-fg-muted)]"
                    }`}
                  >
                    {/* plan colour chip */}
                    <div className="mx-auto mb-0.5 h-[3px] w-7 rounded-full" style={{ background: plan ? plan.color : "transparent" }} title={plan?.name} />
                    <div>{dow}</div>
                    <div className="font-semibold">{day}</div>
                    {/* per-type rate markers (D/S parity — first letter of type) */}
                    {headerTypes.map((rt) => {
                      const v = rateFor(rt.id, d);
                      const mark = (rt.name || "?").trim().charAt(0).toUpperCase();
                      return (
                        <div key={rt.id} className={`leading-tight ${isToday ? "" : "text-[var(--app-fg-muted)]"}`} style={{ fontSize: 9 }}>
                          <span className="opacity-60">{mark}</span> {v != null ? Math.round(v).toLocaleString() : s.unset}
                        </div>
                      );
                    })}
                    {/* avail count — colour low (<=3) / mid (<=10) */}
                    <div className="mt-0.5 font-semibold" style={{ fontSize: 9, color: isToday ? "inherit" : availTone(avail) }}>
                      {avail}/{TOTAL}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* unassigned row */}
            {unassigned.length > 0 && (
              <Row
                roomId=""
                label={t("cal.unassigned")}
                bars={unassigned}
                dates={dates}
                col={COL}
                today={today}
                matchedIds={matchedIds}
                onCell={() => {}}
                onBar={(b) => setSeed({ booking: b })}
                onBarPointerDown={onBarPointerDown}
                onBarHover={(b, x, y) => setTip({ b, x, y })}
                onBarLeave={() => setTip(null)}
                justDraggedRef={justDraggedRef}
                draggingId={dragMoved && dragB ? dragB.id : null}
                dropSpan={drop && drop.roomId === "" ? { s: drop.s, e: drop.e } : null}
              />
            )}

            {/* floor-grouped room rows */}
            {floors.map((fl) => (
              <div key={fl.floor}>
                <div
                  className="flex items-center px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--app-fg-muted)]"
                  style={{ background: "color-mix(in srgb, var(--app-accent) 8%, transparent)", height: 18 }}
                >
                  {s.floor} {fl.floor}
                </div>
                {fl.rooms.map((r) => (
                  <Row
                    key={r.id}
                    roomId={r.id}
                    label={r.number}
                    bars={barsFor(r.id)}
                    dates={dates}
                    col={COL}
                    today={today}
                    matchedIds={matchedIds}
                    onCell={(date) => setSeed({ roomId: r.id, checkIn: date, checkOut: addDays(date, 1) })}
                    onBar={(b) => setSeed({ booking: b })}
                    onBarPointerDown={onBarPointerDown}
                    onBarHover={(b, x, y) => setTip({ b, x, y })}
                    onBarLeave={() => setTip(null)}
                    justDraggedRef={justDraggedRef}
                    draggingId={dragMoved && dragB ? dragB.id : null}
                    dropSpan={drop && drop.roomId === r.id ? { s: drop.s, e: drop.e } : null}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Today panel / mobile list ── */}
        <TodayPanel
          today={today}
          arrivals={todayPanel.arr}
          departures={todayPanel.dep}
          inhouse={todayPanel.ih}
          issues={todayPanel.iss}
          roomLabel={roomLabel}
          onOpen={(b) => setSeed({ booking: b })}
          onCheckIn={(b) => quick(b, "checked_in")}
          onCheckOut={(b) => quick(b, "checked_out")}
          onConfirm={confirmPending}
          confirmingIds={confirmingIds}
        />
      </div>

      {/* rich hover tooltip */}
      {tip && !dragB && (
        <BookingTooltip b={tip.b} x={tip.x} y={tip.y} s={s} currency={currency} roomLabel={roomLabel(tip.b.room_id)} />
      )}

      {seed && (
        <BookingModal
          seed={seed}
          rooms={rooms}
          roomTypes={roomTypes}
          rates={rates}
          currency={currency}
          onClose={() => setSeed(null)}
        />
      )}

      {pasteOpen && (
        <PasteImportModal
          onClose={() => setPasteOpen(false)}
          onSeed={(p) => {
            setPasteOpen(false);
            setSeed({ checkIn: p.checkIn, checkOut: p.checkOut, guestName: p.guestName, phone: p.phone });
          }}
        />
      )}

      {rateOpen && (
        <BulkRateModal
          roomTypes={roomTypes}
          plans={plans}
          defaultFrom={from}
          defaultTo={addDays(from, windowDays - 1)}
          currency={currency}
          onClose={() => setRateOpen(false)}
        />
      )}

      {/* Drag-move confirmation — shows the change before it's applied. */}
      {moveConfirm && (
        <Modal
          open
          onClose={() => setMoveConfirm(null)}
          title={s.moveTitle}
          className="max-w-sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setMoveConfirm(null)}>
                {s.moveCancel}
              </Button>
              <Button variant="primary" onClick={confirmMove}>
                {s.moveConfirmBtn}
              </Button>
            </>
          }
        >
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-[var(--app-fg-muted)]">{s.guest}</span>
              <span className="font-medium">{moveConfirm.b.guest_name}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--app-fg-muted)]">{s.room}</span>
              <span className="font-medium">
                {moveConfirm.fromRoom} <span className="text-[var(--app-fg-muted)]">→</span> {moveConfirm.toRoom}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--app-fg-muted)]">{s.dates}</span>
              <span className="font-medium">
                {moveConfirm.newCI} <span className="text-[var(--app-fg-muted)]">→</span> {moveConfirm.newCO}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Grid row: sticky label + day cells + absolute bars ──
function Row({
  roomId,
  label,
  bars,
  dates,
  col,
  today,
  matchedIds,
  onCell,
  onBar,
  draggingId,
  dropSpan,
  onBarPointerDown,
  onBarHover,
  onBarLeave,
  justDraggedRef,
}: {
  roomId: string; // "" for the unassigned lane
  label: string;
  bars: { b: Booking; s: number; e: number }[];
  dates: string[];
  col: number; // px per day column (window-dependent)
  today: string;
  matchedIds: Set<string> | null;
  onCell: (date: string) => void;
  onBar: (b: Booking) => void;
  onBarPointerDown: (e: React.PointerEvent, b: Booking) => void;
  onBarHover: (b: Booking, x: number, y: number) => void;
  onBarLeave: () => void;
  justDraggedRef: React.MutableRefObject<boolean>;
  draggingId: string | null; // id of the bar currently being dragged (lift class)
  dropSpan: { s: number; e: number } | null; // drop-target span when this is the target row
}) {
  const windowDays = dates.length;
  // Clamp the drop highlight to the visible window.
  const dropS = dropSpan ? Math.max(0, dropSpan.s) : 0;
  const dropE = dropSpan ? Math.min(windowDays, dropSpan.e) : 0;
  const showDrop = dropSpan != null && dropE > dropS;
  return (
    <div className="flex border-b border-[var(--app-border)]">
      <div
        style={{ width: LABEL }}
        className="flex shrink-0 items-center justify-center border-r border-[var(--app-border)] py-2 text-sm font-medium"
      >
        {label}
      </div>
      <div className="relative" style={{ width: windowDays * col, height: 38 }} data-room-id={roomId}>
        {/* drop-target highlight — the cell span where the dragged bar will land */}
        {showDrop && (
          <div
            className="pointer-events-none absolute top-1 z-[1] h-[30px] rounded-md"
            style={{
              left: dropS * col + 2,
              width: (dropE - dropS) * col - 4,
              background: "color-mix(in srgb, var(--app-accent) 16%, transparent)",
              border: "2px dashed var(--app-accent)",
              boxShadow: "inset 0 0 14px color-mix(in srgb, var(--app-accent) 28%, transparent)",
            }}
          />
        )}
        {/* empty-cell click targets + column separators */}
        <div className="absolute inset-0 flex">
          {dates.map((d) => {
            const dn = new Date(d + "T00:00:00Z").getUTCDay();
            const isWeekend = dn === 0 || dn === 6;
            return (
              <button
                key={d}
                data-day-cell={d}
                onClick={() => onCell(d)}
                style={{ width: col, background: d === today ? "color-mix(in srgb, var(--app-accent) 6%, transparent)" : isWeekend ? "color-mix(in srgb, var(--app-fg-muted) 5%, transparent)" : undefined }}
                className="h-full border-r border-[var(--app-border)] last:border-r-0 hover:bg-[var(--app-surface-2)]"
                aria-label={d}
              />
            );
          })}
        </div>
        {/* bars */}
        {bars.map(({ b, s, e }) => {
          const dimmed = matchedIds != null && !matchedIds.has(b.id);
          const bg = barBg(b);
          return (
            <button
              key={b.id}
              onPointerDown={(ev) => onBarPointerDown(ev, b)}
              onPointerEnter={(ev) => onBarHover(b, ev.clientX, ev.clientY)}
              onPointerMove={(ev) => onBarHover(b, ev.clientX, ev.clientY)}
              onPointerLeave={onBarLeave}
              onClick={() => {
                if (justDraggedRef.current) return; // suppress the click that ends a drag
                onBar(b);
              }}
              style={{
                left: s * col + 2,
                width: (e - s) * col - 4,
                background: bg,
                touchAction: "none",
                opacity: dimmed ? 0.25 : 1,
                // @ts-expect-error CSS var consumed by .app-cal-bar's frosted recipe
                "--bc": bg,
              }}
              className={`app-cal-bar absolute top-1 h-[30px] cursor-grab truncate px-2.5 text-left text-xs font-medium text-white shadow-sm active:cursor-grabbing${
                b.id === draggingId ? " app-cal-bar-dragging" : ""
              }`}
            >
              {b.guest_name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Rich hover tooltip ──
function BookingTooltip({
  b,
  x,
  y,
  s,
  currency,
  roomLabel,
}: {
  b: Booking;
  x: number;
  y: number;
  s: Record<string, string>;
  currency: string;
  roomLabel: string;
}) {
  const W = 250;
  const flipLeft = typeof window !== "undefined" && x + W + 24 > window.innerWidth;
  const left = flipLeft ? x - W - 12 : x + 16;
  const top = Math.max(8, y - 40);
  const type = (b.booking_type ?? "standard") as BookingType;
  const statusLabel =
    type === "monthly" ? s.typeMonthly
      : type === "blocked" ? s.typeBlocked
        : type === "oos" ? s.typeOOS
          : b.status === "checked_in" ? s.statusCheckedIn
            : b.status === "checked_out" ? s.statusCheckedOut
              : b.status === "pending" ? s.statusPending
                : s.statusConfirmed;
  const color = barBg(b);
  const nights = b.is_open_ended ? null : nightsBetween(b.check_in, b.check_out);
  return (
    <div
      className="app-popover pointer-events-none fixed z-[80] rounded-xl border border-[var(--app-border)] p-3 text-xs shadow-xl"
      style={{ left, top, width: W }}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
        <strong className="min-w-0 flex-1 truncate">{b.guest_name}</strong>
        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${color}22`, border: `1px solid ${color}55` }}>
          {statusLabel}
        </span>
      </div>
      <TipRow label={s.room} value={roomLabel} />
      <TipRow label={s.dates} value={`${b.check_in} → ${b.is_open_ended ? s.openEnded : b.check_out}${nights ? ` · ${nights} ${s.nights}` : ""}`} />
      {b.code && <TipRow label={s.res} value={b.reservation_no || b.code} />}
      {b.total_amount != null && <TipRow label={s.total} value={`${currency} ${Number(b.total_amount).toLocaleString()}`} />}
      {b.phone && <TipRow label={s.phone} value={b.phone} />}
      {b.notes && (
        <div className="mt-1.5 border-t border-[var(--app-border)] pt-1.5 text-[var(--app-fg-muted)]">
          {b.notes.length > 120 ? b.notes.slice(0, 117) + "…" : b.notes}
        </div>
      )}
    </div>
  );
}
function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 leading-relaxed">
      <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-[var(--app-fg-muted)]">{label}</span>
      <span className="min-w-0 flex-1 break-words">{value}</span>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${
        on ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)]" : "border-[var(--app-border)] text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-[var(--app-accent-fg)]" : "bg-[var(--app-fg-muted)]"}`} />
      {label}
    </button>
  );
}
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[var(--app-fg-muted)]">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2">
      <div className="text-[11px] text-[var(--app-fg-muted)]">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
function Chart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3">
      <div className="mb-2 text-[11px] text-[var(--app-fg-muted)]">{title}</div>
      {children}
    </div>
  );
}

// ── Today panel (right-side dock / mobile list) — ported from hotel-pms ──
function TodayPanel({
  today,
  arrivals,
  departures,
  inhouse,
  issues,
  roomLabel,
  onOpen,
  onCheckIn,
  onCheckOut,
  onConfirm,
  confirmingIds,
}: {
  today: string;
  arrivals: TpRow[];
  departures: TpRow[];
  inhouse: TpRow[];
  issues: TpRow[];
  roomLabel: (id: string | null) => string;
  onOpen: (b: Booking) => void;
  onCheckIn: (b: Booking) => void;
  onCheckOut: (b: Booking) => void;
  onConfirm: (b: Booking) => void;
  confirmingIds: Set<string>;
}) {
  const t = useAppT();
  const { locale } = useI18n();
  // Each section collapses past its cap; "+N more" expands it.
  const [exp, setExp] = useState({ arr: false, dep: false, ih: false, iss: false });
  const toggle = (k: keyof typeof exp) => setExp((e) => ({ ...e, [k]: !e[k] }));
  const slice = (arr: TpRow[], k: keyof typeof exp) => (exp[k] ? arr : arr.slice(0, TODAY_CAPS[k]));
  const ota = (b: TpRow) =>
    b.ota ||
    (b.source === "web"
      ? t("cal.web")
      : b.source === "walk_in"
        ? t("cal.walkIn")
        : t("cal.direct"));
  const dateLabel = new Date(today + "T00:00:00Z").toLocaleDateString(
    locale === "en" ? "en-GB" : "th-TH",
    { day: "2-digit", month: "short", timeZone: "UTC" },
  );

  // Plain function (not a nested component) so it never remounts on re-render.
  const moreBtn = (k: keyof typeof exp, total: number) =>
    total <= TODAY_CAPS[k] ? null : (
      <button
        onClick={() => toggle(k)}
        className="mt-1 w-full rounded-lg px-2 py-1 text-xs font-medium text-[var(--app-accent)] hover:bg-[var(--app-surface-2)]"
      >
        {exp[k] ? t("cal.showLess") : `+${total - TODAY_CAPS[k]} ${t("cal.more")}`}
      </button>
    );

  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{t("cal.today")}</h2>
        <span className="text-xs text-[var(--app-fg-muted)]">{dateLabel}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <TpStat label={t("cal.arriving")} value={arrivals.length} color="var(--app-accent)" />
        <TpStat label={t("cal.inhouse")} value={inhouse.length} color="var(--app-success)" />
        <TpStat label={t("cal.departing")} value={departures.length} color="#d97706" />
        <TpStat label={t("cal.issues")} value={issues.length} color="var(--app-danger)" />
      </div>

      <TpSection title={t("cal.arrivals")} count={arrivals.length} empty={t("cal.none")}>
        {slice(arrivals, "arr").map((b) => (
          <div key={b.id} className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-[var(--app-surface-2)]">
            <button onClick={() => onOpen(b)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <TpAvatar b={b} tint="var(--app-accent)" />
              <TpRowMain
                b={b}
                meta={`${roomLabel(b.room_id)} · ${ota(b)}${b.is_open_ended ? "" : ` · ${nightsBetween(b.check_in, b.check_out)}${t("cal.nightsShort")}`}`}
              />
            </button>
            {b.status === "pending" && (
              <TpConfirmButton b={b} busy={confirmingIds.has(b.id)} onConfirm={onConfirm} t={t} />
            )}
            {b.status !== "checked_in" && b.status !== "checked_out" && (
              <button
                onClick={() => onCheckIn(b)}
                className="flex-none rounded-lg px-2 py-1 text-xs font-medium text-[var(--app-accent)]"
                style={{ background: "color-mix(in srgb, var(--app-accent) 15%, transparent)" }}
              >
                {t("cal.checkIn")}
              </button>
            )}
          </div>
        ))}
        {moreBtn("arr", arrivals.length)}
      </TpSection>

      <TpSection title={t("cal.departures")} count={departures.length} empty={t("cal.none")}>
        {slice(departures, "dep").map((b) => (
          <div key={b.id} className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-[var(--app-surface-2)]">
            <button onClick={() => onOpen(b)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <TpAvatar b={b} tint="#d97706" />
              <TpRowMain b={b} meta={`${roomLabel(b.room_id)} · ${ota(b)}`} />
            </button>
            {b.status === "pending" && (
              <TpConfirmButton b={b} busy={confirmingIds.has(b.id)} onConfirm={onConfirm} t={t} />
            )}
            {b.status !== "checked_out" && (
              <button
                onClick={() => onCheckOut(b)}
                className="flex-none rounded-lg px-2 py-1 text-xs font-medium"
                style={{ background: "color-mix(in srgb, #d97706 16%, transparent)", color: "#d97706" }}
              >
                {t("cal.checkOut")}
              </button>
            )}
          </div>
        ))}
        {moreBtn("dep", departures.length)}
      </TpSection>

      <TpSection title={t("cal.inhouse")} count={inhouse.length} empty={t("cal.none")}>
        {slice(inhouse, "ih").map((b) => (
          <div key={b.id} className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-[var(--app-surface-2)]">
            <button
              onClick={() => onOpen(b)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <TpRoomPill>{roomLabel(b.room_id)}</TpRoomPill>
              <TpRowMain
                b={b}
                meta={`${b.booking_type === "monthly" ? t("cal.monthly") : ota(b)}${b.is_open_ended ? "" : ` · → ${b.check_out.slice(5)}`}`}
              />
            </button>
            {b.status === "pending" && (
              <TpConfirmButton b={b} busy={confirmingIds.has(b.id)} onConfirm={onConfirm} t={t} />
            )}
          </div>
        ))}
        {moreBtn("ih", inhouse.length)}
      </TpSection>

      {issues.length > 0 && (
        <TpSection title={t("cal.issues")} count={issues.length} empty={t("cal.none")}>
          {slice(issues, "iss").map((b) => (
            <button
              key={b.id}
              onClick={() => onOpen(b)}
              className="flex w-full items-center gap-2 rounded-xl px-1.5 py-1.5 text-left hover:bg-[var(--app-surface-2)]"
            >
              <TpRoomPill danger>{roomLabel(b.room_id)}</TpRoomPill>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{b.issue_type || "OOS"}</div>
                <div className="truncate text-xs text-[var(--app-fg-muted)]">{b.issue_detail || "—"}</div>
              </div>
            </button>
          ))}
          {moreBtn("iss", issues.length)}
        </TpSection>
      )}
    </aside>
  );
}

function TpStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="app-surface rounded-xl border border-[var(--app-border)] px-2 py-2 text-center">
      <div className="text-lg font-bold leading-none" style={{ color }}>{value}</div>
      <div className="mt-1 truncate text-[10px] text-[var(--app-fg-muted)]">{label}</div>
    </div>
  );
}
function TpSection({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <div className="app-surface rounded-2xl border border-[var(--app-border)] p-3">
      <div className="mb-1.5 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--app-fg-muted)]">
        {title}
        <span className="ml-auto rounded-full bg-[var(--app-surface-2)] px-1.5 py-0.5 text-[10px] normal-case">{count}</span>
      </div>
      {count === 0 ? (
        <p className="px-1 py-1 text-sm text-[var(--app-fg-muted)]">{empty}</p>
      ) : (
        <div className="space-y-0.5">{children}</div>
      )}
    </div>
  );
}
function TpAvatar({ b, tint }: { b: TpRow; tint: string }) {
  const ch = (b.guest_first_name?.[0] || b.guest_name?.[0] || "?").toUpperCase();
  return (
    <div
      className="grid h-8 w-8 flex-none place-items-center rounded-full text-xs font-semibold"
      style={{ background: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint }}
    >
      {ch}
    </div>
  );
}
function TpRowMain({ b, meta }: { b: TpRow; meta: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium">
        {b.guest_name || "—"}
        {b._groupSize > 1 && <span className="ml-1 text-xs text-[var(--app-fg-muted)]">·{b._groupSize}</span>}
      </div>
      <div className="truncate text-xs text-[var(--app-fg-muted)]">{meta}</div>
    </div>
  );
}
// Inline "Confirm" quick action for pending bookings (mainly web-widget
// bookings awaiting staff confirmation) — flips status: pending → confirmed
// via the same setStatusAction used by BookingModal's quickStatus(), so
// staff don't have to open the full modal just to accept a booking.
function TpConfirmButton({
  b,
  busy,
  onConfirm,
  t,
}: {
  b: Booking;
  busy: boolean;
  onConfirm: (b: Booking) => void;
  t: (key: string) => string;
}) {
  return (
    <button
      onClick={() => onConfirm(b)}
      disabled={busy}
      aria-busy={busy}
      className="flex-none rounded-lg px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: "color-mix(in srgb, #d97706 16%, transparent)", color: "#d97706" }}
    >
      {busy ? t("cal.confirming") : t("cal.confirm")}
    </button>
  );
}
function TpRoomPill({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div
      className="grid h-8 min-w-[2.25rem] flex-none place-items-center rounded-lg px-1.5 text-xs font-semibold"
      style={
        danger
          ? { background: "color-mix(in srgb, var(--app-danger) 16%, transparent)", color: "var(--app-danger)" }
          : { background: "var(--app-surface-2)" }
      }
    >
      {children}
    </div>
  );
}
