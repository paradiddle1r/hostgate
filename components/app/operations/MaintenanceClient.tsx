"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Plus, Trash2, CheckCircle2, AlertTriangle, DoorClosed, Building2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { MaintenanceOrder, MaintenanceStatus, Priority } from "@/lib/db/operations";
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
    propertyWide: "ทั้งอาคาร",
    room: "ห้อง",
    cost: "ค่าใช้จ่าย",
    revenueLost: "รายได้ที่เสีย",
    oos: "ปิดบริการ",
    reported: "แจ้งเมื่อ",
    // modal
    editTitle: "แก้ไขงานซ่อม",
    newTitle: "เพิ่มงานซ่อม",
    fTitle: "หัวข้อ",
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
    propertyWide: "Property-wide",
    room: "Room",
    cost: "Cost",
    revenueLost: "Revenue lost",
    oos: "OOS",
    reported: "Reported",
    // modal
    editTitle: "Edit order",
    newTitle: "New order",
    fTitle: "Title",
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

type Tab = MaintenanceStatus | "all";

interface FormState {
  room_id: string;
  title: string;
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
}: {
  orders: MaintenanceOrder[];
  rooms: Room[];
  currency: string;
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

  const roomLabel = (roomId: string | null) => {
    if (!roomId) return s("propertyWide");
    const r = rooms.find((x) => x.id === roomId);
    return r ? `${s("room")} ${r.number}` : s("propertyWide");
  };

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

  const openCount = useMemo(() => orders.filter((o) => o.status === "open").length, [orders]);
  const inProgressCount = useMemo(
    () => orders.filter((o) => o.status === "in-progress").length,
    [orders]
  );
  const totalRevenueLost = useMemo(
    () =>
      orders
        .filter((o) => o.status !== "resolved")
        .reduce((sum, o) => sum + (o.revenue_lost ?? 0), 0),
    [orders]
  );

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

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
          <div className="text-xs font-medium text-[var(--app-fg-muted)]">{s("kpiOpen")}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{openCount}</div>
        </div>
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
          <div className="text-xs font-medium text-[var(--app-fg-muted)]">{s("kpiInProgress")}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{inProgressCount}</div>
        </div>
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
          <div className="text-xs font-medium text-[var(--app-fg-muted)]">{s("kpiRevenueLost")}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{money(totalRevenueLost)}</div>
        </div>
      </div>

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
          {filtered.map((o) => (
            <button
              key={o.id}
              onClick={() => openEdit(o)}
              className="app-surface w-full rounded-2xl border border-[var(--app-border)] p-4 text-left transition hover:bg-[var(--app-surface-2)]"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.title}</span>
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
          ))}
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
