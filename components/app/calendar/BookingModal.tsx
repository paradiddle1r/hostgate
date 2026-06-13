"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import type { Room } from "@/lib/db/rooms";
import type { Booking, BookingInput, BookingStatus, BookingType } from "@/lib/db/bookings";
import type { RateMap } from "@/lib/db/rates";
import { stayTotal } from "@/lib/booking-calc";
import { useToast } from "@/components/app/ui/Toast";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import {
  createBookingAction,
  updateBookingAction,
  setStatusAction,
  bookingsInRangeAction,
} from "@/app/app/calendar/actions";
import type { RoomTypeBrief } from "./CalendarClient";

// Extra bed ("เสริมเตียง") — 50% of room total, floored at 250.
const EXTRA_BED_MIN = 250;
const EXTRA_BED_RATE = 0.5;

const STATUSES: BookingStatus[] = ["pending", "confirmed", "checked_in", "checked_out", "cancelled"];
const ISSUE_TYPES = ["water", "electric", "aircon", "plumbing", "furniture", "other"];
const OTA_OPTIONS = ["Agoda", "Booking.com", "Expedia", "Airbnb", "Traveloka", "Trip.com", "Direct booking", "Walk-in"];
const PAYMENT_OPTIONS = ["prepaid-ota", "cash", "transfer", "card", "promptpay"];

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    newBooking: "จองใหม่",
    editBooking: "แก้ไขการจอง",
    blockRoom: "ปิดห้อง",
    markOos: "แจ้งห้องเสีย",
    bookingType: "ประเภท",
    typeStandard: "ปกติ",
    typeBlocked: "ปิดห้อง",
    typeOos: "ห้องเสีย",
    stayDetails: "รายละเอียดการเข้าพัก",
    blockDetails: "รายละเอียดการปิดห้อง",
    room: "ห้อง",
    pickRoom: "เลือกห้อง…",
    checkInDate: "วันเข้า",
    checkOutDate: "วันออก",
    startDate: "เริ่มวันที่",
    endDate: "ถึงวันที่",
    issueType: "ประเภทปัญหา",
    issueDetails: "รายละเอียดปัญหา",
    reasonNotes: "เหตุผล / หมายเหตุ",
    issuePlaceholder: "เช่น แอร์เสีย รอช่าง",
    reasonPlaceholder: "เช่น ปิดปรับปรุง",
    bookingRef: "ข้อมูลการจอง",
    resNo: "เลขที่จอง",
    otaSrc: "ช่องทาง (OTA)",
    selectDot: "เลือก…",
    bookedDate: "วันที่จอง",
    payMethod: "วิธีชำระ",
    totalAmt: "ยอดรวม",
    status: "สถานะ",
    extraBedLabel: "เสริมเตียง (50% ของราคาห้อง, ขั้นต่ำ 250฿)",
    extraBed: "เสริมเตียง",
    noExtraBed: "ไม่มี",
    chargeOverride: "ราคาเสริมเตียง (เว้นว่าง = อัตโนมัติ)",
    grandTotal: "ยอดรวมทั้งสิ้น",
    amountPaid: "ชำระแล้ว",
    depositDate: "วันที่ชำระมัดจำ",
    depositMethod: "วิธีชำระมัดจำ",
    outstanding: "ยอดคงค้าง",
    noDeposit: "ยังไม่ได้ชำระ",
    guestInfo: "ข้อมูลผู้เข้าพัก",
    firstName: "ชื่อ",
    lastName: "นามสกุล",
    thaiName: "ชื่อภาษาไทย",
    phone: "โทรศัพท์",
    plate: "ทะเบียนรถ",
    notes: "หมายเหตุ",
    specialRq: "คำขอพิเศษ",
    save: "บันทึก",
    update: "อัปเดต",
    cancel: "ยกเลิก",
    saved: "บันทึกการจองแล้ว",
    needRoomDates: "กรุณาเลือกห้องและวันที่",
    needFirstName: "กรุณาใส่ชื่อผู้เข้าพัก",
    nights: "คืน",
    total: "ยอดรวม",
    markCheckedIn: "เช็คอิน",
    markCheckedOut: "เช็คเอาต์",
    cancelBooking: "ยกเลิกการจอง",
  },
  en: {
    newBooking: "New booking",
    editBooking: "Edit booking",
    blockRoom: "Block room",
    markOos: "Mark out of service",
    bookingType: "Type",
    typeStandard: "Standard",
    typeBlocked: "Block",
    typeOos: "OOS",
    stayDetails: "Stay details",
    blockDetails: "Block details",
    room: "Room",
    pickRoom: "Pick a room…",
    checkInDate: "Check-in",
    checkOutDate: "Check-out",
    startDate: "Start date",
    endDate: "End date",
    issueType: "Issue type",
    issueDetails: "Issue details",
    reasonNotes: "Reason / notes",
    issuePlaceholder: "e.g. aircon broken, waiting on technician",
    reasonPlaceholder: "e.g. closed for renovation",
    bookingRef: "Booking reference",
    resNo: "Reservation no.",
    otaSrc: "Source (OTA)",
    selectDot: "Select…",
    bookedDate: "Booked date",
    payMethod: "Payment method",
    totalAmt: "Total amount",
    status: "Status",
    extraBedLabel: "Extra bed (50% of room, min ฿250)",
    extraBed: "Extra bed",
    noExtraBed: "No extra bed",
    chargeOverride: "Charge override (blank = auto)",
    grandTotal: "Grand total",
    amountPaid: "Amount paid",
    depositDate: "Deposit date",
    depositMethod: "Deposit method",
    outstanding: "Outstanding",
    noDeposit: "No deposit",
    guestInfo: "Guest info",
    firstName: "First name",
    lastName: "Last name",
    thaiName: "Thai name",
    phone: "Phone",
    plate: "Car plate",
    notes: "Notes",
    specialRq: "Special requests",
    save: "Save",
    update: "Update",
    cancel: "Cancel",
    saved: "Booking saved",
    needRoomDates: "Pick a room and dates",
    needFirstName: "Enter the guest's first name",
    nights: "nights",
    total: "Total",
    markCheckedIn: "Check in",
    markCheckedOut: "Check out",
    cancelBooking: "Cancel booking",
  },
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";
const sectionTitle = "mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-fg-muted)]";

export interface ModalSeed {
  booking?: Booking;
  roomId?: string | null;
  checkIn?: string;
  checkOut?: string;
  // Prefills from paste-import (a new booking seeded from pasted OTA text).
  guestName?: string;
  phone?: string;
  ota?: string;
  reservationNo?: string;
}

export default function BookingModal({
  seed,
  rooms,
  roomTypes,
  rates,
  currency,
  onClose,
  // Optional: all bookings already in the calendar window. When absent the
  // modal fetches its own window via bookingsInRangeAction so the occupied-room
  // filter still works (the calendar grid domain doesn't pass this).
  allBookings,
}: {
  seed: ModalSeed;
  rooms: Room[];
  roomTypes: RoomTypeBrief[];
  rates: RateMap;
  currency: string;
  onClose: () => void;
  allBookings?: Booking[];
}) {
  const { locale: raw } = useI18n();
  const s = STR[raw === "en" ? "en" : "th"];
  const toast = useToast();
  const router = useRouter();
  const editing = !!seed.booking;
  const b = seed.booking;

  // Split a legacy single guest_name seed into first/last when the structured
  // fields are absent (paste-import / older rows).
  const seedFirst = b?.guest_first_name ?? (seed.guestName ? seed.guestName.split(" ")[0] : "");
  const seedLast =
    b?.guest_last_name ?? (seed.guestName ? seed.guestName.split(" ").slice(1).join(" ") : "");

  const [form, setForm] = useState({
    booking_type: (b?.booking_type ?? "standard") as BookingType,
    room_id: b?.room_id ?? seed.roomId ?? "",
    guest_first_name: seedFirst,
    guest_last_name: seedLast,
    thai_name: b?.thai_name ?? "",
    phone: b?.phone ?? seed.phone ?? "",
    car_plate: b?.car_plate ?? "",
    check_in: b?.check_in ?? seed.checkIn ?? "",
    check_out: b?.check_out ?? seed.checkOut ?? "",
    adults: b?.adults ?? 1,
    children: b?.children ?? 0,
    status: (b?.status ?? "confirmed") as BookingStatus,
    notes: b?.notes ?? "",
    // OTA / reference
    reservation_no: b?.reservation_no ?? seed.reservationNo ?? "",
    ota: b?.ota ?? seed.ota ?? "",
    booked_date: b?.booked_date ?? "",
    payment_method: b?.payment_method ?? "prepaid-ota",
    // Financials. Normalize nullable numerics to "" so inputs stay controlled.
    total_amount: b?.total_amount != null ? String(b.total_amount) : "",
    amount_paid: b?.amount_paid != null && b.amount_paid !== 0 ? String(b.amount_paid) : "",
    deposit_date: b?.deposit_date ?? "",
    deposit_method: b?.deposit_method ?? "",
    // Extra bed
    extra_bed: !!b?.extra_bed,
    extra_bed_charge: b?.extra_bed_charge != null ? String(b.extra_bed_charge) : "",
    // OOS / block
    issue_type: b?.issue_type ?? "water",
    issue_detail: b?.issue_detail ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [userTouchedTotal, setUserTouchedTotal] = useState(editing);

  const type = form.booking_type;
  const isBlocked = type === "blocked" || type === "oos";

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const roomTypeId = useMemo(
    () => rooms.find((r) => r.id === form.room_id)?.room_type_id ?? null,
    [rooms, form.room_id]
  );
  const baseRate = roomTypes.find((rt) => rt.id === roomTypeId)?.daily_rate ?? 0;

  const calc = useMemo(() => {
    if (!form.check_in || !form.check_out || form.check_out <= form.check_in) {
      return { total: 0, nights: 0 };
    }
    const rm = roomTypeId ? rates[roomTypeId] ?? {} : {};
    return stayTotal(rm, Number(baseRate) || 0, form.check_in, form.check_out);
  }, [form.check_in, form.check_out, roomTypeId, rates, baseRate]);

  // Auto-fill total_amount from the computed stay price until the operator
  // edits it by hand (then we leave their override alone).
  useEffect(() => {
    if (isBlocked) return;
    if (userTouchedTotal) return;
    if (calc.total > 0) setForm((f) => ({ ...f, total_amount: String(calc.total) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calc.total, isBlocked, userTouchedTotal]);

  // ── Occupied-room filter ────────────────────────────────────────────────
  // Rooms whose existing (non-cancelled, non-checked-out) bookings overlap the
  // chosen dates are hidden from the picker. Source: the optional allBookings
  // prop when supplied, else a self-fetch via the server action.
  const [fetched, setFetched] = useState<Booking[] | null>(null);
  const windowBookings = allBookings ?? fetched ?? [];

  useEffect(() => {
    if (allBookings) return; // caller supplied them
    if (!form.check_in || !form.check_out || form.check_out <= form.check_in) return;
    let alive = true;
    bookingsInRangeAction(form.check_in, form.check_out).then((res) => {
      if (alive && res.ok) setFetched(res.data);
    });
    return () => {
      alive = false;
    };
  }, [allBookings, form.check_in, form.check_out]);

  const occupiedRoomIds = useMemo(() => {
    const out = new Set<string>();
    if (!form.check_in || !form.check_out) return out;
    const currentId = b?.id ?? null;
    for (const x of windowBookings) {
      if (!x.room_id) continue;
      if (currentId && x.id === currentId) continue;
      if (x.status === "cancelled" || x.status === "checked_out") continue;
      // Two half-open ranges overlap iff a.in < b.out && b.in < a.out.
      if (form.check_in < x.check_out && x.check_in < form.check_out) out.add(x.room_id);
    }
    return out;
  }, [windowBookings, form.check_in, form.check_out, b?.id]);

  const visibleRooms = rooms.filter(
    (r) => r.id === form.room_id || !occupiedRoomIds.has(r.id)
  );

  const fmtMoney = (n: number) => `${currency} ${n.toLocaleString()}`;

  // Live extra-bed charge preview + grand total.
  const moneyDerived = useMemo(() => {
    const baseTotal = parseFloat(form.total_amount) || 0;
    const autoCharge = Math.max(EXTRA_BED_MIN, Math.round(baseTotal * EXTRA_BED_RATE));
    const liveCharge = form.extra_bed
      ? parseFloat(form.extra_bed_charge) > 0
        ? parseFloat(form.extra_bed_charge)
        : autoCharge
      : 0;
    return { baseTotal, autoCharge, liveCharge, grand: baseTotal + liveCharge };
  }, [form.total_amount, form.extra_bed, form.extra_bed_charge]);

  function buildInput(): BookingInput {
    const dispName = isBlocked
      ? type === "oos"
        ? `OOS · ${form.issue_type || "other"}`
        : "BLOCKED"
      : `${form.guest_first_name} ${form.guest_last_name}`.trim() || "Guest";

    // Freeze the extra-bed charge snapshot: explicit override else the formula.
    let extraBedCharge: number | null = null;
    if (!isBlocked && form.extra_bed) {
      const override = parseFloat(form.extra_bed_charge);
      extraBedCharge = Number.isFinite(override) && override > 0 ? override : moneyDerived.autoCharge;
    }

    return {
      room_id: form.room_id || null,
      room_type_id: roomTypeId,
      booking_type: type,
      guest_name: dispName,
      guest_first_name: isBlocked ? null : form.guest_first_name.trim() || null,
      guest_last_name: isBlocked ? null : form.guest_last_name.trim() || null,
      thai_name: isBlocked ? null : form.thai_name.trim() || null,
      phone: isBlocked ? null : form.phone.trim() || null,
      car_plate: isBlocked ? null : form.car_plate.trim() || null,
      check_in: form.check_in,
      check_out: form.check_out,
      status: form.status,
      adults: Number(form.adults) || 1,
      children: Number(form.children) || 0,
      total_amount: isBlocked ? null : form.total_amount ? parseFloat(form.total_amount) : null,
      notes: form.notes.trim() || null,
      // OTA / reference
      reservation_no: isBlocked ? null : form.reservation_no.trim() || null,
      ota: isBlocked ? null : form.ota || null,
      booked_date: isBlocked ? null : form.booked_date || null,
      payment_method: isBlocked ? null : form.payment_method || null,
      // Deposit / partial payment
      amount_paid: isBlocked ? 0 : form.amount_paid ? parseFloat(form.amount_paid) : 0,
      deposit_date: isBlocked ? null : form.deposit_date || null,
      deposit_method: isBlocked ? null : form.deposit_method || null,
      // Extra bed snapshot
      extra_bed: isBlocked ? false : form.extra_bed,
      extra_bed_charge: extraBedCharge,
      // OOS / block specifics
      issue_type: type === "oos" ? form.issue_type || "other" : null,
      issue_detail: isBlocked ? form.issue_detail.trim() || null : null,
    };
  }

  async function save() {
    if (!form.room_id || !form.check_in || !form.check_out || form.check_out <= form.check_in) {
      toast.error(s.needRoomDates);
      return;
    }
    if (type === "standard" && !form.guest_first_name.trim()) {
      toast.error(s.needFirstName);
      return;
    }
    setSaving(true);
    const input = buildInput();
    const res = editing ? await updateBookingAction(b!.id, input) : await createBookingAction(input);
    setSaving(false);
    if (res.ok) {
      toast.success(s.saved);
      onClose();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function quickStatus(status: BookingStatus) {
    if (!editing) return;
    setSaving(true);
    const res = await setStatusAction(b!.id, status);
    setSaving(false);
    if (res.ok) {
      toast.success(s.saved);
      onClose();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const titleText = editing
    ? s.editBooking
    : type === "oos"
    ? s.markOos
    : type === "blocked"
    ? s.blockRoom
    : s.newBooking;

  const TYPE_PILLS: { k: BookingType; label: string; c: string }[] = [
    { k: "standard", label: s.typeStandard, c: "var(--app-accent)" },
    { k: "blocked", label: s.typeBlocked, c: "#64748b" },
    { k: "oos", label: s.typeOos, c: "#dc2626" },
  ];

  return (
    <Modal open onClose={onClose} title={titleText} className="max-w-lg">
      <div className="space-y-4">
        {/* Booking-type switcher — only when adding (monthly is intentionally
            excluded; manage monthly tenants on the Rentals flow). */}
        {!editing && (
          <div>
            <div className={sectionTitle}>{s.bookingType}</div>
            <div className="flex gap-1 rounded-xl border border-[var(--app-border)] p-1">
              {TYPE_PILLS.map((p) => (
                <button
                  key={p.k}
                  type="button"
                  onClick={() => set("booking_type", p.k)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    type === p.k
                      ? "text-white"
                      : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
                  }`}
                  style={type === p.k ? { background: p.c } : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Stay / block details ── */}
        <div>
          <div className={sectionTitle}>{isBlocked ? s.blockDetails : s.stayDetails}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{s.room}</label>
              <select className={field} value={form.room_id} onChange={(e) => set("room_id", e.target.value)}>
                <option value="">{s.pickRoom}</option>
                {visibleRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>{s.status}</label>
              <select className={field} value={form.status} onChange={(e) => set("status", e.target.value as BookingStatus)}>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {statusFallback(raw, st)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{isBlocked ? s.startDate : s.checkInDate}</label>
              <input type="date" className={field} value={form.check_in} onChange={(e) => set("check_in", e.target.value)} />
            </div>
            <div>
              <label className={label}>{isBlocked ? s.endDate : s.checkOutDate}</label>
              <input type="date" className={field} value={form.check_out} onChange={(e) => set("check_out", e.target.value)} />
            </div>
          </div>

          {/* OOS / block specifics */}
          {isBlocked && (
            <div className="mt-3 space-y-3">
              {type === "oos" && (
                <div>
                  <label className={label}>{s.issueType}</label>
                  <select className={field} value={form.issue_type} onChange={(e) => set("issue_type", e.target.value)}>
                    {ISSUE_TYPES.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={label}>{type === "oos" ? s.issueDetails : s.reasonNotes}</label>
                <textarea
                  className={field}
                  rows={2}
                  value={form.issue_detail}
                  onChange={(e) => set("issue_detail", e.target.value)}
                  placeholder={type === "oos" ? s.issuePlaceholder : s.reasonPlaceholder}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Standard-only sections (guest, OTA, financials) ── */}
        {!isBlocked && (
          <>
            {/* Booking reference / OTA */}
            <div>
              <div className={sectionTitle}>{s.bookingRef}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>{s.resNo}</label>
                  <input className={field} value={form.reservation_no} onChange={(e) => set("reservation_no", e.target.value)} placeholder="e.g. 2004203508" />
                </div>
                <div>
                  <label className={label}>{s.otaSrc}</label>
                  <select className={field} value={form.ota} onChange={(e) => set("ota", e.target.value)}>
                    <option value="">{s.selectDot}</option>
                    {OTA_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>{s.bookedDate}</label>
                  <input type="date" className={field} value={form.booked_date} onChange={(e) => set("booked_date", e.target.value)} />
                </div>
                <div>
                  <label className={label}>{s.payMethod}</label>
                  <select className={field} value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
                    {PAYMENT_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Financials */}
            <div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>{s.totalAmt} ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={field}
                    value={form.total_amount}
                    onChange={(e) => {
                      setUserTouchedTotal(true);
                      set("total_amount", e.target.value);
                    }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={label}>{s.amountPaid}</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={field}
                    value={form.amount_paid}
                    onChange={(e) => set("amount_paid", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Extra bed — 50% of room total, floor 250. */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>{s.extraBedLabel}</label>
                  <label className="flex items-center gap-2 py-1.5 text-sm">
                    <input type="checkbox" checked={form.extra_bed} onChange={(e) => set("extra_bed", e.target.checked)} />
                    {form.extra_bed ? (
                      <span>
                        {s.extraBed} <b>+฿{moneyDerived.liveCharge.toLocaleString()}</b>
                      </span>
                    ) : (
                      <span className="text-[var(--app-fg-muted)]">{s.noExtraBed}</span>
                    )}
                  </label>
                </div>
                <div>
                  <label className={label}>{s.chargeOverride}</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={field}
                    value={form.extra_bed_charge}
                    onChange={(e) => set("extra_bed_charge", e.target.value)}
                    disabled={!form.extra_bed}
                    placeholder={form.extra_bed ? String(moneyDerived.autoCharge) : "—"}
                  />
                  {form.extra_bed && (
                    <div className="mt-1 text-[11px] text-[var(--app-fg-muted)]">
                      {s.grandTotal}: <b>฿{moneyDerived.grand.toLocaleString()}</b>
                    </div>
                  )}
                </div>
              </div>

              {/* Deposit details + live outstanding */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>{s.depositDate}</label>
                  <input type="date" className={field} value={form.deposit_date} onChange={(e) => set("deposit_date", e.target.value)} />
                </div>
                <div>
                  <label className={label}>{s.depositMethod}</label>
                  <select className={field} value={form.deposit_method} onChange={(e) => set("deposit_method", e.target.value)}>
                    <option value="">{s.selectDot}</option>
                    {PAYMENT_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Outstanding = total − paid (live). */}
              <Outstanding total={form.total_amount} paid={form.amount_paid} s={s} />
            </div>

            {/* Guest info */}
            <div>
              <div className={sectionTitle}>{s.guestInfo}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>{s.firstName}</label>
                  <input className={field} value={form.guest_first_name} onChange={(e) => set("guest_first_name", e.target.value)} placeholder={s.firstName} />
                </div>
                <div>
                  <label className={label}>{s.lastName}</label>
                  <input className={field} value={form.guest_last_name} onChange={(e) => set("guest_last_name", e.target.value)} placeholder={s.lastName} />
                </div>
              </div>
              <div className="mt-3">
                <label className={label}>{s.thaiName}</label>
                <input className={field} value={form.thai_name} onChange={(e) => set("thai_name", e.target.value)} placeholder="ชื่อ นามสกุล" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>{s.phone}</label>
                  <input className={field} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0xx-xxx-xxxx" />
                </div>
                <div>
                  <label className={label}>{s.plate}</label>
                  <input className={field} value={form.car_plate} onChange={(e) => set("car_plate", e.target.value)} placeholder="กขค 1234" />
                </div>
              </div>
              <div className="mt-3">
                <label className={label}>{s.notes}</label>
                <textarea className={field} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={s.specialRq} />
              </div>
            </div>
          </>
        )}

        {/* Block/OOS still keeps a free-form notes line via issue_detail above; no separate notes. */}

        {calc.nights > 0 && !isBlocked && (
          <div className="flex items-center justify-between rounded-lg bg-[var(--app-surface-2)] px-3 py-2 text-sm">
            <span className="text-[var(--app-fg-muted)]">
              {calc.nights} {s.nights}
            </span>
            <span className="font-semibold">
              {s.total}: {fmtMoney(calc.total)}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={save} loading={saving}>
            {editing ? s.update : s.save}
          </Button>
          {editing && b!.status !== "checked_in" && (
            <Button variant="ghost" onClick={() => quickStatus("checked_in")}>
              {s.markCheckedIn}
            </Button>
          )}
          {editing && b!.status === "checked_in" && (
            <Button variant="ghost" onClick={() => quickStatus("checked_out")}>
              {s.markCheckedOut}
            </Button>
          )}
          {editing && b!.status !== "cancelled" && (
            <Button variant="danger" onClick={() => quickStatus("cancelled")}>
              {s.cancelBooking}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Localized status label without depending on app-i18n keys.
function statusFallback(raw: string, st: BookingStatus): string {
  const map: Record<"th" | "en", Record<BookingStatus, string>> = {
    th: {
      pending: "รอยืนยัน",
      confirmed: "ยืนยันแล้ว",
      checked_in: "เข้าพักแล้ว",
      checked_out: "ออกแล้ว",
      cancelled: "ยกเลิก",
    },
    en: {
      pending: "Pending",
      confirmed: "Confirmed",
      checked_in: "Checked in",
      checked_out: "Checked out",
      cancelled: "Cancelled",
    },
  };
  return map[raw === "en" ? "en" : "th"][st];
}

function Outstanding({
  total,
  paid,
  s,
}: {
  total: string;
  paid: string;
  s: Record<string, string>;
}) {
  const t = parseFloat(total);
  const p = parseFloat(paid);
  let body: React.ReactNode;
  let strong = false;
  if (!Number.isFinite(t) || t <= 0) {
    body = "—";
  } else if (!Number.isFinite(p) || p <= 0) {
    body = s.noDeposit;
  } else {
    const out = Math.max(0, t - p);
    body = `฿${out.toLocaleString()}`;
    strong = true;
  }
  return (
    <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--app-surface-2)] px-3 py-2 text-sm">
      <span className="text-[var(--app-fg-muted)]">{s.outstanding}</span>
      <span className={strong ? "font-semibold" : "text-[var(--app-fg-muted)]"}>{body}</span>
    </div>
  );
}
