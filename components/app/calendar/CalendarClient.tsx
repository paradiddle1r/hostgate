"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, BedDouble, LogIn, LogOut, ClipboardPaste, Coins } from "lucide-react";
import type { Room } from "@/lib/db/rooms";
import type { Booking, BookingStatus } from "@/lib/db/bookings";
import type { RateMap } from "@/lib/db/rates";
import type { RatePlan } from "@/lib/db/rate-plans";
import { stayTotal } from "@/lib/booking-calc";
import { useAppT } from "@/lib/app-i18n";
import { useToast } from "@/components/app/ui/Toast";
import EmptyState from "@/components/app/ui/EmptyState";
import Button from "@/components/app/ui/Button";
import BookingModal, { ModalSeed } from "./BookingModal";
import PasteImportModal from "./PasteImportModal";
import BulkRateModal from "./BulkRateModal";
import { setStatusAction, updateBookingAction } from "@/app/app/calendar/actions";

export interface RoomTypeBrief {
  id: string;
  name: string;
  daily_rate: number | null;
}

const COL = 46; // px per day column
const LABEL = 60; // px room-label column

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

const STATUS_BG: Record<BookingStatus, string> = {
  pending: "#d97706",
  confirmed: "var(--app-accent)",
  checked_in: "var(--app-success)",
  checked_out: "#6b7280",
  cancelled: "transparent",
};

export default function CalendarClient({
  from,
  windowDays,
  today,
  rooms,
  roomTypes,
  bookings,
  rates,
  plans,
  currency,
}: {
  from: string;
  windowDays: number;
  today: string;
  rooms: Room[];
  roomTypes: RoomTypeBrief[];
  bookings: Booking[];
  rates: RateMap;
  plans: RatePlan[];
  currency: string;
}) {
  const t = useAppT();
  const toast = useToast();
  const router = useRouter();
  const [seed, setSeed] = useState<ModalSeed | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);

  const dates = useMemo(
    () => Array.from({ length: windowDays }, (_, i) => addDays(from, i)),
    [from, windowDays]
  );
  const live = bookings.filter((b) => b.status !== "cancelled");

  // ── drag-to-move ──────────────────────────────────────────────────────────
  // Day shift = round(dx / COL); target room = elementFromPoint → data-room-id
  // at drop. Commit-on-drop; the HG-BOOK-409 conflict trigger + refresh revert
  // an illegal move. A movement threshold distinguishes drag from click.
  const [dragB, setDragB] = useState<Booking | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [dragMoved, setDragMoved] = useState(false);
  const startRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const justDraggedRef = useRef(false);

  function recomputeTotal(roomId: string | null, ci: string, co: string): number | null {
    const rtId = rooms.find((r) => r.id === roomId)?.room_type_id ?? null;
    const base = roomTypes.find((rt) => rt.id === rtId)?.daily_rate ?? 0;
    const rm = rtId ? rates[rtId] ?? {} : {};
    return stayTotal(rm, Number(base) || 0, ci, co).total || null;
  }

  function onBarPointerDown(e: React.PointerEvent, b: Booking) {
    if (e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    setDragMoved(false);
    setGhost({ x: e.clientX, y: e.clientY });
    setDragB(b);
  }

  useEffect(() => {
    if (!dragB) return;
    document.body.style.userSelect = "none";

    function move(e: PointerEvent) {
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (!movedRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        movedRef.current = true;
        setDragMoved(true);
      }
      setGhost({ x: e.clientX, y: e.clientY });
    }

    async function up(e: PointerEvent) {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      const b = dragB!;
      const moved = movedRef.current;
      setDragB(null);
      setGhost(null);
      setDragMoved(false);
      if (!moved) return;
      justDraggedRef.current = true;
      setTimeout(() => (justDraggedRef.current = false), 0);

      const dx = e.clientX - startRef.current.x;
      const deltaDays = Math.round(dx / COL);
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const rowEl = el?.closest("[data-room-id]") as HTMLElement | null;
      const newRoomId = rowEl ? rowEl.getAttribute("data-room-id") || null : b.room_id;
      const newCI = deltaDays ? addDays(b.check_in, deltaDays) : b.check_in;
      const newCO = deltaDays ? addDays(b.check_out, deltaDays) : b.check_out;
      if (newRoomId === b.room_id && deltaDays === 0) return;

      const roomTypeId = rooms.find((r) => r.id === newRoomId)?.room_type_id ?? null;
      const res = await updateBookingAction(b.id, {
        room_id: newRoomId,
        room_type_id: roomTypeId,
        check_in: newCI,
        check_out: newCO,
        total_amount: recomputeTotal(newRoomId, newCI, newCO),
      });
      if (res.ok) toast.success(t("cal.saved"));
      else toast.error(`${res.code} · ${res.message}`);
      router.refresh();
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragB]);

  function nav(deltaDays: number) {
    router.push(`/app/calendar?from=${addDays(from, deltaDays)}`);
  }
  function goToday() {
    router.push(`/app/calendar?from=${today}`);
  }

  async function quick(b: Booking, status: BookingStatus) {
    const res = await setStatusAction(b.id, status);
    if (res.ok) {
      toast.success(t("cal.saved"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  // Today panel buckets
  const arrivals = live.filter((b) => b.check_in === today);
  const departures = live.filter((b) => b.check_out === today);
  const inhouse = live.filter((b) => b.check_in <= today && b.check_out > today);

  const roomLabel = (id: string | null) => rooms.find((r) => r.id === id)?.number ?? t("cal.unassigned");

  if (rooms.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <EmptyState
          icon={<BedDouble size={22} />}
          title={t("cal.noRooms")}
          hint={t("cal.noRoomsHint")}
          action={
            <Button onClick={() => router.push("/app/rooms")}>{t("nav.rooms")}</Button>
          }
        />
      </div>
    );
  }

  const fmtCol = (iso: string) => {
    const d = new Date(iso + "T00:00:00Z");
    return { dow: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), day: d.getUTCDate() };
  };

  // Bars for one room within the window.
  const barsFor = (roomId: string | null) =>
    live
      .filter((b) => b.room_id === roomId)
      .map((b) => {
        const s = Math.max(0, dayIdx(from, b.check_in));
        const e = Math.min(windowDays, dayIdx(from, b.check_out));
        return { b, s, e };
      })
      .filter((x) => x.e > x.s);

  const unassigned = barsFor(null);

  return (
    <div className="mx-auto max-w-6xl">
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
        <div className="ml-auto flex items-center gap-2">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* ── Grid (desktop) ── */}
        <div className="hidden overflow-x-auto rounded-2xl border border-[var(--app-border)] lg:block">
          <div style={{ width: LABEL + windowDays * COL }}>
            {/* date header */}
            <div className="flex border-b border-[var(--app-border)] bg-[var(--app-surface-2)]">
              <div style={{ width: LABEL }} className="shrink-0" />
              {dates.map((d) => {
                const { dow, day } = fmtCol(d);
                const isToday = d === today;
                return (
                  <div
                    key={d}
                    style={{ width: COL }}
                    className={`shrink-0 py-1.5 text-center text-[11px] ${isToday ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]" : "text-[var(--app-fg-muted)]"}`}
                  >
                    <div>{dow}</div>
                    <div className="font-semibold">{day}</div>
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
                draggingId={dragMoved ? dragB?.id ?? null : null}
                onCell={() => {}}
                onBar={(b) => setSeed({ booking: b })}
                onBarPointerDown={onBarPointerDown}
                justDraggedRef={justDraggedRef}
              />
            )}

            {/* room rows */}
            {rooms.map((r) => (
              <Row
                key={r.id}
                roomId={r.id}
                label={r.number}
                bars={barsFor(r.id)}
                dates={dates}
                draggingId={dragMoved ? dragB?.id ?? null : null}
                onCell={(date) => setSeed({ roomId: r.id, checkIn: date, checkOut: addDays(date, 1) })}
                onBar={(b) => setSeed({ booking: b })}
                onBarPointerDown={onBarPointerDown}
                justDraggedRef={justDraggedRef}
              />
            ))}
          </div>
        </div>

        {/* ── Today panel / mobile list ── */}
        <aside className="space-y-4">
          <Panel title={`${t("cal.arrivals")} (${arrivals.length})`}>
            {arrivals.length === 0 && <Muted>{t("cal.none")}</Muted>}
            {arrivals.map((b) => (
              <PanelRow key={b.id} onClick={() => setSeed({ booking: b })} name={b.guest_name} sub={roomLabel(b.room_id)}
                action={
                  b.status !== "checked_in" ? (
                    <IconBtn label={t("cal.markCheckedIn")} onClick={(e) => { e.stopPropagation(); quick(b, "checked_in"); }}>
                      <LogIn size={15} />
                    </IconBtn>
                  ) : null
                }
              />
            ))}
          </Panel>

          <Panel title={`${t("cal.departures")} (${departures.length})`}>
            {departures.length === 0 && <Muted>{t("cal.none")}</Muted>}
            {departures.map((b) => (
              <PanelRow key={b.id} onClick={() => setSeed({ booking: b })} name={b.guest_name} sub={roomLabel(b.room_id)}
                action={
                  b.status !== "checked_out" ? (
                    <IconBtn label={t("cal.markCheckedOut")} onClick={(e) => { e.stopPropagation(); quick(b, "checked_out"); }}>
                      <LogOut size={15} />
                    </IconBtn>
                  ) : null
                }
              />
            ))}
          </Panel>

          <Panel title={`${t("cal.inhouse")} (${inhouse.length})`}>
            {inhouse.length === 0 && <Muted>{t("cal.none")}</Muted>}
            {inhouse.map((b) => (
              <PanelRow key={b.id} onClick={() => setSeed({ booking: b })} name={b.guest_name} sub={roomLabel(b.room_id)} />
            ))}
          </Panel>
        </aside>
      </div>

      {/* drag ghost — follows the pointer, must not catch elementFromPoint */}
      {dragB && ghost && dragMoved && (
        <div
          className="pointer-events-none fixed z-[60] truncate rounded-md px-2.5 py-1 text-xs font-medium text-white shadow-lg"
          style={{
            left: ghost.x + 10,
            top: ghost.y - 12,
            maxWidth: 180,
            background: STATUS_BG[dragB.status] === "transparent" ? "var(--app-accent)" : STATUS_BG[dragB.status],
          }}
        >
          {dragB.guest_name}
        </div>
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
    </div>
  );
}

// ── Grid row: sticky label + day cells + absolute bars ──
function Row({
  roomId,
  label,
  bars,
  dates,
  draggingId,
  onCell,
  onBar,
  onBarPointerDown,
  justDraggedRef,
}: {
  roomId: string; // "" for the unassigned lane
  label: string;
  bars: { b: Booking; s: number; e: number }[];
  dates: string[];
  draggingId: string | null;
  onCell: (date: string) => void;
  onBar: (b: Booking) => void;
  onBarPointerDown: (e: React.PointerEvent, b: Booking) => void;
  justDraggedRef: React.MutableRefObject<boolean>;
}) {
  const windowDays = dates.length;
  return (
    <div className="flex border-b border-[var(--app-border)]">
      <div
        style={{ width: LABEL }}
        className="flex shrink-0 items-center justify-center border-r border-[var(--app-border)] py-2 text-sm font-medium"
      >
        {label}
      </div>
      <div className="relative" style={{ width: windowDays * COL, height: 38 }} data-room-id={roomId}>
        {/* empty-cell click targets + column separators */}
        <div className="absolute inset-0 flex">
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => onCell(d)}
              style={{ width: COL }}
              className="h-full border-r border-[var(--app-border)] last:border-r-0 hover:bg-[var(--app-surface-2)]"
              aria-label={d}
            />
          ))}
        </div>
        {/* bars */}
        {bars.map(({ b, s, e }) => (
          <button
            key={b.id}
            onPointerDown={(ev) => onBarPointerDown(ev, b)}
            onClick={() => {
              if (justDraggedRef.current) return; // suppress the click that ends a drag
              onBar(b);
            }}
            title={b.guest_name}
            style={{
              left: s * COL + 2,
              width: (e - s) * COL - 4,
              background: STATUS_BG[b.status],
              touchAction: "none",
              opacity: draggingId === b.id ? 0.4 : 1,
              // @ts-expect-error CSS var consumed by .app-cal-bar's frosted recipe
              "--bc": STATUS_BG[b.status],
            }}
            className="app-cal-bar absolute top-1 h-[30px] cursor-grab truncate px-2.5 text-left text-xs font-medium text-white shadow-sm active:cursor-grabbing"
          >
            {b.guest_name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function PanelRow({
  name,
  sub,
  action,
  onClick,
}: {
  name: string;
  sub: string;
  action?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--app-surface-2)]"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-xs text-[var(--app-fg-muted)]">{sub}</div>
      </div>
      {action}
    </div>
  );
}
function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="rounded-lg border border-[var(--app-border)] p-1.5 text-[var(--app-fg-muted)] hover:text-[var(--app-accent)]">
      {children}
    </button>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-1 text-sm text-[var(--app-fg-muted)]">{children}</p>;
}
