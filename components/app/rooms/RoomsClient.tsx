"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Room } from "@/lib/db/rooms";
import { useAppT } from "@/lib/app-i18n";
import { useToast } from "@/components/app/ui/Toast";
import EmptyState from "@/components/app/ui/EmptyState";
import RoomGenerator, { type RoomTypeOption } from "./RoomGenerator";
import { saveRooms, updateRoomAction, deleteRoomAction } from "@/app/app/rooms/actions";

export type { RoomTypeOption };

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
  const toast = useToast();
  const router = useRouter();
  const typeName = (id: string | null) => roomTypes.find((rt) => rt.id === id)?.name ?? t("rooms.noType");

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
                  <th className="px-4 py-2 font-medium">{t("rooms.type")}</th>
                  <th className="px-4 py-2 font-medium">{t("rooms.status")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--app-border)]">
                    <td className="px-4 py-2 font-medium">{r.number}</td>
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
    </div>
  );
}
