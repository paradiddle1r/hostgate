"use client";

// Monthly-rentals landing. Rooms grouped by floor, each card colour-coded by
// the monthly tenant occupying it: occupied (checked-in), reserved
// (pending/confirmed), or vacant. Vacant cards open the "add monthly tenant"
// flow; occupied/reserved cards link to the tenant detail page. KPI strip +
// quick links to the batch-bills / payments / setup sub-routes.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Plus,
  ChevronRight,
  Users,
  Receipt,
  Wallet,
  Settings2,
  DoorOpen,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { MonthlyTenantRow } from "@/lib/db/rentals";
import type { Booking } from "@/lib/db/bookings";
import type { Room } from "@/lib/db/rooms";
import { isOpenEnded } from "@/lib/rental-calc";
import { useToast } from "@/components/app/ui/Toast";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import { saveTenantConfig } from "@/app/app/rentals/actions";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "เช่ารายเดือน",
    sub: "ห้องเช่ารายเดือน จัดกลุ่มตามชั้น",
    add: "เพิ่มผู้เช่ารายเดือน",
    activeTenants: "ผู้เช่าที่ใช้งาน",
    rentRoll: "ค่าเช่ารวมต่อเดือน",
    vacantCount: "ห้องว่าง",
    batchBills: "ออกบิลรายเดือน",
    payments: "การชำระเงิน",
    setup: "ตั้งค่าห้องรายเดือน",
    floor: "ชั้น",
    room: "ห้อง",
    occupied: "มีผู้เช่า",
    reserved: "จอง",
    vacant: "ว่าง",
    people: "คน",
    openEnded: "ไม่กำหนด",
    until: "ถึง",
    noRooms: "ยังไม่มีห้อง — เพิ่มห้องในหน้าตั้งค่าก่อน",
    selectBooking: "เลือกการจอง",
    monthlyRent: "ค่าเช่าต่อเดือน",
    deposit: "เงินมัดจำ",
    advanceRent: "ค่าเช่าล่วงหน้า",
    save: "บันทึก",
    cancel: "ยกเลิก",
    saved: "บันทึกแล้ว",
    needBooking: "เลือกการจองก่อน",
    needRent: "ใส่ค่าเช่าต่อเดือน",
    noCandidates: "สร้างการจองในปฏิทินก่อน",
  },
  en: {
    title: "Monthly rentals",
    sub: "Monthly rooms, grouped by floor.",
    add: "Add monthly tenant",
    activeTenants: "Active tenants",
    rentRoll: "Monthly rent roll",
    vacantCount: "Vacant rooms",
    batchBills: "Batch billing",
    payments: "Payments",
    setup: "Monthly setup",
    floor: "Floor",
    room: "Room",
    occupied: "Occupied",
    reserved: "Reserved",
    vacant: "Vacant",
    people: "people",
    openEnded: "Open-ended",
    until: "until",
    noRooms: "No rooms yet — add rooms in setup first.",
    selectBooking: "Select a booking",
    monthlyRent: "Monthly rent",
    deposit: "Deposit",
    advanceRent: "Advance rent",
    save: "Save",
    cancel: "Cancel",
    saved: "Saved",
    needBooking: "Pick a booking first",
    needRent: "Enter a monthly rent",
    noCandidates: "Create a booking on the calendar first",
  },
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

type CardState = "occupied" | "reserved" | "vacant";

const STATE_STYLE: Record<CardState, { dot: string; chip: string; ring: string }> = {
  occupied: {
    dot: "#16a34a",
    chip: "rgba(22,163,74,0.14)",
    ring: "color-mix(in srgb, #16a34a 35%, transparent)",
  },
  reserved: {
    dot: "#b45309",
    chip: "rgba(180,83,9,0.14)",
    ring: "color-mix(in srgb, #b45309 35%, transparent)",
  },
  vacant: {
    dot: "var(--app-fg-muted)",
    chip: "var(--app-surface-2)",
    ring: "var(--app-border)",
  },
};

function bookingState(b: Booking | null): CardState {
  if (!b) return "vacant";
  if (b.status === "checked_in") return "occupied";
  if (b.status === "pending" || b.status === "confirmed") return "reserved";
  return "vacant";
}

export default function RentalsClient({
  tenants,
  candidates,
  rooms,
  currency,
}: {
  tenants: MonthlyTenantRow[];
  candidates: Booking[];
  rooms: Room[];
  currency: string;
}) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const money = (v: number) => `${currency} ${Number(v || 0).toLocaleString()}`;

  // room_id → its active monthly tenant row (pick the first non-checked-out).
  const tenantByRoom = useMemo(() => {
    const m = new Map<string, MonthlyTenantRow>();
    for (const row of tenants) {
      const rid = row.booking.room_id;
      if (!rid) continue;
      if (row.booking.status === "checked_out" || row.booking.status === "cancelled") continue;
      if (!m.has(rid)) m.set(rid, row);
    }
    return m;
  }, [tenants]);

  const floors = useMemo(() => {
    const by = new Map<number, Room[]>();
    for (const r of rooms) {
      if (!by.has(r.floor)) by.set(r.floor, []);
      by.get(r.floor)!.push(r);
    }
    return [...by.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([floor, rs]) => ({
        floor,
        rooms: rs.sort((a, b) => String(a.number).localeCompare(String(b.number))),
      }));
  }, [rooms]);

  const stats = useMemo(() => {
    let occupied = 0;
    let vacant = 0;
    let rentRoll = 0;
    for (const r of rooms) {
      const row = tenantByRoom.get(r.id) ?? null;
      const st = bookingState(row ? row.booking : null);
      if (st === "vacant") vacant++;
      else occupied++;
      if (row) rentRoll += Number(row.tenant.monthly_rent) || 0;
    }
    return { active: tenantByRoom.size, vacant, rentRoll, occupied };
  }, [rooms, tenantByRoom]);

  // ── add monthly tenant ───────────────────────────────────────────────────
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [rent, setRent] = useState<number | "">("");
  const [deposit, setDeposit] = useState<number | "">("");
  const [advance, setAdvance] = useState<number | "">("");

  const roomNumber = useMemo(() => {
    const map = new Map(rooms.map((r) => [r.id, r.number]));
    return (id: string | null) => (id ? map.get(id) ?? null : null);
  }, [rooms]);

  function openAdd(preferRoomId?: string | null) {
    const preferred = preferRoomId
      ? candidates.find((b) => b.room_id === preferRoomId)
      : null;
    setBookingId(preferred?.id ?? candidates[0]?.id ?? "");
    setRent("");
    setDeposit("");
    setAdvance("");
    setAdding(true);
  }

  async function save() {
    if (!bookingId) return toast.error(s("needBooking"));
    if (rent === "" || Number(rent) <= 0) return toast.error(s("needRent"));
    setSaving(true);
    const input: Parameters<typeof saveTenantConfig>[1] = { monthly_rent: Number(rent) };
    if (deposit !== "") input.deposit = Number(deposit);
    if (advance !== "") input.advance_rent = Number(advance);
    const res = await saveTenantConfig(bookingId, input);
    setSaving(false);
    if (res.ok) {
      toast.success(s("saved"));
      router.push("/app/rentals/" + bookingId);
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const candidateLabel = (b: Booking) => {
    const num = roomNumber(b.room_id);
    const roomPart = num ? ` · ${s("room")} ${num}` : "";
    return `${b.guest_name}${roomPart} · ${b.check_in}→${b.check_out}`;
  };

  const quickLink = (href: string, icon: React.ReactNode, text: string) => (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="app-surface inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--app-surface-2)]"
    >
      {icon} {text}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1500px] pb-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
          <p className="text-sm text-[var(--app-fg-muted)]">{s("sub")}</p>
        </div>
        <Button onClick={() => openAdd()}>
          <Plus size={16} /> {s("add")}
        </Button>
      </div>

      {/* quick links to the sub-routes */}
      <div className="mb-5 flex flex-wrap gap-2">
        {quickLink("/app/rentals/bills", <Receipt size={15} />, s("batchBills"))}
        {quickLink("/app/rentals/payments", <Wallet size={15} />, s("payments"))}
        {quickLink("/app/rentals/setup", <Settings2 size={15} />, s("setup"))}
      </div>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
          <div className="text-xs font-medium text-[var(--app-fg-muted)]">{s("activeTenants")}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{stats.active}</div>
        </div>
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
          <div className="text-xs font-medium text-[var(--app-fg-muted)]">{s("rentRoll")}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{money(stats.rentRoll)}</div>
        </div>
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
          <div className="text-xs font-medium text-[var(--app-fg-muted)]">{s("vacantCount")}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{stats.vacant}</div>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)] px-6 py-12 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--app-surface-2)] text-[var(--app-fg-muted)]">
            <DoorOpen size={22} />
          </div>
          <p className="text-sm font-semibold">{s("noRooms")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {floors.map(({ floor, rooms: rs }) => (
            <div key={floor}>
              <div className="mb-2.5 flex items-baseline gap-2">
                <h2 className="text-sm font-semibold">
                  {s("floor")} {floor}
                </h2>
                <span className="text-xs text-[var(--app-fg-muted)]">{rs.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {rs.map((r) => {
                  const row = tenantByRoom.get(r.id) ?? null;
                  const st = bookingState(row ? row.booking : null);
                  const style = STATE_STYLE[st];
                  const clickable = st !== "vacant" && row;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        clickable
                          ? router.push("/app/rentals/" + row!.booking.id)
                          : openAdd(r.id)
                      }
                      className="app-surface group flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors hover:bg-[var(--app-surface-2)]"
                      style={{ borderColor: style.ring }}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-lg font-semibold tracking-tight">{r.number}</span>
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: style.chip }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: style.dot }}
                          />
                          {s(st)}
                        </span>
                      </div>
                      {row ? (
                        <>
                          <div className="min-w-0 truncate text-sm font-medium">
                            {row.booking.guest_name}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--app-fg-muted)]">
                            <span className="font-medium text-[var(--app-fg)]">
                              {money(row.tenant.monthly_rent)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users size={12} /> {row.tenant.occupants}
                            </span>
                          </div>
                          <div className="mt-auto flex w-full items-center justify-between pt-1 text-[11px] text-[var(--app-fg-muted)]">
                            <span>
                              {isOpenEnded(row.booking.check_out)
                                ? s("openEnded")
                                : `${s("until")} ${row.booking.check_out}`}
                            </span>
                            <ChevronRight
                              size={15}
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="mt-auto inline-flex items-center gap-1.5 pt-2 text-xs text-[var(--app-fg-muted)]">
                          <Plus size={13} /> {s("add")}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* add monthly tenant */}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={s("add")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              {s("cancel")}
            </Button>
            <Button onClick={save} loading={saving} disabled={candidates.length === 0}>
              {s("save")}
            </Button>
          </>
        }
      >
        {candidates.length === 0 ? (
          <p className="text-sm text-[var(--app-fg-muted)]">{s("noCandidates")}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={label}>{s("selectBooking")}</label>
              <select
                className={field}
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
              >
                {candidates.map((b) => (
                  <option key={b.id} value={b.id}>
                    {candidateLabel(b)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>
                {s("monthlyRent")} ({currency})
              </label>
              <input
                type="number"
                min={0}
                className={field}
                value={rent}
                onChange={(e) => setRent(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>
                  {s("deposit")} ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={label}>
                  {s("advanceRent")} ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={advance}
                  onChange={(e) => setAdvance(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
