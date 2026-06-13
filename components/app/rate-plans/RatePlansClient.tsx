"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Tag,
  Plus,
  Trash2,
  CalendarRange,
  Pencil,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleSlash,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { RatePlan } from "@/lib/db/rate-plans";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import Modal from "@/components/app/ui/Modal";
import BulkRateModal from "@/components/app/calendar/BulkRateModal";
import {
  saveRatePlan,
  removeRatePlan,
  applyRatePlanAction,
  loadRateCalendar,
  type PlanRateEntry,
} from "@/app/app/rate-plans/actions";

export interface RoomTypeBrief {
  id: string;
  name: string;
  daily_rate: number | null;
}
export interface PlanRateRow {
  rate_plan_id: string;
  room_type_id: string;
  price: number;
}

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "แผนราคา",
    sub: "ตั้งราคาสำเร็จรูปแล้วนำไปใช้กับช่วงวันที่ในปฏิทินได้ — แก้ราคาในแผนแล้วทุกวันที่ผูกไว้จะอัปเดตตาม",
    add: "เพิ่มแผนราคา",
    bulk: "ตั้งราคาเป็นช่วง",
    name: "ชื่อแผน",
    desc: "คำอธิบาย (ไม่บังคับ)",
    rate: "ราคาพื้นฐาน/คืน",
    perType: "ราคาตามประเภทห้อง",
    perTypeHint: "เว้นว่างไว้เพื่อใช้ราคาพื้นฐาน",
    color: "สี",
    activeLabel: "เปิดใช้งาน",
    activeHint: "แผนที่ปิดใช้งานจะไม่แสดงในตัวเลือกตั้งราคาของปฏิทิน",
    active: "ใช้งาน",
    inactive: "ปิดอยู่",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    del: "ลบ",
    delDone: "ลบแล้ว",
    apply: "ใช้กับช่วงวันที่",
    from: "ตั้งแต่",
    to: "ถึง",
    applyBtn: "นำไปใช้",
    applied: "ปรับราคาแล้ว",
    empty: "ยังไม่มีแผนราคา",
    emptyHint: "สร้างแผนราคาแรกของคุณเพื่อตั้งราคาช่วงสุดสัปดาห์ วันหยุด หรือฤดูกาล",
    cancel: "ยกเลิก",
    needName: "ใส่ชื่อแผน",
    needRange: "เลือกช่วงวันที่ก่อน",
    calTitle: "ปฏิทินราคา",
    today: "วันนี้",
    prev: "เดือนก่อน",
    next: "เดือนถัดไป",
    noRate: "ไม่มีราคา",
    cells: "ช่อง",
  },
  en: {
    title: "Rate plans",
    sub: "Save pricing presets and apply them to date ranges. Edit a plan and every linked day on the calendar updates automatically.",
    add: "Add rate plan",
    bulk: "Bulk rates",
    name: "Plan name",
    desc: "Description (optional)",
    rate: "Base rate/night",
    perType: "Per-room-type rates",
    perTypeHint: "Leave blank to use the base rate",
    color: "Color",
    activeLabel: "Active",
    activeHint: "Inactive plans are hidden from the calendar bulk-rate dropdown.",
    active: "Active",
    inactive: "Inactive",
    save: "Save",
    saved: "Saved",
    del: "Delete",
    delDone: "Deleted",
    apply: "Apply to dates",
    from: "From",
    to: "To",
    applyBtn: "Apply",
    applied: "Rates updated",
    empty: "No rate plans yet",
    emptyHint: "Create your first rate plan to standardise weekend, holiday, or seasonal pricing.",
    cancel: "Cancel",
    needName: "Enter a plan name",
    needRange: "Pick a date range first",
    calTitle: "Rate calendar",
    today: "Today",
    prev: "Prev month",
    next: "Next month",
    noRate: "no rate",
    cells: "cells",
  },
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";
const SWATCHES = ["#0a84ff", "#30c8c0", "#8b5cf6", "#f59e0b", "#fb7185", "#16a34a", "#ef4444", "#64748b"];

interface Draft {
  id?: string;
  name: string;
  description: string;
  daily_rate: number | "";
  color: string;
  active: boolean;
  rates: Record<string, number | "">; // room_type_id → override price
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function RatePlansClient({
  initialPlans,
  roomTypes,
  planRates,
  currency,
}: {
  initialPlans: RatePlan[];
  roomTypes: RoomTypeBrief[];
  planRates: PlanRateRow[];
  currency: string;
}) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [applyFor, setApplyFor] = useState<RatePlan | null>(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const [bulkOpen, setBulkOpen] = useState(false);

  // rate_plan_rates indexed by plan → type → price, for list chips + prefill.
  const ratesByPlan = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const r of planRates) (m[r.rate_plan_id] ??= {})[r.room_type_id] = r.price;
    return m;
  }, [planRates]);

  const typeName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const rt of roomTypes) m[rt.id] = rt.name;
    return m;
  }, [roomTypes]);

  const money = (n: number | null | undefined) =>
    n == null ? "—" : `${currency} ${Number(n).toLocaleString()}`;

  function startNew() {
    setEditing({
      name: "",
      description: "",
      daily_rate: "",
      color: SWATCHES[0],
      active: true,
      rates: Object.fromEntries(roomTypes.map((rt) => [rt.id, ""])),
    });
  }
  function startEdit(p: RatePlan) {
    const ov = ratesByPlan[p.id] ?? {};
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      daily_rate: p.daily_rate ?? "",
      color: p.color,
      active: p.active,
      rates: Object.fromEntries(roomTypes.map((rt) => [rt.id, ov[rt.id] ?? ""])),
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error(s("needName"));
    setSaving(true);
    const rates: PlanRateEntry[] = roomTypes.map((rt) => {
      const v = editing.rates[rt.id];
      return { room_type_id: rt.id, price: v === "" || v == null ? null : Number(v) };
    });
    const res = await saveRatePlan({
      id: editing.id,
      name: editing.name.trim(),
      description: editing.description.trim() || null,
      daily_rate: editing.daily_rate === "" ? null : Number(editing.daily_rate),
      color: editing.color,
      active: editing.active,
      rates,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(s("saved"));
      setEditing(null);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function del(p: RatePlan) {
    const res = await removeRatePlan(p.id);
    if (res.ok) {
      toast.success(s("delDone"));
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function apply() {
    if (!applyFor) return;
    if (!range.from || !range.to || range.to < range.from) return toast.error(s("needRange"));
    setSaving(true);
    const res = await applyRatePlanAction(applyFor.id, range.from, range.to);
    setSaving(false);
    if (res.ok) {
      toast.success(`${s("applied")} (${res.data.count} ${s("cells")})`);
      setApplyFor(null);
      setRange({ from: "", to: "" });
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
          <p className="text-sm text-[var(--app-fg-muted)]">{s("sub")}</p>
        </div>
        <div className="flex flex-none gap-2">
          <Button variant="ghost" onClick={() => setBulkOpen(true)}>
            <Banknote size={16} /> {s("bulk")}
          </Button>
          <Button onClick={startNew}>
            <Plus size={16} /> {s("add")}
          </Button>
        </div>
      </div>

      {initialPlans.length === 0 && !editing && (
        <EmptyState icon={<Tag size={22} />} title={s("empty")} hint={s("emptyHint")} />
      )}

      <div className="space-y-2">
        {initialPlans.map((p) => {
          const ov = ratesByPlan[p.id] ?? {};
          const ovEntries = roomTypes.filter((rt) => ov[rt.id] != null);
          return (
            <div
              key={p.id}
              className="app-surface flex items-start gap-3 rounded-2xl border border-[var(--app-border)] p-4"
            >
              <span className="mt-0.5 h-8 w-2 flex-none rounded-full" style={{ background: p.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {p.active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_15%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--app-accent)]">
                      <CheckCircle2 size={11} /> {s("active")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--app-fg-muted)]">
                      <CircleSlash size={11} /> {s("inactive")}
                    </span>
                  )}
                </div>
                {p.description && (
                  <div className="mt-0.5 text-sm text-[var(--app-fg-muted)]">{p.description}</div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2 py-0.5">
                    {s("rate")}: <strong>{money(p.daily_rate)}</strong>
                  </span>
                  {ovEntries.map((rt) => (
                    <span
                      key={rt.id}
                      className="rounded-lg border border-[var(--app-border)] px-2 py-0.5 text-xs text-[var(--app-fg-muted)]"
                    >
                      {rt.name}: {money(ov[rt.id])}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-none items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setApplyFor(p);
                    setRange({ from: "", to: "" });
                  }}
                >
                  <CalendarRange size={15} /> {s("apply")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(p)} aria-label={s("save")}>
                  <Pencil size={14} />
                </Button>
                <button
                  onClick={() => del(p)}
                  aria-label={s("del")}
                  className="grid h-8 w-8 place-items-center rounded-lg text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rate calendar — month grid showing the applied plan + price per day. */}
      <RateCalendar plans={initialPlans} roomTypes={roomTypes} currency={currency} s={s} locale={locale} />

      {/* create / edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? s("save") + " · " + (editing?.name || "") : s("add")}
        className="max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {s("cancel")}
            </Button>
            <Button onClick={save} loading={saving}>
              {s("save")}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{s("name")}</label>
                <input
                  className={field}
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelCls}>
                  {s("rate")} ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={editing.daily_rate}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      daily_rate: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>{s("desc")}</label>
              <input
                className={field}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>

            {roomTypes.length > 0 && (
              <div>
                <label className={labelCls}>{s("perType")}</label>
                <div className="space-y-1.5 rounded-xl border border-[var(--app-border)] p-2.5">
                  {roomTypes.map((rt) => (
                    <div key={rt.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{rt.name}</span>
                      <input
                        type="number"
                        min={0}
                        placeholder={
                          editing.daily_rate !== "" ? String(editing.daily_rate) : s("perTypeHint")
                        }
                        className={`${field} w-32`}
                        value={editing.rates[rt.id] ?? ""}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            rates: {
                              ...editing.rates,
                              [rt.id]: e.target.value === "" ? "" : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-[var(--app-fg-muted)]">{s("perTypeHint")}</p>
              </div>
            )}

            <div>
              <label className={labelCls}>{s("color")}</label>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditing({ ...editing, color: c })}
                    className="h-7 w-7 rounded-full"
                    style={{
                      background: c,
                      outline: editing.color === c ? "2px solid var(--app-fg)" : "none",
                      outlineOffset: 2,
                    }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
              <span className="text-sm font-medium">{s("activeLabel")}</span>
              <span className="text-xs text-[var(--app-fg-muted)]">— {s("activeHint")}</span>
            </label>
          </div>
        )}
      </Modal>

      {/* apply-to-range modal */}
      <Modal
        open={!!applyFor}
        onClose={() => setApplyFor(null)}
        title={applyFor ? `${s("apply")} · ${applyFor.name}` : s("apply")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setApplyFor(null)}>
              {s("cancel")}
            </Button>
            <Button onClick={apply} loading={saving}>
              {s("applyBtn")}
            </Button>
          </>
        }
      >
        {applyFor && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-4 w-4 rounded-full" style={{ background: applyFor.color }} />
              {applyFor.name}
              <span className="font-normal text-[var(--app-fg-muted)]">{money(applyFor.daily_rate)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{s("from")}</label>
                <input
                  type="date"
                  className={field}
                  value={range.from}
                  onChange={(e) => setRange({ ...range, from: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>{s("to")}</label>
                <input
                  type="date"
                  className={field}
                  value={range.to}
                  onChange={(e) => setRange({ ...range, to: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* standalone bulk-rate modal (manual price over a range) */}
      {bulkOpen && (
        <BulkRateModal
          roomTypes={roomTypes}
          plans={initialPlans.filter((p) => p.active)}
          defaultFrom={isoToday()}
          defaultTo={addDaysISO(isoToday(), 6)}
          currency={currency}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </div>
  );
}

// ── Rate calendar month grid ─────────────────────────────────────────────────
// One cell per day. daily_rates is keyed by (room_type_id, date) so a day has
// up to N rows; we derive the plan chip from the rows' shared plan_id and show
// the price as a single value or a "from" range across types.
function RateCalendar({
  plans,
  roomTypes,
  currency,
  s,
  locale,
}: {
  plans: RatePlan[];
  roomTypes: RoomTypeBrief[];
  currency: string;
  s: (k: string) => string;
  locale: "th" | "en";
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [rows, setRows] = useState<
    Array<{ date: string; room_type_id: string; plan_id: string | null; price: number }>
  >([]);

  const planById = useMemo(() => {
    const m: Record<string, RatePlan> = {};
    for (const p of plans) m[p.id] = p;
    return m;
  }, [plans]);

  useEffect(() => {
    let cancelled = false;
    const first = new Date(Date.UTC(year, month, 1));
    const last = new Date(Date.UTC(year, month + 1, 0));
    const fromISO = addDaysISO(first.toISOString().slice(0, 10), -7);
    const toISO = addDaysISO(last.toISOString().slice(0, 10), 7);
    loadRateCalendar(fromISO, toISO).then((res) => {
      if (cancelled) return;
      setRows(res.ok ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  // Aggregate rows → per-day { plan_id (if all share), prices[] }.
  const byDate = useMemo(() => {
    const m: Record<string, { planIds: Set<string>; prices: number[] }> = {};
    for (const r of rows) {
      const e = (m[r.date] ??= { planIds: new Set(), prices: [] });
      if (r.plan_id) e.planIds.add(r.plan_id);
      e.prices.push(r.price);
    }
    return m;
  }, [rows]);

  const grid = useMemo(() => {
    const cells: Date[] = [];
    const first = new Date(Date.UTC(year, month, 1));
    const dow = (first.getUTCDay() + 6) % 7; // 0=Mon..6=Sun
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - dow);
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      cells.push(d);
    }
    return cells;
  }, [year, month]);

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  const todayISO = isoToday();
  const isThisMonth = year === now.getFullYear() && month === now.getMonth();
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString(
    locale === "th" ? "th-TH" : "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" }
  );
  const weekdays =
    locale === "th"
      ? ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const fmt = (n: number) => `${currency} ${Number(n).toLocaleString()}`;

  // Legend: distinct plans visible in the current month.
  const monthPlans = useMemo(() => {
    const ids = new Set<string>();
    for (const d of grid) {
      if (d.getUTCMonth() !== month) continue;
      const e = byDate[d.toISOString().slice(0, 10)];
      if (e) for (const id of e.planIds) ids.add(id);
    }
    return Array.from(ids)
      .map((id) => planById[id])
      .filter(Boolean);
  }, [grid, byDate, month, planById]);

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays size={18} />
        <h2 className="text-lg font-semibold">{s("calTitle")}</h2>
        <div className="flex-1" />
        <button
          onClick={() => shift(-1)}
          aria-label={s("prev")}
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-[140px] text-center text-sm font-medium">{monthLabel}</div>
        <button
          onClick={() => shift(1)}
          aria-label={s("next")}
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
        >
          <ChevronRight size={16} />
        </button>
        {!isThisMonth && (
          <button
            onClick={() => {
              setYear(now.getFullYear());
              setMonth(now.getMonth());
            }}
            className="rounded-lg border border-[var(--app-border)] px-3 py-1 text-xs hover:bg-[var(--app-surface-2)]"
          >
            {s("today")}
          </button>
        )}
      </div>

      {monthPlans.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          {monthPlans.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
              style={{ background: `color-mix(in srgb, ${p.color} 15%, transparent)`, color: "var(--app-fg)" }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
              {p.daily_rate != null ? ` · ${fmt(p.daily_rate)}` : ""}
            </span>
          ))}
        </div>
      )}

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-[var(--app-fg-muted)]">
        {weekdays.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          const iso = d.toISOString().slice(0, 10);
          const inMonth = d.getUTCMonth() === month;
          const isToday = iso === todayISO;
          const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
          const e = byDate[iso];
          const planId = e && e.planIds.size === 1 ? Array.from(e.planIds)[0] : null;
          const plan = planId ? planById[planId] : null;
          const prices = e?.prices ?? [];
          const minP = prices.length ? Math.min(...prices) : null;
          const maxP = prices.length ? Math.max(...prices) : null;
          const priceLabel =
            minP == null
              ? null
              : minP === maxP
                ? fmt(minP)
                : `${locale === "th" ? "ตั้งแต่ " : "from "}${fmt(minP)}`;
          const bg = plan
            ? `color-mix(in srgb, ${plan.color} ${inMonth ? "16%" : "8%"}, transparent)`
            : inMonth && isWeekend
              ? "var(--app-surface-2)"
              : "transparent";
          return (
            <div
              key={i}
              title={
                plan
                  ? `${iso} — ${plan.name}${priceLabel ? ": " + priceLabel : ""}`
                  : `${iso}${priceLabel ? " — " + priceLabel : " — " + s("noRate")}`
              }
              className="flex min-h-[62px] flex-col gap-1 rounded-lg border p-1.5 text-[11px]"
              style={{
                background: bg,
                opacity: inMonth ? 1 : 0.4,
                borderColor: isToday ? "var(--app-accent)" : "var(--app-border)",
                borderWidth: isToday ? 2 : 1,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-semibold"
                  style={{ color: isToday ? "var(--app-accent)" : "var(--app-fg)" }}
                >
                  {d.getUTCDate()}
                </span>
                {plan && (
                  <span
                    className="max-w-[68%] truncate rounded px-1 text-[9px] font-semibold text-white"
                    style={{ background: plan.color }}
                  >
                    {plan.name}
                  </span>
                )}
              </div>
              {priceLabel && (
                <div className="mt-auto truncate font-semibold text-[var(--app-fg)]">{priceLabel}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
