"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag, Plus, Trash2, CalendarRange, Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { RatePlan } from "@/lib/db/rate-plans";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import { saveRatePlan, removeRatePlan, applyRatePlanAction } from "@/app/app/rate-plans/actions";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "แผนราคา", sub: "ตั้งราคาสำเร็จรูปแล้วนำไปใช้กับช่วงวันที่ในปฏิทินได้",
    add: "เพิ่มแผนราคา", name: "ชื่อแผน", rate: "ราคา/คืน", color: "สี",
    save: "บันทึก", saved: "บันทึกแล้ว", del: "ลบ", delConfirm: "ลบแผนราคานี้?",
    apply: "ใช้กับช่วงวันที่", from: "ตั้งแต่", to: "ถึง", applyBtn: "นำไปใช้",
    applied: "ปรับราคาแล้ว", empty: "ยังไม่มีแผนราคา", emptyHint: "สร้างแผนราคาแรกของคุณ",
    cancel: "ยกเลิก", needRange: "เลือกช่วงวันที่ก่อน",
  },
  en: {
    title: "Rate plans", sub: "Save pricing presets and apply them to date ranges on the calendar.",
    add: "Add rate plan", name: "Plan name", rate: "Rate/night", color: "Color",
    save: "Save", saved: "Saved", del: "Delete", delConfirm: "Delete this rate plan?",
    apply: "Apply to dates", from: "From", to: "To", applyBtn: "Apply",
    applied: "Rates updated", empty: "No rate plans yet", emptyHint: "Create your first rate plan.",
    cancel: "Cancel", needRange: "Pick a date range first",
  },
};

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";
const SWATCHES = ["#0a84ff", "#30c8c0", "#8b5cf6", "#f59e0b", "#fb7185", "#16a34a"];

interface Draft { id?: string; name: string; daily_rate: number | ""; color: string }

export default function RatePlansClient({ initialPlans, currency }: { initialPlans: RatePlan[]; currency: string }) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [applyFor, setApplyFor] = useState<RatePlan | null>(null);
  const [range, setRange] = useState({ from: "", to: "" });

  async function save() {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    const res = await saveRatePlan({
      id: editing.id,
      name: editing.name.trim(),
      daily_rate: editing.daily_rate === "" ? null : Number(editing.daily_rate),
      color: editing.color,
    });
    setSaving(false);
    if (res.ok) { toast.success(s("saved")); setEditing(null); router.refresh(); }
    else toast.error(`${res.code} · ${res.message}`);
  }
  async function del(p: RatePlan) {
    const res = await removeRatePlan(p.id);
    if (res.ok) { toast.success(s("del")); router.refresh(); }
    else toast.error(`${res.code} · ${res.message}`);
  }
  async function apply() {
    if (!applyFor) return;
    if (!range.from || !range.to || range.to < range.from) { toast.error(s("needRange")); return; }
    setSaving(true);
    const res = await applyRatePlanAction(applyFor.id, range.from, range.to);
    setSaving(false);
    if (res.ok) { toast.success(`${s("applied")} (${res.data.count})`); setApplyFor(null); setRange({ from: "", to: "" }); }
    else toast.error(`${res.code} · ${res.message}`);
  }

  const money = (n: number | null) => (n == null ? "—" : `${currency} ${Number(n).toLocaleString()}`);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
          <p className="text-sm text-[var(--app-fg-muted)]">{s("sub")}</p>
        </div>
        <Button onClick={() => setEditing({ name: "", daily_rate: "", color: SWATCHES[0] })}>
          <Plus size={16} /> {s("add")}
        </Button>
      </div>

      {initialPlans.length === 0 && !editing && (
        <EmptyState icon={<Tag size={22} />} title={s("empty")} hint={s("emptyHint")} />
      )}

      <div className="space-y-2">
        {initialPlans.map((p) => (
          <div key={p.id} className="app-surface flex items-center gap-3 rounded-2xl border border-[var(--app-border)] p-4">
            <span className="h-8 w-2 flex-none rounded-full" style={{ background: p.color }} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-[var(--app-fg-muted)]">{money(p.daily_rate)}</div>
            </div>
            <Button variant="ghost" onClick={() => { setApplyFor(p); setRange({ from: "", to: "" }); }}>
              <CalendarRange size={15} /> {s("apply")}
            </Button>
            <Button variant="ghost" onClick={() => setEditing({ id: p.id, name: p.name, daily_rate: p.daily_rate ?? "", color: p.color })}>
              <Pencil size={14} />
            </Button>
            <button onClick={() => del(p)} aria-label={s("del")} className="text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* edit / create */}
      {editing && (
        <div className="app-surface mt-4 space-y-3 rounded-2xl border border-[var(--app-border)] p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s("name")}</label>
              <input className={`${field} w-full`} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s("rate")}</label>
              <input type="number" min={0} className={`${field} w-full`} value={editing.daily_rate}
                onChange={(e) => setEditing({ ...editing, daily_rate: e.target.value === "" ? "" : Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s("color")}</label>
            <div className="flex gap-2">
              {SWATCHES.map((c) => (
                <button key={c} onClick={() => setEditing({ ...editing, color: c })}
                  className="h-7 w-7 rounded-full ring-offset-2"
                  style={{ background: c, outline: editing.color === c ? "2px solid var(--app-fg)" : "none" }} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={save} loading={saving}>{s("save")}</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>{s("cancel")}</Button>
          </div>
        </div>
      )}

      {/* apply-to-range */}
      {applyFor && (
        <div className="app-surface mt-4 space-y-3 rounded-2xl border border-[var(--app-border)] p-5">
          <div className="flex items-center gap-2 font-semibold">
            <span className="h-4 w-4 rounded-full" style={{ background: applyFor.color }} /> {applyFor.name}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s("from")}</label>
              <input type="date" className={`${field} w-full`} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s("to")}</label>
              <input type="date" className={`${field} w-full`} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={apply} loading={saving}>{s("applyBtn")}</Button>
            <Button variant="ghost" onClick={() => setApplyFor(null)}>{s("cancel")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
