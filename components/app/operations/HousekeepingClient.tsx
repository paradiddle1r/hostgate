"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Plus,
  Trash2,
  Play,
  Check,
  CheckCheck,
  SkipForward,
  RotateCcw,
  Search,
  UserPlus,
  Pencil,
  X,
  AlertTriangle,
  Clock,
  CalendarDays,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type {
  HousekeepingTask,
  HousekeepingStatus,
  HousekeepingType,
  Priority,
  TenantMember,
} from "@/lib/db/operations";
import type { Room } from "@/lib/db/rooms";
import { useToast } from "@/components/app/ui/Toast";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import {
  newHousekeepingTask,
  setTaskStatus,
  assignTaskToMe,
  patchTask,
  removeTask,
} from "@/app/app/housekeeping/actions";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "งานแม่บ้าน",
    sub: "คิวงานทำความสะอาดแยกตามห้อง เช็คเอาท์จะสร้างงานอัตโนมัติ",
    newTask: "เพิ่มงาน",
    room: "ห้อง",
    taskType: "ประเภทงาน",
    priority: "ความสำคัญ",
    assignedTo: "ผู้รับผิดชอบ",
    due: "กำหนดเสร็จ",
    notes: "หมายเหตุ",
    notesPh: "รายละเอียดเพิ่มเติม (ถ้ามี)",
    cancel: "ยกเลิก",
    save: "บันทึก",
    saved: "เพิ่มงานแล้ว",
    needRoom: "เลือกห้องก่อน",
    searchPh: "ค้นหาเลขห้อง",
    // KPIs
    kAwaitingClean: "รอทำความสะอาด",
    kInProgress: "กำลังทำ",
    kCleanedToday: "ทำเสร็จวันนี้",
    kOverdue: "เกินกำหนด",
    // filter tabs
    fOpen: "เปิดอยู่",
    fDirty: "รอทำความสะอาด",
    fInProgress: "กำลังทำ",
    fClean: "สะอาดแล้ว",
    fInspected: "ตรวจแล้ว",
    fSkipped: "ข้าม",
    fAll: "ทั้งหมด",
    // filter dropdowns
    allTypes: "ทุกประเภท",
    allPriorities: "ทุกความสำคัญ",
    allAssignees: "ทุกคน",
    mine: "ของฉัน",
    fUnassigned: "ยังไม่มอบหมาย",
    // due buckets
    bOverdue: "เกินกำหนด",
    bToday: "วันนี้",
    bTomorrow: "พรุ่งนี้",
    bLater: "ภายหลัง",
    overdue: "เกินกำหนด",
    // statuses
    sDirty: "รอทำความสะอาด",
    "sIn-progress": "กำลังทำ",
    sClean: "สะอาดแล้ว",
    sInspected: "ตรวจแล้ว",
    sSkipped: "ข้าม",
    // priorities
    pLow: "ต่ำ",
    pNormal: "ปกติ",
    pHigh: "สูง",
    pUrgent: "ด่วน",
    // task types
    "tcheckout-clean": "เช็คเอาท์",
    "tdaily-clean": "ทำความสะอาดประจำวัน",
    "tdeep-clean": "ทำความสะอาดใหญ่",
    tinspection: "ตรวจห้อง",
    tlinen: "เปลี่ยนผ้า",
    tturndown: "จัดเตียงเย็น",
    "tmaintenance-prep": "เตรียมซ่อม",
    tother: "อื่น ๆ",
    // row actions
    start: "เริ่มทำ",
    markClean: "ทำเสร็จ",
    markInspected: "ผ่านการตรวจ",
    done: "เสร็จสมบูรณ์",
    skip: "ข้าม",
    reopen: "เปิดใหม่",
    edit: "แก้ไข",
    assignMe: "รับงานนี้",
    statusChanged: "อัปเดตสถานะแล้ว",
    assigned: "รับงานแล้ว",
    updated: "บันทึกแล้ว",
    deleted: "ลบงานแล้ว",
    delConfirm: "ลบงานนี้?",
    unassigned: "ยังไม่มอบหมาย",
    // empty
    empty: "ไม่มีงานในมุมมองนี้",
    emptyHint: "เปลี่ยนตัวกรอง หรือเพิ่มงานใหม่",
  },
  en: {
    title: "Housekeeping",
    sub: "Per-room cleaning queue. Check-outs auto-create tasks.",
    newTask: "New task",
    room: "Room",
    taskType: "Task type",
    priority: "Priority",
    assignedTo: "Assigned to",
    due: "Due",
    notes: "Notes",
    notesPh: "Optional details",
    cancel: "Cancel",
    save: "Save",
    saved: "Task added",
    needRoom: "Pick a room first",
    searchPh: "Search room number",
    kAwaitingClean: "Awaiting clean",
    kInProgress: "In progress",
    kCleanedToday: "Cleaned today",
    kOverdue: "Overdue",
    fOpen: "Open",
    fDirty: "Dirty",
    fInProgress: "In progress",
    fClean: "Clean",
    fInspected: "Inspected",
    fSkipped: "Skipped",
    fAll: "All",
    allTypes: "All types",
    allPriorities: "All priorities",
    allAssignees: "All assignees",
    mine: "Mine",
    fUnassigned: "Unassigned",
    bOverdue: "Overdue",
    bToday: "Today",
    bTomorrow: "Tomorrow",
    bLater: "Later",
    overdue: "Overdue",
    sDirty: "Dirty",
    "sIn-progress": "In progress",
    sClean: "Clean",
    sInspected: "Inspected",
    sSkipped: "Skipped",
    pLow: "Low",
    pNormal: "Normal",
    pHigh: "High",
    pUrgent: "Urgent",
    "tcheckout-clean": "Checkout clean",
    "tdaily-clean": "Daily clean",
    "tdeep-clean": "Deep clean",
    tinspection: "Inspection",
    tlinen: "Linen",
    tturndown: "Turndown",
    "tmaintenance-prep": "Maintenance prep",
    tother: "Other",
    start: "Start",
    markClean: "Mark clean",
    markInspected: "Mark inspected",
    done: "Done",
    skip: "Skip",
    reopen: "Re-open",
    edit: "Edit",
    assignMe: "Assign to me",
    statusChanged: "Status updated",
    assigned: "Assigned to you",
    updated: "Saved",
    deleted: "Task deleted",
    delConfirm: "Delete this task?",
    unassigned: "Unassigned",
    empty: "No tasks in this view",
    emptyHint: "Change the filter or add a new task.",
  },
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

const TASK_TYPES: HousekeepingType[] = [
  "checkout-clean",
  "daily-clean",
  "deep-clean",
  "inspection",
  "linen",
  "turndown",
  "maintenance-prep",
  "other",
];
const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

type FilterKey =
  | "open"
  | "dirty"
  | "in-progress"
  | "clean"
  | "inspected"
  | "skipped"
  | "all";

const FILTERS: { key: FilterKey; strKey: string }[] = [
  { key: "open", strKey: "fOpen" },
  { key: "dirty", strKey: "fDirty" },
  { key: "in-progress", strKey: "fInProgress" },
  { key: "clean", strKey: "fClean" },
  { key: "inspected", strKey: "fInspected" },
  { key: "skipped", strKey: "fSkipped" },
  { key: "all", strKey: "fAll" },
];

// next status in the dirty → in-progress → clean → inspected chain
const NEXT_STATUS: Partial<Record<HousekeepingStatus, HousekeepingStatus>> = {
  dirty: "in-progress",
  "in-progress": "clean",
  clean: "inspected",
};
const NEXT_LABEL: Partial<Record<HousekeepingStatus, string>> = {
  dirty: "start",
  "in-progress": "markClean",
  clean: "markInspected",
};

// ── Date helpers ────────────────────────────────────────────────────────────
// Date-only string comparison keeps things honest across the +07/UTC seam —
// building the ISO key from local Y/M/D, never from Date math.
function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function isoPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

type DueBucket = "overdue" | "today" | "tomorrow" | "later";
const BUCKET_ORDER: DueBucket[] = ["overdue", "today", "tomorrow", "later"];
const BUCKET_STR: Record<DueBucket, string> = {
  overdue: "bOverdue",
  today: "bToday",
  tomorrow: "bTomorrow",
  later: "bLater",
};

// due_date is NOT NULL (default current_date) so no null fallback needed.
function dueBucket(due: string): DueBucket {
  const today = todayIso();
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (due === isoPlus(1)) return "tomorrow";
  return "later";
}
function isOverdue(t: HousekeepingTask): boolean {
  return (
    t.due_date < todayIso() &&
    (t.status === "dirty" || t.status === "in-progress")
  );
}

interface NewDraft {
  room_id: string;
  task_type: HousekeepingType;
  priority: Priority;
  due_date: string;
  notes: string;
}

export default function HousekeepingClient({
  tasks,
  rooms,
  members,
  currentUserId,
  propertyId,
}: {
  tasks: HousekeepingTask[];
  rooms: Room[];
  members: TenantMember[];
  currentUserId: string | null;
  propertyId?: string;
}) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState<FilterKey>("open");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | HousekeepingType>("all");
  const [prioFilter, setPrioFilter] = useState<"all" | Priority>("all");
  const [assignee, setAssignee] = useState<string>("all"); // "all" | "me" | "unassigned" | userId
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NewDraft>({
    room_id: "",
    task_type: "daily-clean",
    priority: "normal",
    due_date: todayIso(),
    notes: "",
  });

  // ── Realtime: a freshness trigger only. The subscription handler calls
  // router.refresh() so the RLS+property-scoped loader re-runs; all mutations
  // stay in server actions (no local task mirror, no dual source of truth).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("housekeeping_tasks_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "housekeeping_tasks",
          ...(propertyId ? { filter: `property_id=eq.${propertyId}` } : {}),
        },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, propertyId]);

  const roomNumber = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rooms) m.set(r.id, r.number);
    return m;
  }, [rooms]);

  const memberName = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of members) m.set(u.user_id, u.display_name || u.email || "—");
    return m;
  }, [members]);

  // ── KPIs: Awaiting clean / In progress / Cleaned today / Overdue ──────────
  const kpis = useMemo(() => {
    const today = todayIso();
    let awaiting = 0,
      inProgress = 0,
      cleanedToday = 0,
      overdue = 0;
    for (const t of tasks) {
      if (t.status === "dirty") awaiting++;
      else if (t.status === "in-progress") inProgress++;
      if (
        (t.status === "clean" || t.status === "inspected") &&
        t.completed_at &&
        t.completed_at.slice(0, 10) === today
      )
        cleanedToday++;
      if (isOverdue(t)) overdue++;
    }
    return { awaiting, inProgress, cleanedToday, overdue };
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      // status filter
      if (filter === "open") {
        if (t.status !== "dirty" && t.status !== "in-progress") return false;
      } else if (filter !== "all" && t.status !== filter) {
        return false;
      }
      // type / priority dropdowns
      if (typeFilter !== "all" && t.task_type !== typeFilter) return false;
      if (prioFilter !== "all" && t.priority !== prioFilter) return false;
      // assignee dropdown
      if (assignee === "me") {
        if (!currentUserId || t.assigned_to !== currentUserId) return false;
      } else if (assignee === "unassigned") {
        if (t.assigned_to) return false;
      } else if (assignee !== "all") {
        if (t.assigned_to !== assignee) return false;
      }
      // room-number search
      if (q) {
        const num = (roomNumber.get(t.room_id) ?? "").toLowerCase();
        if (!num.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filter, typeFilter, prioFilter, assignee, query, roomNumber, currentUserId]);

  // group by due-date bucket for Open / All views; otherwise a single flat list
  const grouped = useMemo(() => {
    const useBuckets = filter === "open" || filter === "all";
    if (!useBuckets) {
      return [{ bucket: null as DueBucket | null, rows: filtered }];
    }
    const byBucket = new Map<DueBucket, HousekeepingTask[]>();
    for (const t of filtered) {
      const b = dueBucket(t.due_date);
      if (!byBucket.has(b)) byBucket.set(b, []);
      byBucket.get(b)!.push(t);
    }
    return BUCKET_ORDER.filter((b) => byBucket.has(b)).map((b) => ({
      bucket: b,
      rows: byBucket.get(b)!,
    }));
  }, [filtered, filter]);

  async function create() {
    if (!draft.room_id) {
      toast.error(s("needRoom"));
      return;
    }
    setSaving(true);
    const res = await newHousekeepingTask({
      room_id: draft.room_id,
      task_type: draft.task_type,
      priority: draft.priority,
      due_date: draft.due_date || undefined,
      notes: draft.notes.trim() || null,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(s("saved"));
      setCreating(false);
      setDraft({
        room_id: "",
        task_type: "daily-clean",
        priority: "normal",
        due_date: todayIso(),
        notes: "",
      });
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function changeStatus(t: HousekeepingTask, next: HousekeepingStatus, okMsg: string) {
    setBusyId(t.id);
    const res = await setTaskStatus(t.id, next);
    setBusyId(null);
    if (res.ok) {
      toast.success(okMsg);
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function advance(t: HousekeepingTask) {
    const next = NEXT_STATUS[t.status];
    if (!next) return;
    await changeStatus(t, next, s("statusChanged"));
  }
  const skip = (t: HousekeepingTask) => changeStatus(t, "skipped", s("statusChanged"));
  const reopen = (t: HousekeepingTask) => changeStatus(t, "dirty", s("statusChanged"));

  async function take(t: HousekeepingTask) {
    setBusyId(t.id);
    const res = await assignTaskToMe(t.id);
    setBusyId(null);
    if (res.ok) {
      toast.success(s("assigned"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function savePatch(
    t: HousekeepingTask,
    patch: {
      priority?: Priority;
      task_type?: HousekeepingType;
      assigned_to?: string | null;
      due_date?: string;
      notes?: string | null;
    }
  ) {
    setBusyId(t.id);
    const res = await patchTask(t.id, patch);
    setBusyId(null);
    if (res.ok) {
      toast.success(s("updated"));
      setEditId(null);
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function del(t: HousekeepingTask) {
    if (typeof window !== "undefined" && !window.confirm(s("delConfirm"))) return;
    setBusyId(t.id);
    const res = await removeTask(t.id);
    setBusyId(null);
    if (res.ok) {
      toast.success(s("deleted"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const selectCls =
    "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--app-accent)]";

  return (
    <div className="mx-auto max-w-3xl">
      {/* header */}
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
          <p className="text-sm text-[var(--app-fg-muted)]">{s("sub")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} /> {s("newTask")}
        </Button>
      </div>

      {/* KPI tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          icon={<AlertTriangle size={16} />}
          label={s("kAwaitingClean")}
          value={kpis.awaiting}
          bg="rgba(220,38,38,0.12)"
          fg="var(--app-danger)"
        />
        <Kpi
          icon={<Clock size={16} />}
          label={s("kInProgress")}
          value={kpis.inProgress}
          bg="rgba(217,119,6,0.14)"
          fg="#d97706"
        />
        <Kpi
          icon={<Check size={16} />}
          label={s("kCleanedToday")}
          value={kpis.cleanedToday}
          bg="rgba(22,163,74,0.14)"
          fg="var(--app-success)"
        />
        <Kpi
          icon={<CalendarDays size={16} />}
          label={s("kOverdue")}
          value={kpis.overdue}
          bg="rgba(220,38,38,0.12)"
          fg="var(--app-danger)"
        />
      </div>

      {/* filter tabs */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                filter === f.key
                  ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                  : "border-[var(--app-border)] text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
              }`}
            >
              {s(f.strKey)}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-fg-muted)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s("searchPh")}
            className="w-40 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-[var(--app-accent)]"
          />
        </div>
      </div>

      {/* dropdown filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className={selectCls}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | HousekeepingType)}
        >
          <option value="all">{s("allTypes")}</option>
          {TASK_TYPES.map((tt) => (
            <option key={tt} value={tt}>
              {s(`t${tt}`)}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={prioFilter}
          onChange={(e) => setPrioFilter(e.target.value as "all" | Priority)}
        >
          <option value="all">{s("allPriorities")}</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {s(`p${cap(p)}`)}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
        >
          <option value="all">{s("allAssignees")}</option>
          {currentUserId && <option value="me">{s("mine")}</option>}
          <option value="unassigned">{s("fUnassigned")}</option>
          {members.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.display_name || u.email || "—"}
            </option>
          ))}
        </select>
      </div>

      {/* list */}
      {filtered.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState
            icon={<Sparkles size={22} />}
            title={s("empty")}
            hint={s("emptyHint")}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.bucket ?? "flat"} className="space-y-2">
              {group.bucket && (
                <div
                  className={`inline-flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide ${
                    group.bucket === "overdue" ? "" : "text-[var(--app-fg-muted)]"
                  }`}
                  style={
                    group.bucket === "overdue"
                      ? {
                          color: "var(--app-danger)",
                          background: "rgba(220,38,38,0.10)",
                          border: "1px solid rgba(220,38,38,0.35)",
                          borderRadius: 6,
                          padding: "3px 8px",
                        }
                      : undefined
                  }
                >
                  {group.bucket === "overdue" && <AlertTriangle size={12} />}
                  {s(BUCKET_STR[group.bucket])} · {group.rows.length}
                </div>
              )}
              {group.rows.map((t) => (
                <TaskRow
                  key={t.id}
                  t={t}
                  s={s}
                  mine={!!currentUserId && t.assigned_to === currentUserId}
                  roomNum={roomNumber.get(t.room_id) ?? "—"}
                  assigneeName={
                    t.assigned_to ? memberName.get(t.assigned_to) ?? null : null
                  }
                  members={members}
                  canAssign={!!currentUserId}
                  busy={busyId === t.id}
                  editing={editId === t.id}
                  onToggleEdit={() => setEditId(editId === t.id ? null : t.id)}
                  onSavePatch={(patch) => savePatch(t, patch)}
                  onAdvance={() => advance(t)}
                  onSkip={() => skip(t)}
                  onReopen={() => reopen(t)}
                  onTake={() => take(t)}
                  onDelete={() => del(t)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* new-task modal */}
      {creating && (
        <Modal
          open
          onClose={() => setCreating(false)}
          title={s("newTask")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                {s("cancel")}
              </Button>
              <Button onClick={create} loading={saving}>
                {s("save")}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className={label}>{s("room")}</label>
              <select
                className={field}
                value={draft.room_id}
                onChange={(e) => setDraft({ ...draft, room_id: e.target.value })}
              >
                <option value="">—</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{s("taskType")}</label>
                <select
                  className={field}
                  value={draft.task_type}
                  onChange={(e) =>
                    setDraft({ ...draft, task_type: e.target.value as HousekeepingType })
                  }
                >
                  {TASK_TYPES.map((tt) => (
                    <option key={tt} value={tt}>
                      {s(`t${tt}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>{s("priority")}</label>
                <select
                  className={field}
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft({ ...draft, priority: e.target.value as Priority })
                  }
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {s(`p${cap(p)}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={label}>{s("due")}</label>
              <input
                type="date"
                className={field}
                value={draft.due_date}
                onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>{s("notes")}</label>
              <textarea
                className={`${field} min-h-[72px] resize-y`}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder={s("notesPh")}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  bg,
  fg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
  fg: string;
}) {
  return (
    <div className="app-surface flex items-center gap-3 rounded-2xl border border-[var(--app-border)] p-3">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
        style={{ background: bg, color: fg }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-medium uppercase tracking-wide text-[var(--app-fg-muted)]">
          {label}
        </div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function TaskRow({
  t,
  s,
  mine,
  roomNum,
  assigneeName,
  members,
  canAssign,
  busy,
  editing,
  onToggleEdit,
  onSavePatch,
  onAdvance,
  onSkip,
  onReopen,
  onTake,
  onDelete,
}: {
  t: HousekeepingTask;
  s: (k: string) => string;
  mine: boolean;
  roomNum: string;
  assigneeName: string | null;
  members: TenantMember[];
  canAssign: boolean;
  busy: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  onSavePatch: (patch: {
    priority?: Priority;
    task_type?: HousekeepingType;
    assigned_to?: string | null;
    due_date?: string;
    notes?: string | null;
  }) => void;
  onAdvance: () => void;
  onSkip: () => void;
  onReopen: () => void;
  onTake: () => void;
  onDelete: () => void;
}) {
  const nextLabelKey = NEXT_LABEL[t.status];
  const isTerminal = t.status === "inspected" || t.status === "skipped";
  const overdue = isOverdue(t);

  return (
    <div
      className="app-surface flex flex-col gap-3 rounded-2xl border p-4"
      style={{
        borderColor: overdue
          ? "rgba(220,38,38,0.5)"
          : mine
            ? "var(--app-accent)"
            : "var(--app-border)",
        borderLeftWidth: overdue || mine ? 3 : 1,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* room number */}
        <div className="min-w-[3rem] text-lg font-semibold tabular-nums">{roomNum}</div>

        {/* chips */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Chip bg="var(--app-surface-2)" fg="var(--app-fg-muted)">
            {s(`t${t.task_type}`)}
          </Chip>
          <Chip bg={priColors(t.priority).bg} fg={priColors(t.priority).fg}>
            {s(`p${cap(t.priority)}`)}
          </Chip>
          <Chip bg={statusColors(t.status).bg} fg={statusColors(t.status).fg}>
            {s(statusStrKey(t.status))}
          </Chip>
          {overdue && (
            <Chip bg="rgba(220,38,38,0.14)" fg="var(--app-danger)">
              <AlertTriangle size={11} className="mr-0.5 inline" />
              {s("overdue")}
            </Chip>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-[var(--app-fg-muted)]">
            <Clock size={12} /> {t.due_date}
          </span>
          {assigneeName ? (
            <span className="text-xs text-[var(--app-fg-muted)]">{assigneeName}</span>
          ) : (
            <span className="text-xs italic text-[var(--app-fg-muted)]">
              {s("unassigned")}
            </span>
          )}
          {t.notes && (
            <span className="basis-full truncate text-sm text-[var(--app-fg-muted)]">
              {t.notes}
            </span>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center gap-1.5">
          {!t.assigned_to && canAssign && !isTerminal && (
            <Button variant="ghost" size="sm" onClick={onTake} loading={busy}>
              <UserPlus size={14} /> {s("assignMe")}
            </Button>
          )}

          {isTerminal ? (
            <>
              {t.status === "inspected" && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--app-success)]">
                  <CheckCheck size={16} /> {s("done")}
                </span>
              )}
              <button
                onClick={onReopen}
                disabled={busy}
                aria-label={s("reopen")}
                title={s("reopen")}
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--app-fg-muted)] transition-colors hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)] disabled:opacity-50"
              >
                <RotateCcw size={15} />
              </button>
            </>
          ) : (
            <>
              {nextLabelKey && (
                <Button size="sm" onClick={onAdvance} loading={busy}>
                  {t.status === "dirty" && <Play size={14} />}
                  {t.status === "in-progress" && <Check size={14} />}
                  {t.status === "clean" && <CheckCheck size={14} />}
                  {s(nextLabelKey)}
                </Button>
              )}
              <button
                onClick={onSkip}
                disabled={busy}
                aria-label={s("skip")}
                title={s("skip")}
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--app-fg-muted)] transition-colors hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)] disabled:opacity-50"
              >
                <SkipForward size={15} />
              </button>
            </>
          )}

          <button
            onClick={onToggleEdit}
            disabled={busy}
            aria-label={s("edit")}
            title={s("edit")}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--app-fg-muted)] transition-colors hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)] disabled:opacity-50"
          >
            {editing ? <X size={15} /> : <Pencil size={15} />}
          </button>

          <button
            onClick={onDelete}
            disabled={busy}
            aria-label="Delete"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--app-fg-muted)] transition-colors hover:text-[var(--app-danger)] disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* inline editor */}
      {editing && (
        <InlineEditor t={t} s={s} members={members} busy={busy} onSave={onSavePatch} onCancel={onToggleEdit} />
      )}
    </div>
  );
}

function InlineEditor({
  t,
  s,
  members,
  busy,
  onSave,
  onCancel,
}: {
  t: HousekeepingTask;
  s: (k: string) => string;
  members: TenantMember[];
  busy: boolean;
  onSave: (patch: {
    priority?: Priority;
    task_type?: HousekeepingType;
    assigned_to?: string | null;
    due_date?: string;
    notes?: string | null;
  }) => void;
  onCancel: () => void;
}) {
  const [taskType, setTaskType] = useState<HousekeepingType>(t.task_type);
  const [priority, setPriority] = useState<Priority>(t.priority);
  const [assigned, setAssigned] = useState<string>(t.assigned_to ?? "");
  const [due, setDue] = useState<string>(t.due_date);
  const [notes, setNotes] = useState<string>(t.notes ?? "");

  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>{s("taskType")}</label>
          <select
            className={field}
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as HousekeepingType)}
          >
            {TASK_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {s(`t${tt}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{s("priority")}</label>
          <select
            className={field}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {s(`p${cap(p)}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{s("assignedTo")}</label>
          <select
            className={field}
            value={assigned}
            onChange={(e) => setAssigned(e.target.value)}
          >
            <option value="">{s("unassigned")}</option>
            {members.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.display_name || u.email || "—"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{s("due")}</label>
          <input
            type="date"
            className={field}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{s("notes")}</label>
          <textarea
            className={`${field} min-h-[60px] resize-y`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {s("cancel")}
        </Button>
        <Button
          size="sm"
          loading={busy}
          onClick={() =>
            onSave({
              task_type: taskType,
              priority,
              assigned_to: assigned || null,
              due_date: due || undefined,
              notes: notes.trim() || null,
            })
          }
        >
          {s("save")}
        </Button>
      </div>
    </div>
  );
}

function Chip({
  bg,
  fg,
  children,
}: {
  bg: string;
  fg: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusStrKey(status: HousekeepingStatus): string {
  switch (status) {
    case "dirty":
      return "sDirty";
    case "in-progress":
      return "sIn-progress";
    case "clean":
      return "sClean";
    case "inspected":
      return "sInspected";
    case "skipped":
      return "sSkipped";
  }
}

// status chip colours: dirty=red, in-progress=amber, clean=green, inspected=blue, skipped=muted
function statusColors(status: HousekeepingStatus): { bg: string; fg: string } {
  switch (status) {
    case "dirty":
      return { bg: "rgba(220,38,38,0.14)", fg: "var(--app-danger)" };
    case "in-progress":
      return { bg: "rgba(217,119,6,0.16)", fg: "#d97706" };
    case "clean":
      return { bg: "rgba(22,163,74,0.16)", fg: "var(--app-success)" };
    case "inspected":
      return { bg: "rgba(37,99,235,0.16)", fg: "#2563eb" };
    case "skipped":
      return { bg: "var(--app-surface-2)", fg: "var(--app-fg-muted)" };
  }
}

// priority chip colours: urgent=danger red, high=amber, normal/low=muted
function priColors(priority: Priority): { bg: string; fg: string } {
  switch (priority) {
    case "urgent":
      return { bg: "rgba(220,38,38,0.14)", fg: "var(--app-danger)" };
    case "high":
      return { bg: "rgba(217,119,6,0.16)", fg: "#d97706" };
    case "normal":
    case "low":
      return { bg: "var(--app-surface-2)", fg: "var(--app-fg-muted)" };
  }
}
