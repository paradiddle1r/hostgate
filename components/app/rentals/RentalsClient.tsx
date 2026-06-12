"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, ChevronRight, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { MonthlyTenantRow, RentalTenant } from "@/lib/db/rentals";
import type { Booking } from "@/lib/db/bookings";
import type { Room } from "@/lib/db/rooms";
import { isOpenEnded } from "@/lib/rental-calc";
import { useToast } from "@/components/app/ui/Toast";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import { saveTenantConfig } from "@/app/app/rentals/actions";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "เช่ารายเดือน",
    sub: "ผู้เช่ารายเดือนและค่าเช่าประจำเดือน",
    add: "เพิ่มผู้เช่ารายเดือน",
    activeTenants: "ผู้เช่าที่ใช้งาน",
    rentRoll: "ค่าเช่ารวมต่อเดือน",
    room: "ห้อง",
    occupants: "ผู้พักอาศัย",
    people: "คน",
    openEnded: "ไม่กำหนด",
    until: "ถึง",
    empty: "ยังไม่มีผู้เช่ารายเดือน",
    emptyHint: "เพิ่มผู้เช่ารายเดือนจากการจองที่มีอยู่",
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
    sub: "Monthly tenants and their recurring rent.",
    add: "Add monthly tenant",
    activeTenants: "Active tenants",
    rentRoll: "Monthly rent roll",
    room: "Room",
    occupants: "Occupants",
    people: "people",
    openEnded: "Open-ended",
    until: "until",
    empty: "No monthly tenants yet",
    emptyHint: "Add a monthly tenant from an existing booking.",
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

  const money = (n: number) => `${currency} ${Number(n || 0).toLocaleString()}`;
  const rentRoll = useMemo(
    () => tenants.reduce((sum, r) => sum + (Number(r.tenant.monthly_rent) || 0), 0),
    [tenants]
  );

  function openAdd() {
    setBookingId(candidates[0]?.id ?? "");
    setRent("");
    setDeposit("");
    setAdvance("");
    setAdding(true);
  }

  async function save() {
    if (!bookingId) return toast.error(s("needBooking"));
    if (rent === "" || Number(rent) <= 0) return toast.error(s("needRent"));
    setSaving(true);
    const input: Parameters<typeof saveTenantConfig>[1] = {
      monthly_rent: Number(rent),
    };
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
          <p className="text-sm text-[var(--app-fg-muted)]">{s("sub")}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> {s("add")}
        </Button>
      </div>

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
          <div className="text-xs font-medium text-[var(--app-fg-muted)]">{s("activeTenants")}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{tenants.length}</div>
        </div>
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
          <div className="text-xs font-medium text-[var(--app-fg-muted)]">{s("rentRoll")}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{money(rentRoll)}</div>
        </div>
      </div>

      {tenants.length === 0 ? (
        <EmptyState icon={<KeyRound size={22} />} title={s("empty")} hint={s("emptyHint")} />
      ) : (
        <div className="space-y-2">
          {tenants.map(({ tenant, booking }) => {
            const num = roomNumber(booking.room_id);
            return (
              <button
                key={tenant.id}
                onClick={() => router.push("/app/rentals/" + booking.id)}
                className="app-surface flex w-full items-center gap-3 rounded-2xl border border-[var(--app-border)] p-4 text-left transition-colors hover:bg-[var(--app-surface-2)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{booking.guest_name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-[var(--app-fg-muted)]">
                    <span>
                      {s("room")} {num ?? "—"}
                    </span>
                    <span className="font-medium text-[var(--app-fg)]">
                      {money(tenant.monthly_rent)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users size={13} /> {tenant.occupants} {s("people")}
                    </span>
                  </div>
                </div>
                <span className="flex-none rounded-full border border-[var(--app-border)] px-2.5 py-1 text-xs font-medium text-[var(--app-fg-muted)]">
                  {isOpenEnded(booking.check_out)
                    ? s("openEnded")
                    : `${s("until")} ${booking.check_out}`}
                </span>
                <ChevronRight size={18} className="flex-none text-[var(--app-fg-muted)]" />
              </button>
            );
          })}
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
                  onChange={(e) =>
                    setDeposit(e.target.value === "" ? "" : Number(e.target.value))
                  }
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
                  onChange={(e) =>
                    setAdvance(e.target.value === "" ? "" : Number(e.target.value))
                  }
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
