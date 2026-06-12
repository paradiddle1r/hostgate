"use client";

// Shared floor-based room generator: enter floors + rooms-per-floor → generate
// floor*100+n numbers → assign a room type per room (with per-floor /
// apply-to-all shortcuts) → save. Controlled: the parent supplies `onSave`
// (returns true on success) so the SAME generator works both on the Rooms page
// (saves to the active property) and in onboarding (collects rooms for the
// provision step). No server calls live here.

import { useState } from "react";
import { Wand2, BedDouble } from "lucide-react";
import { generateRooms, uniformFloors, type FloorSpec } from "@/lib/rooms-generator";
import { useAppT } from "@/lib/app-i18n";
import Button from "@/components/app/ui/Button";

export interface RoomTypeOption {
  id: string;
  name: string;
}

export interface GeneratedRoomRow {
  number: string;
  floor: number;
  room_type_id: string | null;
  sort_order: number;
}

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

export default function RoomGenerator({
  roomTypes,
  onSave,
  saveLabel,
  defaultFloors = 1,
  defaultPerFloor = 10,
  showTitle = true,
}: {
  roomTypes: RoomTypeOption[];
  onSave: (rows: GeneratedRoomRow[]) => Promise<boolean>;
  saveLabel?: string;
  defaultFloors?: number;
  defaultPerFloor?: number;
  showTitle?: boolean;
}) {
  const t = useAppT();
  const [step, setStep] = useState<"setup" | "assign">("setup");
  const [floors, setFloors] = useState<FloorSpec[]>(uniformFloors(defaultFloors, defaultPerFloor));
  const [draft, setDraft] = useState<GeneratedRoomRow[]>([]);
  const [saving, setSaving] = useState(false);

  function setFloorCount(n: number) {
    setFloors((cur) =>
      uniformFloors(n, cur[0]?.count ?? defaultPerFloor).map((f, i) => ({
        floor: f.floor,
        count: cur[i]?.count ?? f.count,
      }))
    );
  }
  const setPerFloorDefault = (n: number) => setFloors((cur) => cur.map((f) => ({ ...f, count: n })));
  const setOneFloor = (idx: number, count: number) =>
    setFloors((cur) => cur.map((f, i) => (i === idx ? { ...f, count } : f)));

  function generate() {
    setDraft(generateRooms(floors).map((r) => ({ ...r, room_type_id: null as string | null })));
    setStep("assign");
  }
  const assignOne = (number: string, typeId: string | null) =>
    setDraft((cur) => cur.map((r) => (r.number === number ? { ...r, room_type_id: typeId } : r)));
  const assignFloor = (floor: number, typeId: string | null) =>
    setDraft((cur) => cur.map((r) => (r.floor === floor ? { ...r, room_type_id: typeId } : r)));
  const assignAll = (typeId: string | null) =>
    setDraft((cur) => cur.map((r) => ({ ...r, room_type_id: typeId })));

  async function save() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  }

  const byFloor = draft.reduce<Record<number, GeneratedRoomRow[]>>((acc, r) => {
    (acc[r.floor] ||= []).push(r);
    return acc;
  }, {});

  if (step === "setup") {
    return (
      <div>
        {showTitle && (
          <>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">{t("rooms.setupTitle")}</h1>
            <p className="mb-6 text-sm text-[var(--app-fg-muted)]">{t("rooms.emptyHint")}</p>
          </>
        )}
        <div className="app-surface space-y-5 rounded-2xl border border-[var(--app-border)] p-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{t("rooms.floors")}</span>
              <input type="number" min={1} max={50} value={floors.length}
                onChange={(e) => setFloorCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className={`${field} w-full`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{t("rooms.roomsPerFloor")}</span>
              <input type="number" min={1} max={99} value={floors[0]?.count ?? defaultPerFloor}
                onChange={(e) => setPerFloorDefault(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                className={`${field} w-full`} />
            </label>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--app-fg-muted)]">{t("rooms.perFloorEdit")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {floors.map((f, i) => (
                <div key={f.floor} className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] px-2 py-1.5">
                  <span className="text-xs text-[var(--app-fg-muted)]">{t("rooms.floor")} {f.floor}</span>
                  <input type="number" min={0} max={99} value={f.count}
                    onChange={(e) => setOneFloor(i, Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
                    className={`${field} ml-auto w-16`} />
                </div>
              ))}
            </div>
          </div>
          <div className="text-sm text-[var(--app-fg-muted)]">
            = <b className="text-[var(--app-fg)]">{floors.reduce((s, f) => s + Math.min(99, f.count), 0)}</b> {t("rooms.count")}
          </div>
          <Button onClick={generate}>
            <Wand2 size={16} /> {t("rooms.generate")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {showTitle && (
        <>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">{t("rooms.assignTitle")}</h1>
          <p className="mb-4 text-sm text-[var(--app-fg-muted)]">{t("rooms.assignHint")}</p>
        </>
      )}

      {roomTypes.length === 0 && (
        <div className="mb-4 rounded-xl bg-[var(--app-surface-2)] px-3 py-2.5 text-sm text-[var(--app-fg-muted)]">
          {t("rooms.noTypesWarn")}
        </div>
      )}
      {roomTypes.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--app-fg-muted)]">{t("rooms.applyToAll")}:</span>
          {roomTypes.map((rt) => (
            <button key={rt.id} onClick={() => assignAll(rt.id)}
              className="rounded-full border border-[var(--app-border)] px-3 py-1 text-xs hover:border-[var(--app-accent)]">
              {rt.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-5">
        {Object.entries(byFloor).map(([floor, rooms]) => (
          <div key={floor} className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{t("rooms.floor")} {floor}</h3>
              <span className="text-xs text-[var(--app-fg-muted)]">{rooms.length} {t("rooms.count")}</span>
              {roomTypes.length > 0 && (
                <select defaultValue="" onChange={(e) => { if (e.target.value) assignFloor(Number(floor), e.target.value); e.target.value = ""; }}
                  className={`${field} ml-auto`}>
                  <option value="">{t("rooms.applyToFloor")}…</option>
                  {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                </select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {rooms.map((r) => (
                <div key={r.number} className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] px-2 py-1.5">
                  <span className="text-sm font-medium">{r.number}</span>
                  <select value={r.room_type_id ?? ""} onChange={(e) => assignOne(r.number, e.target.value || null)}
                    className={`${field} ml-auto w-full min-w-0`} disabled={roomTypes.length === 0}>
                    <option value="">{t("rooms.noType")}</option>
                    {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        <Button onClick={save} loading={saving}>
          <BedDouble size={16} /> {saveLabel ?? t("rooms.save")} ({draft.length})
        </Button>
        <Button variant="ghost" onClick={() => setStep("setup")}>{t("rooms.regenerate")}</Button>
      </div>
    </div>
  );
}
