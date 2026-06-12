"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import type { RatePlan } from "@/lib/db/rate-plans";
import { useToast } from "@/components/app/ui/Toast";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import { bulkManualRateAction } from "@/app/app/calendar/actions";
import { applyRatePlanAction } from "@/app/app/rate-plans/actions";
import type { RoomTypeBrief } from "./CalendarClient";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "ตั้งราคาเป็นช่วง",
    modeManual: "กำหนดราคาเอง",
    modePlan: "ใช้แผนราคา",
    from: "ตั้งแต่",
    to: "ถึง",
    price: "ราคา/คืน",
    roomTypes: "ประเภทห้อง",
    allTypes: "ทุกประเภท",
    plan: "แผนราคา",
    planNote: "ใช้กับทุกประเภทห้อง",
    noPlans: "ยังไม่มีแผนราคา — สร้างที่หน้าแผนราคา",
    apply: "นำไปใช้",
    cancel: "ยกเลิก",
    applied: "ปรับราคาแล้ว",
    needRange: "เลือกช่วงวันที่ก่อน",
    needPrice: "ใส่ราคา",
    needType: "เลือกอย่างน้อยหนึ่งประเภท",
    cells: "ช่อง",
  },
  en: {
    title: "Set rates for a range",
    modeManual: "Manual price",
    modePlan: "Apply rate plan",
    from: "From",
    to: "To",
    price: "Price/night",
    roomTypes: "Room types",
    allTypes: "All types",
    plan: "Rate plan",
    planNote: "Applies to all room types",
    noPlans: "No rate plans yet — create one on the Rate plans page",
    apply: "Apply",
    cancel: "Cancel",
    applied: "Rates updated",
    needRange: "Pick a date range first",
    needPrice: "Enter a price",
    needType: "Pick at least one room type",
    cells: "cells",
  },
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

export default function BulkRateModal({
  roomTypes,
  plans,
  defaultFrom,
  defaultTo,
  currency,
  onClose,
}: {
  roomTypes: RoomTypeBrief[];
  plans: RatePlan[];
  defaultFrom: string;
  defaultTo: string;
  currency: string;
  onClose: () => void;
}) {
  const { locale: raw } = useI18n();
  const s = STR[raw === "en" ? "en" : "th"];
  const toast = useToast();
  const router = useRouter();

  const [mode, setMode] = useState<"manual" | "plan">("manual");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [price, setPrice] = useState<number | "">("");
  const [typeIds, setTypeIds] = useState<string[]>(roomTypes.map((t) => t.id));
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const allSelected = typeIds.length === roomTypes.length;
  const toggleType = (id: string) =>
    setTypeIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleAll = () =>
    setTypeIds(allSelected ? [] : roomTypes.map((t) => t.id));

  async function apply() {
    if (!from || !to || to < from) return toast.error(s.needRange);
    setSaving(true);
    let res;
    if (mode === "manual") {
      if (price === "" || Number(price) <= 0) {
        setSaving(false);
        return toast.error(s.needPrice);
      }
      if (typeIds.length === 0) {
        setSaving(false);
        return toast.error(s.needType);
      }
      res = await bulkManualRateAction(typeIds, from, to, Number(price));
    } else {
      if (!planId) {
        setSaving(false);
        return toast.error(s.noPlans);
      }
      res = await applyRatePlanAction(planId, from, to);
    }
    setSaving(false);
    if (res.ok) {
      toast.success(`${s.applied} (${res.data.count} ${s.cells})`);
      onClose();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const tab = (m: "manual" | "plan", text: string) => (
    <button
      onClick={() => setMode(m)}
      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        mode === m
          ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
          : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
      }`}
    >
      {text}
    </button>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={s.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {s.cancel}
          </Button>
          <Button onClick={apply} loading={saving}>
            {s.apply}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* mode toggle */}
        <div className="flex gap-1 rounded-xl border border-[var(--app-border)] p-1">
          {tab("manual", s.modeManual)}
          {tab("plan", s.modePlan)}
        </div>

        {/* date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>{s.from}</label>
            <input type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className={label}>{s.to}</label>
            <input type="date" className={field} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {mode === "manual" ? (
          <>
            <div>
              <label className={label}>
                {s.price} ({currency})
              </label>
              <input
                type="number"
                min={0}
                className={field}
                value={price}
                onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div>
              <label className={label}>{s.roomTypes}</label>
              <div className="flex flex-wrap gap-1.5">
                <Chip on={allSelected} onClick={toggleAll}>
                  {s.allTypes}
                </Chip>
                {roomTypes.map((rt) => (
                  <Chip key={rt.id} on={typeIds.includes(rt.id)} onClick={() => toggleType(rt.id)}>
                    {rt.name}
                  </Chip>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className={label}>{s.plan}</label>
            {plans.length === 0 ? (
              <p className="text-sm text-[var(--app-fg-muted)]">{s.noPlans}</p>
            ) : (
              <>
                <select className={field} value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.daily_rate != null ? ` · ${currency} ${p.daily_rate.toLocaleString()}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--app-fg-muted)]">{s.planNote}</p>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        on
          ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
          : "border-[var(--app-border)] text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
      }`}
    >
      {children}
    </button>
  );
}
