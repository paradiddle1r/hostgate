"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Check } from "lucide-react";
import type { Room } from "@/lib/db/rooms";
import { useAppT } from "@/lib/app-i18n";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import RoomGenerator, { type RoomTypeOption } from "./RoomGenerator";
import { saveRooms, updateRoomAction, deleteRoomAction, addRoomAction } from "@/app/app/rooms/actions";

export type { RoomTypeOption };

// Local TH+EN strings for the parity bits (monthly toggle / add-room / floor
// edit). Kept here to stay out of lib/app-i18n.ts.
const STR = {
  th: {
    monthly: "รายเดือน",
    monthlyHint: "ขายห้องนี้เป็นรายเดือน",
    floor: "ชั้น",
    addRoom: "เพิ่มห้อง",
    newRoom: "เพิ่มห้องใหม่",
    roomNo: "เลขห้อง",
    type: "ประเภท",
    add: "เพิ่ม",
    noType: "ยังไม่กำหนด",
    needNumber: "ต้องระบุเลขห้อง",
    added: "เพิ่มห้องแล้ว",
  },
  en: {
    monthly: "Monthly",
    monthlyHint: "Sell this room as a monthly rental",
    floor: "Floor",
    addRoom: "Add a room",
    newRoom: "Add a new room",
    roomNo: "Room no.",
    type: "Type",
    add: "Add",
    noType: "No type",
    needNumber: "Room number is required",
    added: "Room added",
  },
} as const;

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

export default function RoomsClient({
  initialRooms,
  roomTypes,
}: {
  initialRooms: Room[];
  roomTypes: RoomTypeOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useAppT();

  // ── EXISTING ROOMS → editable table ──────────────────────────────────
  if (initialRooms.length > 0) {
    return <RoomsTable rooms={initialRooms} roomTypes={roomTypes} />;
  }

  // ── NO ROOMS → the shared floor generator + bulk type assignment ─────
  return (
    <RoomGenerator
      roomTypes={roomTypes}
      onSave={async (rows) => {
        const res = await saveRooms(rows);
        if (res.ok) {
          toast.success(`${t("rooms.saved")} (${res.data.count})`);
          router.refresh();
          return true;
        }
        toast.error(`${res.code} · ${res.message}`);
        return false;
      }}
    />
  );
}

// =====================================================================
// Existing-rooms editable table
// =====================================================================
function RoomsTable({ rooms, roomTypes }: { rooms: Room[]; roomTypes: RoomTypeOption[] }) {
  const t = useAppT();
  const { locale } = useI18n();
  const s = STR[locale === "en" ? "en" : "th"];
  const toast = useToast();
  const router = useRouter();

  async function changeType(id: string, typeId: string | null) {
    const res = await updateRoomAction(id, { room_type_id: typeId });
    if (!res.ok) toast.error(`${res.code} · ${res.message}`);
    else router.refresh();
  }
  async function toggleStatus(r: Room) {
    const res = await updateRoomAction(r.id, { status: r.status === "active" ? "inactive" : "active" });
    if (!res.ok) toast.error(`${res.code} · ${res.message}`);
    else router.refresh();
  }
  async function toggleMonthly(r: Room) {
    const res = await updateRoomAction(r.id, { monthly_available: !r.monthly_available });
    if (!res.ok) toast.error(`${res.code} · ${res.message}`);
    else router.refresh();
  }
  async function saveFloor(r: Room, floor: number) {
    if (!Number.isFinite(floor) || floor === r.floor) return;
    const res = await updateRoomAction(r.id, { floor });
    if (!res.ok) toast.error(`${res.code} · ${res.message}`);
    else router.refresh();
  }
  async function remove(r: Room) {
    const res = await deleteRoomAction(r.id);
    if (!res.ok) toast.error(`${res.code} · ${res.message}`);
    else {
      toast.success(t("common.delete"));
      router.refresh();
    }
  }

  // group by floor
  const byFloor = rooms.reduce<Record<number, Room[]>>((acc, r) => {
    (acc[r.floor] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("rooms.title")}</h1>
        <span className="text-sm text-[var(--app-fg-muted)]">
          {rooms.length} {t("rooms.count")}
        </span>
      </div>

      <div className="space-y-4">
        {Object.entries(byFloor).map(([floor, list]) => (
          <div key={floor} className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
            <div className="border-b border-[var(--app-border)] px-4 py-2 text-sm font-semibold">
              {t("rooms.floor")} {floor}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                  <th className="px-4 py-2 font-medium">{t("rooms.number")}</th>
                  <th className="px-4 py-2 font-medium">{s.floor}</th>
                  <th className="px-4 py-2 font-medium">{t("rooms.type")}</th>
                  <th className="px-4 py-2 font-medium">{s.monthly}</th>
                  <th className="px-4 py-2 font-medium">{t("rooms.status")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--app-border)]">
                    <td className="px-4 py-2 font-medium">{r.number}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        defaultValue={r.floor}
                        onBlur={(e) => saveFloor(r, Number(e.target.value))}
                        className={`${field} w-16`}
                        aria-label={s.floor}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={r.room_type_id ?? ""}
                        onChange={(e) => changeType(r.id, e.target.value || null)}
                        className={field}
                      >
                        <option value="">{t("rooms.noType")}</option>
                        {roomTypes.map((rt) => (
                          <option key={rt.id} value={rt.id}>
                            {rt.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => toggleMonthly(r)}
                        title={s.monthlyHint}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          r.monthly_available
                            ? "bg-[var(--app-accent)]/15 text-[var(--app-accent)]"
                            : "bg-[var(--app-surface-2)] text-[var(--app-fg-muted)]"
                        }`}
                      >
                        {r.monthly_available && <Check size={12} />}
                        {s.monthly}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => toggleStatus(r)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          r.status === "active"
                            ? "bg-[var(--app-success)]/15 text-[var(--app-success)]"
                            : "bg-[var(--app-surface-2)] text-[var(--app-fg-muted)]"
                        }`}
                      >
                        {r.status === "active" ? t("rooms.active") : t("rooms.inactive")}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => remove(r)}
                        aria-label={t("common.delete")}
                        className="text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <AddRoomForm roomTypes={roomTypes} s={s} />
    </div>
  );
}

// =====================================================================
// Add-room inline form
// =====================================================================
function AddRoomForm({ roomTypes, s }: { roomTypes: RoomTypeOption[]; s: (typeof STR)["en"] | (typeof STR)["th"] }) {
  const toast = useToast();
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("1");
  const [typeId, setTypeId] = useState("");
  const [monthly, setMonthly] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!number.trim()) {
      toast.error(s.needNumber);
      return;
    }
    setBusy(true);
    const res = await addRoomAction({
      number,
      floor: Number(floor) || 1,
      room_type_id: typeId || null,
      monthly_available: monthly,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(s.added);
      setNumber("");
      setTypeId("");
      setMonthly(false);
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  return (
    <div className="app-surface mt-6 rounded-2xl border border-[var(--app-border)] p-4">
      <h3 className="mb-3 text-sm font-semibold">{s.newRoom}</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s.roomNo}</span>
          <input value={number} onChange={(e) => setNumber(e.target.value)} className={`${field} w-28`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s.floor}</span>
          <input
            type="number"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            className={`${field} w-20`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s.type}</span>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={field}>
            <option value="">{s.noType}</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer select-none items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--app-accent)]"
            checked={monthly}
            onChange={(e) => setMonthly(e.target.checked)}
          />
          {s.monthly}
        </label>
        <Button onClick={add} loading={busy} className="mb-0.5">
          <Plus size={15} /> {s.add}
        </Button>
      </div>
    </div>
  );
}
