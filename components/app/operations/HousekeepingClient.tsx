"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Plus,
  Trash2,
  Play,
  Check,
  CheckCheck,
  SkipForward,
  Search,
  UserPlus,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
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
  removeTask,
} from "@/app/app/housekeeping/actions";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "งานแม่บ้าน",
    sub: "คิวงานทำความสะอาดแยกตามห้อง",
    newTask: "เพิ่มงาน",
    room: "ห้อง",
    taskType: "ประเภทงาน",
    priority: "ความสำคัญ",
    notes: "หมายเหตุ",
    notesPh: "รายละเอียดเพิ่มเติม (ถ้ามี)",
    cancel: "ยกเลิก",
    save: "บันทึก",
    saved: "เพิ่มงานแล้ว",
    needRoom: "เลือกห้องก่อน",
    searchPh: "ค้นหาเลขห้อง",
    // filter tabs
    fOpen: "เปิดอยู่",
    fDirty: "รอทำความสะอาด",
    fInProgress: "กำลังทำ",
    fClean: "สะอาดแล้ว",
    fInspected: "ตรวจแล้ว",
    fSkipped: "ข้าม",
    fAll: "ทั้งหมด",
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
    assignMe: "รับงานนี้",
    statusChanged: "อัปเดตสถานะแล้ว",
    assigned: "รับงานแล้ว",
    deleted: "ลบงานแล้ว",
    delConfirm: "ลบงานนี้?",
    unassigned: "ยังไม่มอบหมาย",
    // empty
    empty: "ไม่มีงานในมุมมองนี้",
    emptyHint: "เปลี่ยนตัวกรอง หรือเพิ่มงานใหม่",
  },
  en: {
    title: "Housekeeping",
    sub: "Per-room cleaning task queue.",
    newTask: "New task",
    room: "Room",
    taskType: "Task type",
    priority: "Priority",
    notes: "Notes",
    notesPh: "Optional details",
    cancel: "Cancel",
    save: "Save",
    saved: "Task added",
    needRoom: "Pick a room first",
    searchPh: "Search room number",
    fOpen: "Open",
    fDirty: "Dirty",
    fInProgress: "In progress",
    fClean: "Clean",
    fInspected: "Inspected",
    fSkipped: "Skipped",
    fAll: "All",
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
    assignMe: "Assign to me",
    statusChanged: "Status updated",
    assigned: "Assigned to you",
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

// bucket order for grouped views (Open / All)
const BUCKET_ORDER: HousekeepingStatus[] = [
  "dirty",
  "in-progress",
  "clean",
  "inspected",
  "skipped",
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

interface NewDraft {
  room_id: string;
  task_type: HousekeepingType;
  priority: Priority;
  notes: string;
}

export default function HousekeepingClient({
  tasks,
  rooms,
  members,
  currentUserId,
}: {
  tasks: HousekeepingTask[];
  rooms: Room[];
  members: TenantMember[];
  currentUserId: string | null;
}) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState<FilterKey>("open");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NewDraft>({
    room_id: "",
    task_type: "daily-clean",
    priority: "normal",
    notes: "",
  });

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      // status filter
      if (filter === "open") {
        if (t.status !== "dirty" && t.status !== "in-progress") return false;
      } else if (filter !== "all" && t.status !== filter) {
        return false;
      }
      // room-number search
      if (q) {
        const num = (roomNumber.get(t.room_id) ?? "").toLowerCase();
        if (!num.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filter, query, roomNumber]);

  // group into buckets for the Open / All views; otherwise a single bucket
  const grouped = useMemo(() => {
    if (filter !== "open" && filter !== "all") {
      return [{ status: filter as HousekeepingStatus, rows: filtered }];
    }
    return BUCKET_ORDER.map((status) => ({
      status,
      rows: filtered.filter((t) => t.status === status),
    })).filter((g) => g.rows.length > 0);
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
      notes: draft.notes.trim() || null,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(s("saved"));
      setCreating(false);
      setDraft({ room_id: "", task_type: "daily-clean", priority: "normal", notes: "" });
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function advance(t: HousekeepingTask) {
    const next = NEXT_STATUS[t.status];
    if (!next) return;
    setBusyId(t.id);
    const res = await setTaskStatus(t.id, next);
    setBusyId(null);
    if (res.ok) {
      toast.success(s("statusChanged"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function skip(t: HousekeepingTask) {
    setBusyId(t.id);
    const res = await setTaskStatus(t.id, "skipped");
    setBusyId(null);
    if (res.ok) {
      toast.success(s("statusChanged"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

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

      {/* filter tabs + search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
            <div key={group.status} className="space-y-2">
              {(filter === "open" || filter === "all") && (
                <div className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--app-fg-muted)]">
                  {s(statusStrKey(group.status))} · {group.rows.length}
                </div>
              )}
              {group.rows.map((t) => (
                <TaskRow
                  key={t.id}
                  t={t}
                  s={s}
                  mine={!!currentUserId && t.assigned_to === currentUserId}
                  roomNum={roomNumber.get(t.room_id) ?? "—"}
                  assignee={t.assigned_to ? memberName.get(t.assigned_to) ?? null : null}
                  canAssign={!!currentUserId}
                  busy={busyId === t.id}
                  onAdvance={() => advance(t)}
                  onSkip={() => skip(t)}
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

function TaskRow({
  t,
  s,
  mine,
  roomNum,
  assignee,
  canAssign,
  busy,
  onAdvance,
  onSkip,
  onTake,
  onDelete,
}: {
  t: HousekeepingTask;
  s: (k: string) => string;
  mine: boolean;
  roomNum: string;
  assignee: string | null;
  canAssign: boolean;
  busy: boolean;
  onAdvance: () => void;
  onSkip: () => void;
  onTake: () => void;
  onDelete: () => void;
}) {
  const nextLabelKey = NEXT_LABEL[t.status];
  const isTerminal = t.status === "inspected" || t.status === "skipped";

  return (
    <div
      className="app-surface flex flex-wrap items-center gap-3 rounded-2xl border p-4"
      style={{
        borderColor: mine ? "var(--app-accent)" : "var(--app-border)",
        borderLeftWidth: mine ? 3 : 1,
      }}
    >
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
        {assignee ? (
          <span className="text-xs text-[var(--app-fg-muted)]">{assignee}</span>
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
          t.status === "inspected" ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--app-success)]">
              <CheckCheck size={16} /> {s("done")}
            </span>
          ) : null
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
          onClick={onDelete}
          disabled={busy}
          aria-label="Delete"
          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--app-fg-muted)] transition-colors hover:text-[var(--app-danger)] disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
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
