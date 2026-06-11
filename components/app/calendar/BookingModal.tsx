"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "@/lib/db/rooms";
import type { Booking, BookingInput, BookingStatus } from "@/lib/db/bookings";
import type { RateMap } from "@/lib/db/rates";
import { stayTotal } from "@/lib/booking-calc";
import { useAppT } from "@/lib/app-i18n";
import { useToast } from "@/components/app/ui/Toast";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import { createBookingAction, updateBookingAction, setStatusAction } from "@/app/app/calendar/actions";
import type { RoomTypeBrief } from "./CalendarClient";

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

const STATUSES: BookingStatus[] = ["pending", "confirmed", "checked_in", "checked_out", "cancelled"];

export interface ModalSeed {
  booking?: Booking;
  roomId?: string | null;
  checkIn?: string;
  checkOut?: string;
}

export default function BookingModal({
  seed,
  rooms,
  roomTypes,
  rates,
  currency,
  onClose,
}: {
  seed: ModalSeed;
  rooms: Room[];
  roomTypes: RoomTypeBrief[];
  rates: RateMap;
  currency: string;
  onClose: () => void;
}) {
  const t = useAppT();
  const toast = useToast();
  const router = useRouter();
  const editing = !!seed.booking;

  const [form, setForm] = useState({
    room_id: seed.booking?.room_id ?? seed.roomId ?? "",
    guest_name: seed.booking?.guest_name ?? "",
    phone: seed.booking?.phone ?? "",
    check_in: seed.booking?.check_in ?? seed.checkIn ?? "",
    check_out: seed.booking?.check_out ?? seed.checkOut ?? "",
    adults: seed.booking?.adults ?? 1,
    children: seed.booking?.children ?? 0,
    status: (seed.booking?.status ?? "confirmed") as BookingStatus,
    notes: seed.booking?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

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

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.room_id || !form.check_in || !form.check_out || form.check_out <= form.check_in) {
      toast.error(t("cal.needRoomDates"));
      return;
    }
    setSaving(true);
    const input: BookingInput = {
      room_id: form.room_id,
      room_type_id: roomTypeId,
      guest_name: form.guest_name.trim() || "Guest",
      phone: form.phone.trim() || null,
      check_in: form.check_in,
      check_out: form.check_out,
      status: form.status,
      adults: Number(form.adults) || 1,
      children: Number(form.children) || 0,
      total_amount: calc.total || null,
      notes: form.notes.trim() || null,
    };
    const res = editing
      ? await updateBookingAction(seed.booking!.id, input)
      : await createBookingAction(input);
    setSaving(false);
    if (res.ok) {
      toast.success(t("cal.saved"));
      onClose();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function quickStatus(status: BookingStatus) {
    if (!editing) return;
    setSaving(true);
    const res = await setStatusAction(seed.booking!.id, status);
    setSaving(false);
    if (res.ok) {
      toast.success(t("cal.saved"));
      onClose();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const fmtMoney = (n: number) => `${currency} ${n.toLocaleString()}`;

  return (
    <Modal open onClose={onClose} title={editing ? t("cal.editBooking") : t("cal.newBooking")}>
      <div className="space-y-3">
        <div>
          <label className={label}>{t("cal.guestName")}</label>
          <input className={field} value={form.guest_name} onChange={(e) => set("guest_name", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>{t("cal.room")}</label>
            <select className={field} value={form.room_id} onChange={(e) => set("room_id", e.target.value)}>
              <option value="">{t("cal.pickRoom")}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>{t("cal.phone")}</label>
            <input className={field} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>{t("cal.checkInDate")}</label>
            <input type="date" className={field} value={form.check_in} onChange={(e) => set("check_in", e.target.value)} />
          </div>
          <div>
            <label className={label}>{t("cal.checkOutDate")}</label>
            <input type="date" className={field} value={form.check_out} onChange={(e) => set("check_out", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>{t("cal.adults")}</label>
            <input type="number" min={1} className={field} value={form.adults} onChange={(e) => set("adults", Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>{t("cal.children")}</label>
            <input type="number" min={0} className={field} value={form.children} onChange={(e) => set("children", Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>{t("cal.status")}</label>
            <select className={field} value={form.status} onChange={(e) => set("status", e.target.value as BookingStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`cal.status.${s}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>{t("cal.notes")}</label>
          <textarea className={field} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        {calc.nights > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-[var(--app-surface-2)] px-3 py-2 text-sm">
            <span className="text-[var(--app-fg-muted)]">
              {calc.nights} {t("cal.nights")}
            </span>
            <span className="font-semibold">
              {t("cal.total")}: {fmtMoney(calc.total)}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={save} loading={saving}>
            {t("cal.save")}
          </Button>
          {editing && seed.booking!.status !== "checked_in" && (
            <Button variant="ghost" onClick={() => quickStatus("checked_in")}>
              {t("cal.markCheckedIn")}
            </Button>
          )}
          {editing && seed.booking!.status === "checked_in" && (
            <Button variant="ghost" onClick={() => quickStatus("checked_out")}>
              {t("cal.markCheckedOut")}
            </Button>
          )}
          {editing && seed.booking!.status !== "cancelled" && (
            <Button variant="danger" onClick={() => quickStatus("cancelled")}>
              {t("cal.cancelBooking")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
