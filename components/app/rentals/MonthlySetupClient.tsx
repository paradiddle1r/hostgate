"use client";

// /app/rentals/setup — per-room-type monthly config. One card per room type
// holds the monthly pricing + fees stored in monthly_room_types (display name
// TH/EN, monthly_rent, deposit, advance_rent, electric/water rate, internet,
// parking). Saved via saveMonthlyRoomType (upsert on room_type_id). Move-in
// total = deposit + advance_rent (advance covers the first month).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, Save, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { MonthlyRoomType } from "@/lib/db/rentals";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import { saveMonthlyRoomType } from "@/app/app/rentals/actions";

export interface RoomTypeBrief {
  id: string;
  name: string;
}

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "ตั้งค่าห้องรายเดือน",
    sub: "กำหนดราคา/ค่าธรรมเนียมรายเดือนต่อประเภทห้อง",
    moveIn: "ย้ายเข้าจ่ายรวม",
    moveInHint: "เงินประกัน + ค่าเช่าล่วงหน้า",
    nameTh: "ชื่อที่แสดง (ไทย)",
    nameEn: "ชื่อที่แสดง (อังกฤษ)",
    monthlyRent: "ค่าเช่า/เดือน",
    deposit: "เงินประกัน",
    advance: "ค่าเช่าล่วงหน้า",
    electricRate: "ค่าไฟ/หน่วย",
    waterRate: "ค่าน้ำ/หน่วย",
    internet: "ค่าเน็ต/เดือน",
    parking: "ค่าที่จอดรถ/เดือน",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    empty: "ยังไม่มีประเภทห้อง",
    emptyHint: "เพิ่มประเภทห้องในหน้าตั้งค่าห้องก่อน",
  },
  en: {
    title: "Monthly setup",
    sub: "Set monthly pricing & fees per room type.",
    moveIn: "Move-in total",
    moveInHint: "deposit + advance rent",
    nameTh: "Display name (Thai)",
    nameEn: "Display name (English)",
    monthlyRent: "Monthly rent",
    deposit: "Deposit",
    advance: "Advance rent",
    electricRate: "Electric rate / unit",
    waterRate: "Water rate / unit",
    internet: "Internet / mo",
    parking: "Parking / mo",
    save: "Save",
    saved: "Saved",
    empty: "No room types yet",
    emptyHint: "Add room types in room setup first.",
  },
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

type Num = number | "";
const n = (v: Num): number => (v === "" ? 0 : Number(v) || 0);

export default function MonthlySetupClient({
  roomTypes,
  configs,
  currency,
}: {
  roomTypes: RoomTypeBrief[];
  configs: MonthlyRoomType[];
  currency: string;
}) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--app-surface-2)] text-[var(--app-fg-muted)]">
          <DoorOpen size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
          <p className="text-sm text-[var(--app-fg-muted)]">{s("sub")}</p>
        </div>
      </div>

      {roomTypes.length === 0 ? (
        <EmptyState icon={<DoorOpen size={22} />} title={s("empty")} hint={s("emptyHint")} />
      ) : (
        <div className="space-y-4">
          {roomTypes.map((rt) => (
            <TypeCard
              key={rt.id}
              roomType={rt}
              config={configs.find((c) => c.room_type_id === rt.id) ?? null}
              currency={currency}
              s={s}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TypeCard({
  roomType,
  config,
  currency,
  s,
}: {
  roomType: RoomTypeBrief;
  config: MonthlyRoomType | null;
  currency: string;
  s: (k: string) => string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [v, setV] = useState({
    display_name_th: config?.display_name_th ?? "",
    display_name_en: config?.display_name_en ?? "",
    monthly_rent: (config?.monthly_rent ?? 0) as Num,
    deposit: (config?.deposit ?? 0) as Num,
    advance_rent: (config?.advance_rent ?? 0) as Num,
    electric_rate: (config?.electric_rate ?? 0) as Num,
    water_rate: (config?.water_rate ?? 0) as Num,
    internet_fee: (config?.internet_fee ?? 0) as Num,
    parking_fee: (config?.parking_fee ?? 0) as Num,
  });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  const money = (x: number) => `${currency} ${Number(x || 0).toLocaleString()}`;
  const moveIn = n(v.deposit) + n(v.advance_rent);
  const title = v.display_name_th || v.display_name_en || roomType.name;

  async function save() {
    setBusy(true);
    setOk(false);
    const res = await saveMonthlyRoomType(roomType.id, {
      display_name_th: v.display_name_th.trim() || null,
      display_name_en: v.display_name_en.trim() || null,
      monthly_rent: n(v.monthly_rent),
      deposit: n(v.deposit),
      advance_rent: n(v.advance_rent),
      electric_rate: n(v.electric_rate),
      water_rate: n(v.water_rate),
      internet_fee: n(v.internet_fee),
      parking_fee: n(v.parking_fee),
    });
    setBusy(false);
    if (res.ok) {
      setOk(true);
      setTimeout(() => setOk(false), 1800);
      toast.success(s("saved"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const numInput = (val: Num, set: (x: Num) => void) => (
    <input
      type="number"
      min={0}
      step="0.01"
      className={field}
      value={val}
      onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))}
    />
  );

  return (
    <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
      <div
        className="flex items-center gap-3 border-b border-[var(--app-border)] px-5 py-3"
        style={{ background: "color-mix(in srgb, var(--app-accent) 8%, transparent)" }}
      >
        <span className="rounded-md bg-[var(--app-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--app-accent-fg)]">
          {roomType.name}
        </span>
        <strong className="text-sm">{title}</strong>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[var(--app-fg-muted)]">{s("moveIn")}</span>
          <strong className="tabular-nums text-[var(--app-accent)]">{money(moveIn)}</strong>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{s("nameTh")}</label>
            <input
              className={field}
              value={v.display_name_th}
              onChange={(e) => setV({ ...v, display_name_th: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>{s("nameEn")}</label>
            <input
              className={field}
              value={v.display_name_en}
              onChange={(e) => setV({ ...v, display_name_en: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>
              {s("monthlyRent")} ({currency})
            </label>
            {numInput(v.monthly_rent, (x) => setV({ ...v, monthly_rent: x }))}
          </div>
          <div>
            <label className={label}>
              {s("deposit")} ({currency})
            </label>
            {numInput(v.deposit, (x) => setV({ ...v, deposit: x }))}
          </div>
          <div>
            <label className={label}>
              {s("advance")} ({currency})
            </label>
            {numInput(v.advance_rent, (x) => setV({ ...v, advance_rent: x }))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className={label}>
              {s("electricRate")} ({currency})
            </label>
            {numInput(v.electric_rate, (x) => setV({ ...v, electric_rate: x }))}
          </div>
          <div>
            <label className={label}>
              {s("waterRate")} ({currency})
            </label>
            {numInput(v.water_rate, (x) => setV({ ...v, water_rate: x }))}
          </div>
          <div>
            <label className={label}>
              {s("internet")} ({currency})
            </label>
            {numInput(v.internet_fee, (x) => setV({ ...v, internet_fee: x }))}
          </div>
          <div>
            <label className={label}>
              {s("parking")} ({currency})
            </label>
            {numInput(v.parking_fee, (x) => setV({ ...v, parking_fee: x }))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <p className="mr-auto text-xs text-[var(--app-fg-muted)]">
            {s("moveIn")}: {s("moveInHint")}
          </p>
          {ok && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--app-accent)]">
              <Check size={14} /> {s("saved")}
            </span>
          )}
          <Button onClick={save} loading={busy}>
            <Save size={15} /> {s("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
