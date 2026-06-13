"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  DoorClosed,
  Building2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  MaintenanceOrder,
  MaintenanceStatus,
  MaintenanceIssueType,
  Priority,
} from "@/lib/db/operations";
import type { Room } from "@/lib/db/rooms";
import { useToast } from "@/components/app/ui/Toast";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import { newMaintenance, saveMaintenance, removeMaintenance } from "@/app/app/maintenance/actions";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "งานซ่อมบำรุง",
    sub: "ติดตามงานซ่อม ห้องที่ปิดให้บริการ และรายได้ที่เสียไป",
    new: "เพิ่มงานซ่อม",
    open: "ค้างอยู่",
    inProgress: "กำลังทำ",
    resolved: "เสร็จแล้ว",
    all: "ทั้งหมด",
    kpiOpen: "งานค้าง",
    kpiInProgress: "กำลังทำ",
    kpiRevenueLost: "รายได้ที่เสียไป",
    kpiDowntime: "วันที่ปิดบริการ",
    kpiAvgDowntime: "เฉลี่ยต่องาน",
    days: "วัน",
    propertyWide: "ทั้งอาคาร",
    room: "ห้อง",
    cost: "ค่าใช้จ่าย",
    revenueLost: "รายได้ที่เสีย",
    oos: "ปิดบริการ",
    reported: "แจ้งเมื่อ",
    // period
    p1m: "1 เดือน",
    p3m: "3 เดือน",
    p6m: "6 เดือน",
    p1y: "1 ปี",
    pAll: "ทั้งหมด",
    // charts
    chartByRoom: "รายได้ที่เสียตามห้อง",
    chartByType: "งานซ่อมตามประเภท",
    breakdownTitle: "ปัญหาตามประเภท · ห้องเรียงตามวันปิดบริการ",
    issue: "งาน",
    issues: "งาน",
    // modal
    editTitle: "แก้ไขงานซ่อม",
    newTitle: "เพิ่มงานซ่อม",
    fTitle: "หัวข้อ",
    fIssueType: "ประเภทปัญหา",
    fRoom: "ห้อง",
    fDescription: "รายละเอียด",
    fPriority: "ความสำคัญ",
    fStatus: "สถานะ",
    fCost: "ค่าใช้จ่าย",
    fRevenueLost: "รายได้ที่เสีย",
    fOosFrom: "ปิดตั้งแต่",
    fOosTo: "ปิดถึง",
    markResolved: "ทำเครื่องหมายเสร็จ",
    delete: "ลบ",
    delConfirm: "ลบงานซ่อมนี้?",
    save: "บันทึก",
    cancel: "ยกเลิก",
    saved: "บันทึกแล้ว",
    created: "เพิ่มงานซ่อมแล้ว",
    deleted: "ลบแล้ว",
    resolvedToast: "ทำเครื่องหมายเสร็จแล้ว",
    needTitle: "ใส่หัวข้องานซ่อม",
    // priority labels
    pLow: "ต่ำ",
    pNormal: "ปกติ",
    pHigh: "สูง",
    pUrgent: "ด่วน",
    // status labels
    sOpen: "ค้างอยู่",
    sInProgress: "กำลังทำ",
    sResolved: "เสร็จแล้ว",
    // issue-type labels
    itWater: "น้ำประปา",
    itElectricity: "ไฟฟ้า",
    itAirConditioner: "เครื่องปรับอากาศ",
    itFurniture: "เฟอร์นิเจอร์",
    itToilet: "ห้องน้ำ",
    itOther: "อื่นๆ",
    itNone: "ไม่ระบุ",
    empty: "ยังไม่มีงานซ่อม",
    emptyHint: "เพิ่มงานซ่อมแรกของคุณ",
    emptyFiltered: "ไม่มีงานซ่อมในหมวดนี้",
    emptyFilteredHint: "ลองเปลี่ยนตัวกรองสถานะ",
  },
  en: {
    title: "Maintenance",
    sub: "Track repair orders, out-of-service rooms, and lost revenue.",
    new: "New order",
    open: "Open",
    inProgress: "In-progress",
    resolved: "Resolved",
    all: "All",
    kpiOpen: "Open",
    kpiInProgress: "In-progress",
    kpiRevenueLost: "Revenue lost",
    kpiDowntime: "OOS days",
    kpiAvgDowntime: "Avg downtime",
    days: "days",
    propertyWide: "Property-wide",
    room: "Room",
    cost: "Cost",
    revenueLost: "Revenue lost",
    oos: "OOS",
    reported: "Reported",
    // period
    p1m: "1 month",
    p3m: "3 months",
    p6m: "6 months",
    p1y: "1 year",
    pAll: "All time",
    // charts
    chartByRoom: "Revenue lost by room",
    chartByType: "Issues by type",
    breakdownTitle: "Problems by type · rooms by downtime",
    issue: "issue",
    issues: "issues",
    // modal
    editTitle: "Edit order",
    newTitle: "New order",
    fTitle: "Title",
    fIssueType: "Issue type",
    fRoom: "Room",
    fDescription: "Description",
    fPriority: "Priority",
    fStatus: "Status",
    fCost: "Cost",
    fRevenueLost: "Revenue lost",
    fOosFrom: "OOS from",
    fOosTo: "OOS to",
    markResolved: "Mark resolved",
    delete: "Delete",
    delConfirm: "Delete this order?",
    save: "Save",
    cancel: "Cancel",
    saved: "Saved",
    created: "Order created",
    deleted: "Deleted",
    resolvedToast: "Marked resolved",
    needTitle: "Enter a title",
    // priority labels
    pLow: "Low",
    pNormal: "Normal",
    pHigh: "High",
    pUrgent: "Urgent",
    // status labels
    sOpen: "Open",
    sInProgress: "In-progress",
    sResolved: "Resolved",
    // issue-type labels
    itWater: "Water",
    itElectricity: "Electricity",
    itAirConditioner: "Air conditioner",
    itFurniture: "Furniture",
    itToilet: "Toilet",
    itOther: "Other",
    itNone: "Unspecified",
    empty: "No maintenance orders yet",
    emptyHint: "Create your first order.",
    emptyFiltered: "No orders in this view",
    emptyFilteredHint: "Try a different status filter.",
  },
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

const STATUS_COLOR: Record<MaintenanceStatus, string> = {
  open: "#d97706",
  "in-progress": "#2563eb",
  resolved: "var(--app-success)",
};

// Issue-type taxonomy with a FIXED palette — mirrors hotel-pms ISSUE_TYPES.
// Hues drive the donut slice, breakdown dot/bar, and type-pill tint + border.
// `labelKey` resolves to the bilingual STR label at render time.
const ISSUE_TYPES: { key: MaintenanceIssueType; labelKey: string; color: string }[] = [
  { key: "water", labelKey: "itWater", color: "#3b82f6" },
  { key: "electricity", labelKey: "itElectricity", color: "#f59e0b" },
  { key: "air-conditioner", labelKey: "itAirConditioner", color: "#10b981" },
  { key: "furniture", labelKey: "itFurniture", color: "#a855f7" },
  { key: "toilet", labelKey: "itToilet", color: "#0ea5e9" },
  { key: "other", labelKey: "itOther", color: "#6b7280" },
];
const ISSUE_TYPE_MAP = new Map(ISSUE_TYPES.map((t) => [t.key, t]));
function issueColor(t: MaintenanceIssueType | null): string {
  return (t && ISSUE_TYPE_MAP.get(t)?.color) || "#9ca3af";
}

const PERIODS: { id: string; labelKey: string }[] = [
  { id: "1m", labelKey: "p1m" },
  { id: "3m", labelKey: "p3m" },
  { id: "6m", labelKey: "p6m" },
  { id: "1y", labelKey: "p1y" },
  { id: "all", labelKey: "pAll" },
];

// Whole-day downtime between oos_from and oos_to (inclusive of from, exclusive
// of to). Falls back to 0 when the dates are missing or malformed.
function downtimeDays(o: MaintenanceOrder): number {
  if (!o.oos_from) return 0;
  const start = new Date(o.oos_from).getTime();
  const end = o.oos_to ? new Date(o.oos_to).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86400000));
}

type Tab = MaintenanceStatus | "all";

interface FormState {
  room_id: string;
  title: string;
  issue_type: MaintenanceIssueType | "";
  description: string;
  priority: Priority;
  status: MaintenanceStatus;
  cost: number | "";
  revenue_lost: number | "";
  oos_from: string;
  oos_to: string;
}

const EMPTY_FORM: FormState = {
  room_id: "",
  title: "",
  issue_type: "",
  description: "",
  priority: "normal",
  status: "open",
  cost: "",
  revenue_lost: "",
  oos_from: "",
  oos_to: "",
};

export default function MaintenanceClient({
  orders,
  rooms,
  currency,
  period = "1y",
}: {
  orders: MaintenanceOrder[];
  rooms: Room[];
  currency: string;
  period?: string;
}) {
  const { locale } = useI18n();
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("open");
  const [editing, setEditing] = useState<MaintenanceOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const roomNumber = (roomId: string | null) =>
    roomId ? rooms.find((x) => x.id === roomId)?.number ?? null : null;
  const roomLabel = (roomId: string | null) => {
    const n = roomNumber(roomId);
    return n ? `${s("room")} ${n}` : s("propertyWide");
  };
  const issueLabel = (t: MaintenanceIssueType | null) =>
    t ? s(ISSUE_TYPE_MAP.get(t)?.labelKey ?? "itOther") : s("itNone");

  const priorityLabel = (p: Priority) =>
    p === "low" ? s("pLow") : p === "high" ? s("pHigh") : p === "urgent" ? s("pUrgent") : s("pNormal");
  const statusLabel = (st: MaintenanceStatus) =>
    st === "in-progress" ? s("sInProgress") : st === "resolved" ? s("sResolved") : s("sOpen");

  const money = (n: number | null) => `${currency} ${Number(n).toLocaleString()}`;
  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale === "th" ? "th-TH" : "en-GB");
  };

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const openCount = useMemo(() => orders.filter((o) => o.status === "open").length, [orders]);
  const inProgressCount = useMemo(
    () => orders.filter((o) => o.status === "in-progress").length,
    [orders]
  );
  const totalRevenueLost = useMemo(
    () => orders.reduce((sum, o) => sum + (o.revenue_lost ?? 0), 0),
    [orders]
  );
  const totalDowntime = useMemo(
    () => orders.reduce((sum, o) => sum + downtimeDays(o), 0),
    [orders]
  );
  const avgDowntime = useMemo(
    () => (orders.length ? totalDowntime / orders.length : 0),
    [orders, totalDowntime]
  );

  // ── Chart 1: revenue lost per room (top 12) ───────────────────────────────
  const byRoom = useMemo(() => {
    const m = new Map<string, { room: string; revenue: number }>();
    for (const o of orders) {
      const n = roomNumber(o.room_id);
      if (!n) continue;
      const cur = m.get(n) || { room: n, revenue: 0 };
      cur.revenue += o.revenue_lost ?? 0;
      m.set(n, cur);
    }
    return [...m.values()].filter((r) => r.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 12);
  }, [orders, rooms]);

  // ── Chart 2: issue count by type ──────────────────────────────────────────
  const byType = useMemo(() => {
    const m = new Map<MaintenanceIssueType, number>();
    for (const o of orders) {
      const k = o.issue_type ?? "other";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([key, value]) => ({ key, value, color: issueColor(key), label: issueLabel(key) }))
      .sort((a, b) => b.value - a.value);
  }, [orders, locale]);

  // ── Breakdown: by issue type → rooms ranked by downtime ───────────────────
  const byTypeAndRoom = useMemo(() => {
    const types = new Map<
      MaintenanceIssueType,
      { count: number; days: number; revenue: number; rooms: Map<string, { count: number; days: number; revenue: number }> }
    >();
    for (const o of orders) {
      const tk = o.issue_type ?? "other";
      if (!types.has(tk)) types.set(tk, { count: 0, days: 0, revenue: 0, rooms: new Map() });
      const tg = types.get(tk)!;
      const d = downtimeDays(o);
      const rev = o.revenue_lost ?? 0;
      tg.count += 1;
      tg.days += d;
      tg.revenue += rev;
      const rn = roomNumber(o.room_id) ?? s("propertyWide");
      if (!tg.rooms.has(rn)) tg.rooms.set(rn, { count: 0, days: 0, revenue: 0 });
      const r = tg.rooms.get(rn)!;
      r.count += 1;
      r.days += d;
      r.revenue += rev;
    }
    return [...types.entries()]
      .map(([key, val]) => ({
        key,
        label: issueLabel(key),
        color: issueColor(key),
        count: val.count,
        days: val.days,
        revenue: val.revenue,
        rooms: [...val.rooms.entries()]
          .map(([room, v]) => ({ room, ...v }))
          .sort((a, b) => b.days - a.days),
      }))
      .sort((a, b) => b.days - a.days);
  }, [orders, locale]);

  const filtered = useMemo(
    () => (tab === "all" ? orders : orders.filter((o) => o.status === tab)),
    [orders, tab]
  );

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
  }
  function openEdit(o: MaintenanceOrder) {
    setForm({
      room_id: o.room_id ?? "",
      title: o.title,
      issue_type: o.issue_type ?? "",
      description: o.description ?? "",
      priority: o.priority,
      status: o.status,
      cost: o.cost ?? "",
      revenue_lost: o.revenue_lost ?? "",
      oos_from: o.oos_from ?? "",
      oos_to: o.oos_to ?? "",
    });
    setEditing(o);
    setCreating(false);
  }
  function closeModal() {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  }

  function buildInput() {
    return {
      room_id: form.room_id === "" ? null : form.room_id,
      title: form.title.trim(),
      issue_type: form.issue_type === "" ? null : (form.issue_type as MaintenanceIssueType),
      description: form.description.trim() === "" ? null : form.description.trim(),
      status: form.status,
      priority: form.priority,
      cost: form.cost === "" ? null : Number(form.cost),
      revenue_lost: form.revenue_lost === "" ? null : Number(form.revenue_lost),
      oos_from: form.oos_from === "" ? null : form.oos_from,
      oos_to: form.oos_to === "" ? null : form.oos_to,
    };
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error(s("needTitle"));
      return;
    }
    setSaving(true);
    const res = editing
      ? await saveMaintenance(editing.id, buildInput())
      : await newMaintenance(buildInput());
    setSaving(false);
    if (res.ok) {
      toast.success(editing ? s("saved") : s("created"));
      closeModal();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function markResolved() {
    if (!editing) return;
    setSaving(true);
    const res = await saveMaintenance(editing.id, { status: "resolved" });
    setSaving(false);
    if (res.ok) {
      toast.success(s("resolvedToast"));
      closeModal();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function del() {
    if (!editing) return;
    if (!window.confirm(s("delConfirm"))) return;
    setSaving(true);
    const res = await removeMaintenance(editing.id);
    setSaving(false);
    if (res.ok) {
      toast.success(s("deleted"));
      closeModal();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const TABS: { key: Tab; text: string }[] = [
    { key: "open", text: s("open") },
    { key: "in-progress", text: s("inProgress") },
    { key: "resolved", text: s("resolved") },
    { key: "all", text: s("all") },
  ];

  const modalOpen = creating || editing != null;
  const hasCharts = byRoom.length > 0 || byType.length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      {/* header */}
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
          <p className="text-sm text-[var(--app-fg-muted)]">{s("sub")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> {s("new")}
        </Button>
      </div>

      {/* period chips — server re-reads ?period=… on the next render */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => {
          const active = p.id === period;
          return (
            <button
              key={p.id}
              onClick={() => router.push(`/app/maintenance?period=${p.id}`, { scroll: false })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                  : "border-[var(--app-border)] text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
              }`}
            >
              {s(p.labelKey)}
            </button>
          );
        })}
      </div>

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={s("kpiOpen")} value={String(openCount)} />
        <Kpi label={s("kpiDowntime")} value={`${totalDowntime} ${s("days")}`} />
        <Kpi label={s("kpiRevenueLost")} value={money(totalRevenueLost)} />
        <Kpi label={s("kpiAvgDowntime")} value={`${avgDowntime.toFixed(1)} ${s("days")}`} />
      </div>

      {/* charts */}
      {hasCharts && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <Card title={s("chartByRoom")}>
            <RevenueByRoomChart data={byRoom} money={money} />
          </Card>
          <Card title={s("chartByType")}>
            <IssueTypeDonut data={byType} />
          </Card>
        </div>
      )}

      {/* breakdown: by type → rooms ranked by downtime */}
      {byTypeAndRoom.length > 0 && (
        <Card title={s("breakdownTitle")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {byTypeAndRoom.map((tg) => {
              const maxDays = tg.rooms[0]?.days || 0;
              return (
                <div key={tg.key} className="rounded-xl border border-[var(--app-border)] p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-[var(--app-border)] pb-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: tg.color }}
                    />
                    <span className="text-sm font-semibold">{tg.label}</span>
                    <span className="ml-auto text-xs text-[var(--app-fg-muted)]">
                      {tg.count} {tg.count === 1 ? s("issue") : s("issues")} · {tg.days} {s("days")} ·{" "}
                      {money(tg.revenue)}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {tg.rooms.map((r, idx) => (
                      <li key={r.room} className="flex items-center gap-2 text-sm">
                        <span className="w-6 shrink-0 text-xs font-semibold text-[var(--app-fg-muted)]">
                          #{idx + 1}
                        </span>
                        <span className="w-20 shrink-0 truncate font-medium">
                          {r.room === s("propertyWide") ? r.room : `${s("room")} ${r.room}`}
                        </span>
                        <span className="h-2 flex-1 rounded-full bg-[var(--app-surface-2)]">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${maxDays ? Math.max(4, (r.days / maxDays) * 100) : 0}%`,
                              background: tg.color,
                              opacity: 0.55,
                            }}
                          />
                        </span>
                        <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums">
                          {r.days} {s("days")}
                        </span>
                        <span className="w-8 shrink-0 text-right text-xs text-[var(--app-fg-muted)]">
                          ×{r.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* status filter tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-[var(--app-border)] p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
            }`}
          >
            {t.text}
          </button>
        ))}
      </div>

      {/* list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Wrench size={22} />}
          title={orders.length === 0 ? s("empty") : s("emptyFiltered")}
          hint={orders.length === 0 ? s("emptyHint") : s("emptyFilteredHint")}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const dt = downtimeDays(o);
            return (
              <button
                key={o.id}
                onClick={() => openEdit(o)}
                className="app-surface w-full rounded-2xl border border-[var(--app-border)] p-4 text-left transition hover:bg-[var(--app-surface-2)]"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{o.title}</span>
                      {o.issue_type && (
                        <IssueTypeChip type={o.issue_type} label={issueLabel(o.issue_type)} />
                      )}
                      <StatusChip status={o.status} label={statusLabel(o.status)} />
                      <PriorityChip priority={o.priority} label={priorityLabel(o.priority)} />
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--app-fg-muted)]">
                      <span className="inline-flex items-center gap-1">
                        {o.room_id ? <DoorClosed size={14} /> : <Building2 size={14} />}
                        {roomLabel(o.room_id)}
                      </span>
                      {o.cost != null && (
                        <span>
                          {s("cost")}: {money(o.cost)}
                        </span>
                      )}
                      {o.revenue_lost != null && (
                        <span>
                          {s("revenueLost")}: {money(o.revenue_lost)}
                        </span>
                      )}
                      {(o.oos_from || o.oos_to) && (
                        <span>
                          {s("oos")}: {fmtDate(o.oos_from)}
                          {o.oos_to ? ` → ${fmtDate(o.oos_to)}` : ""}
                          {dt > 0 ? ` (${dt} ${s("days")})` : ""}
                        </span>
                      )}
                      <span>
                        {s("reported")}: {fmtDate(o.reported_at)}
                      </span>
                    </div>

                    {o.description && (
                      <p className="mt-1.5 text-sm text-[var(--app-fg-muted)]">{o.description}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* create / edit modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? s("editTitle") : s("newTitle")}
        footer={
          <>
            {editing && (
              <>
                <button
                  onClick={del}
                  className="mr-auto inline-flex items-center gap-1.5 rounded-xl px-2 text-sm text-[var(--app-fg-muted)] transition-colors hover:text-[var(--app-danger)]"
                >
                  <Trash2 size={15} /> {s("delete")}
                </button>
                {editing.status !== "resolved" && (
                  <Button variant="ghost" onClick={markResolved} loading={saving}>
                    <CheckCircle2 size={15} /> {s("markResolved")}
                  </Button>
                )}
              </>
            )}
            <Button variant="ghost" onClick={closeModal}>
              {s("cancel")}
            </Button>
            <Button onClick={save} loading={saving}>
              {s("save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className={label}>{s("fTitle")}</label>
            <input
              className={field}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
          </div>

          {/* issue type — fixed palette pills */}
          <div>
            <label className={label}>{s("fIssueType")}</label>
            <div className="flex flex-wrap gap-1.5">
              {ISSUE_TYPES.map((it) => {
                const active = form.issue_type === it.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, issue_type: active ? "" : it.key })
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition"
                    style={{
                      borderColor: active ? it.color : "var(--app-border)",
                      background: active
                        ? `color-mix(in srgb, ${it.color} 16%, transparent)`
                        : "transparent",
                      color: active ? it.color : "var(--app-fg-muted)",
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
                    {s(it.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={label}>{s("fRoom")}</label>
            <select
              className={field}
              value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value })}
            >
              <option value="">{s("propertyWide")}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {s("room")} {r.number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>{s("fDescription")}</label>
            <textarea
              className={field}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{s("fPriority")}</label>
              <select
                className={field}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
              >
                <option value="low">{s("pLow")}</option>
                <option value="normal">{s("pNormal")}</option>
                <option value="high">{s("pHigh")}</option>
                <option value="urgent">{s("pUrgent")}</option>
              </select>
            </div>
            <div>
              <label className={label}>{s("fStatus")}</label>
              <select
                className={field}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as MaintenanceStatus })}
              >
                <option value="open">{s("sOpen")}</option>
                <option value="in-progress">{s("sInProgress")}</option>
                <option value="resolved">{s("sResolved")}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>
                {s("fCost")} ({currency})
              </label>
              <input
                type="number"
                min={0}
                className={field}
                value={form.cost}
                onChange={(e) =>
                  setForm({ ...form, cost: e.target.value === "" ? "" : Number(e.target.value) })
                }
                placeholder="0"
              />
            </div>
            <div>
              <label className={label}>
                {s("fRevenueLost")} ({currency})
              </label>
              <input
                type="number"
                min={0}
                className={field}
                value={form.revenue_lost}
                onChange={(e) =>
                  setForm({
                    ...form,
                    revenue_lost: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{s("fOosFrom")}</label>
              <input
                type="date"
                className={field}
                value={form.oos_from}
                onChange={(e) => setForm({ ...form, oos_from: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>{s("fOosTo")}</label>
              <input
                type="date"
                className={field}
                value={form.oos_to}
                onChange={(e) => setForm({ ...form, oos_to: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── presentational bits ──────────────────────────────────────────────────────

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
      <div className="text-xs font-medium text-[var(--app-fg-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--app-fg-muted)]">{title}</h2>
      {children}
    </section>
  );
}

// Hand-built horizontal-bar SVG — revenue lost by room.
function RevenueByRoomChart({
  data,
  money,
}: {
  data: { room: string; revenue: number }[];
  money: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const rowH = 26;
  const gap = 6;
  const labelW = 56;
  const valueW = 92;
  const CW = 320;
  const barW = CW - labelW - valueW;
  const H = data.length * (rowH + gap);
  return (
    <svg viewBox={`0 0 ${CW} ${H}`} className="w-full" style={{ height: H }}>
      {data.map((d, i) => {
        const y = i * (rowH + gap);
        const w = Math.max(2, (d.revenue / max) * barW);
        return (
          <g key={d.room}>
            <text
              x={0}
              y={y + rowH / 2}
              dominantBaseline="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--app-fg)"
            >
              {d.room}
            </text>
            <rect
              x={labelW}
              y={y + 4}
              width={barW}
              height={rowH - 8}
              rx={3}
              fill="var(--app-surface-2)"
            />
            <rect
              x={labelW}
              y={y + 4}
              width={w}
              height={rowH - 8}
              rx={3}
              fill="var(--app-accent)"
            />
            <text
              x={CW}
              y={y + rowH / 2}
              dominantBaseline="middle"
              textAnchor="end"
              fontSize={10}
              fill="var(--app-fg-muted)"
            >
              {money(d.revenue)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Hand-built donut SVG — issue count by type, with a legend.
function IssueTypeDonut({
  data,
}: {
  data: { key: string; value: number; color: string; label: string }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;
  const stroke = 26;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {data.map((d) => {
            const frac = d.value / total;
            const dash = frac * circ;
            const seg = (
              <circle
                key={d.key}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return seg;
          })}
        </g>
        <text
          x={cx}
          y={cy}
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={22}
          fontWeight={700}
          fill="var(--app-fg)"
        >
          {total}
        </text>
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-[var(--app-fg-muted)]">{d.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusChip({ status, label }: { status: MaintenanceStatus; label: string }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      {label}
    </span>
  );
}

function IssueTypeChip({ type, label }: { type: MaintenanceIssueType; label: string }) {
  const color = issueColor(type);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        color: "var(--app-fg)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function PriorityChip({ priority, label }: { priority: Priority; label: string }) {
  if (priority === "urgent") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-[var(--app-danger)]"
        style={{ background: "color-mix(in srgb, var(--app-danger) 16%, transparent)" }}
      >
        <AlertTriangle size={11} /> {label}
      </span>
    );
  }
  if (priority === "high") {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "color-mix(in srgb, #d97706 16%, transparent)", color: "#d97706" }}
      >
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--app-surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--app-fg-muted)]">
      {label}
    </span>
  );
}
