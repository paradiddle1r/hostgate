"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Users,
  Pencil,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import {
  newShift,
  removeShift,
  bulkAssignShifts,
  setMemberPosition,
  setMemberActiveShifts,
  type BulkAssignInput,
} from "@/app/app/shifts/actions";
import type { ShiftAssignment, ShiftType, TenantMember } from "@/lib/db/operations";

// ── shift presets ──────────────────────────────────────────────────────────────
// Times are hotel-local; night rolls past midnight. Defaults seed the time inputs
// and render the pill range when a row hasn't overridden them.
const SHIFTS: { id: ShiftType; start: string; end: string }[] = [
  { id: "day", start: "08:00", end: "17:00" },
  { id: "night", start: "17:00", end: "01:00" },
  { id: "custom", start: "", end: "" },
];

// ── position sections (parity: group each day cell by member position) ──────────
// Canonical positions stored verbatim on tenant_members.position so legacy
// free-text rows keep rendering. Cells group into Receptionist | Housekeeper |
// Other; "Other" is hidden when empty.
const POSITIONS = [
  { value: "Receptionist", key: "receptionist", dot: "#2563eb" },
  { value: "Housekeeper", key: "housekeeper", dot: "#16a34a" },
] as const;

const SECTIONS = [
  { id: "receptionist", dot: "#2563eb" },
  { id: "housekeeper", dot: "#16a34a" },
  { id: "other", dot: "#94a3b8" },
] as const;

function sectionKeyForPosition(position: string | null | undefined): string {
  const k = position ? position.toLowerCase() : "";
  if (k === "receptionist") return "receptionist";
  if (k === "housekeeper") return "housekeeper";
  return "other";
}

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "เวรงาน",
    subEdit: "จัดตารางเวรพนักงานรายเดือน",
    subRead: "ดูตารางเวรพนักงาน (อ่านอย่างเดียว)",
    tabSchedule: "ตาราง",
    tabStaff: "พนักงาน",
    today: "วันนี้",
    prev: "เดือนก่อน",
    next: "เดือนถัดไป",
    add: "เพิ่มเวร",
    addTitle: "เพิ่มเวรงาน",
    bulk: "เพิ่มเวรหลายวัน",
    bulkTitle: "เพิ่มเวรหลายวัน",
    bulkSub: "เลือกพนักงาน ช่วงวันที่ เวร และวันในสัปดาห์",
    member: "พนักงาน",
    date: "วันที่",
    dateFrom: "ตั้งแต่วันที่",
    dateTo: "ถึงวันที่",
    type: "ประเภทเวร",
    shift: "เวร",
    day: "กลางวัน",
    night: "กลางคืน",
    custom: "กำหนดเอง",
    start: "เริ่ม",
    end: "สิ้นสุด",
    notes: "หมายเหตุ",
    notesPh: "เพิ่มเติม (ถ้ามี)",
    cancel: "ยกเลิก",
    save: "บันทึก",
    apply: "เพิ่ม",
    applying: "กำลังเพิ่ม…",
    saved: "เพิ่มเวรแล้ว",
    removed: "ลบเวรแล้ว",
    bulkDone: "เพิ่มเวรแล้ว",
    needMember: "เลือกพนักงาน",
    needDate: "เลือกวันที่",
    inviteFirst: "เชิญพนักงานเข้าทีมก่อน",
    noData: "ยังไม่มีเวรงาน",
    noDataHint: "เพิ่มเวรงานเพื่อจัดตารางพนักงานในเดือนนี้",
    removeConfirm: "ลบเวรนี้?",
    selectMember: "— เลือกพนักงาน —",
    daysOfWeek: "วันในสัปดาห์",
    presetWeekdays: "จ.–ศ.",
    presetWeekend: "ส.–อา.",
    presetAll: "ทุกวัน",
    useCustomTime: "กำหนดเวลาเอง",
    willCreate: "จะสร้าง",
    rows: "เวร",
    legendPos: "ตำแหน่ง",
    posReceptionist: "พนักงานต้อนรับ",
    posHousekeeper: "แม่บ้าน",
    posOther: "อื่น ๆ",
    none: "— ไม่ระบุ —",
    // staff tab
    staffName: "ชื่อ",
    staffRole: "บทบาท",
    staffPosition: "ตำแหน่ง",
    staffStatus: "สถานะ",
    active: "ใช้งาน",
    inactive: "ปิดใช้งาน",
    enable: "เปิด",
    disable: "ปิด",
    roleOwner: "เจ้าของ",
    roleAdmin: "ผู้ดูแล",
    roleStaff: "พนักงาน",
    editPosition: "แก้ตำแหน่ง",
    positionSaved: "บันทึกตำแหน่งแล้ว",
    statusSaved: "อัปเดตสถานะแล้ว",
    noStaff: "ยังไม่มีพนักงาน",
    noStaffHint: "เชิญพนักงานจากหน้าทีม",
    readonlyNote: "อ่านอย่างเดียว",
    edit: "แก้ไข",
  },
  en: {
    title: "Shifts",
    subEdit: "Schedule staff shifts for the month.",
    subRead: "View the staff shift schedule (read-only).",
    tabSchedule: "Schedule",
    tabStaff: "Staff",
    today: "Today",
    prev: "Previous month",
    next: "Next month",
    add: "Add shift",
    addTitle: "Add shift",
    bulk: "Bulk assign",
    bulkTitle: "Bulk assign shifts",
    bulkSub: "Pick a member, a date range, shifts, and weekdays.",
    member: "Member",
    date: "Date",
    dateFrom: "From date",
    dateTo: "To date",
    type: "Shift type",
    shift: "Shift",
    day: "Day",
    night: "Night",
    custom: "Custom",
    start: "Start",
    end: "End",
    notes: "Notes",
    notesPh: "Optional",
    cancel: "Cancel",
    save: "Save",
    apply: "Apply",
    applying: "Applying…",
    saved: "Shift added",
    removed: "Shift removed",
    bulkDone: "Shifts added",
    needMember: "Pick a member",
    needDate: "Pick a date",
    inviteFirst: "Invite staff first",
    noData: "No shifts yet",
    noDataHint: "Add a shift to schedule staff this month.",
    removeConfirm: "Remove this shift?",
    selectMember: "— Select member —",
    daysOfWeek: "Days of week",
    presetWeekdays: "Mon–Fri",
    presetWeekend: "Sat–Sun",
    presetAll: "All days",
    useCustomTime: "Custom time",
    willCreate: "Will create",
    rows: "shifts",
    legendPos: "Position",
    posReceptionist: "Receptionist",
    posHousekeeper: "Housekeeper",
    posOther: "Other",
    none: "— None —",
    // staff tab
    staffName: "Name",
    staffRole: "Role",
    staffPosition: "Position",
    staffStatus: "Status",
    active: "Active",
    inactive: "Inactive",
    enable: "Enable",
    disable: "Disable",
    roleOwner: "Owner",
    roleAdmin: "Admin",
    roleStaff: "Staff",
    editPosition: "Edit position",
    positionSaved: "Position saved",
    statusSaved: "Status updated",
    noStaff: "No staff yet",
    noStaffHint: "Invite staff from the Team page.",
    readonlyNote: "Read-only",
    edit: "Edit",
  },
};

const MONTHS: Record<"th" | "en", string[]> = {
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  th: [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ],
};

const WEEKDAYS: Record<"th" | "en", string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  th: ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."],
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function parseMonth(month: string): { y: number; m: number } {
  const [y, m] = month.split("-").map(Number);
  return { y, m: m - 1 };
}
function ymString(y: number, m0: number): string {
  const d = new Date(Date.UTC(y, m0, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function dateISO(y: number, m0: number, day: number): string {
  return new Date(Date.UTC(y, m0, day)).toISOString().slice(0, 10);
}

interface GridCell {
  iso: string;
  day: number;
  inMonth: boolean;
  dow: number;
}

function buildGrid(y: number, m0: number): GridCell[] {
  const first = new Date(Date.UTC(y, m0, 1));
  const firstDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const cells: GridCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - firstDow;
    const d = new Date(Date.UTC(y, m0, 1 + dayOffset));
    cells.push({
      iso: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === m0 && d.getUTCFullYear() === y,
      dow: d.getUTCDay(),
    });
  }
  return cells;
}

function firstName(m: TenantMember | undefined): string {
  if (!m) return "?";
  if (m.display_name && m.display_name.trim()) return m.display_name.trim().split(/\s+/)[0];
  if (m.email) return m.email.split("@")[0];
  return "?";
}
function memberLabel(m: TenantMember): string {
  return (m.display_name && m.display_name.trim()) || m.email || m.user_id;
}

export default function ShiftsClient({
  month,
  shifts,
  members,
  canEdit = false,
}: {
  month: string;
  shifts: ShiftAssignment[];
  members: TenantMember[];
  /** Owner/admin may edit; staff get a read-only schedule. Optional for
   *  backward-compat with any caller that doesn't pass it. */
  canEdit?: boolean;
}) {
  const { locale } = useI18n();
  const s = STR[locale];
  const toast = useToast();
  const router = useRouter();

  const [tab, setTab] = useState<"schedule" | "staff">("schedule");
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const { y, m } = parseMonth(month);
  const grid = buildGrid(y, m);
  const today = todayISO();
  const monthLabel = `${MONTHS[locale][m]} ${y}`;

  const memberById = useMemo(
    () => new Map(members.map((mm) => [mm.user_id, mm] as const)),
    [members]
  );

  // Shifts bucketed by work_date for quick cell lookup.
  const byDate = useMemo(() => {
    const map = new Map<string, ShiftAssignment[]>();
    for (const sh of shifts) {
      const arr = map.get(sh.work_date);
      if (arr) arr.push(sh);
      else map.set(sh.work_date, [sh]);
    }
    return map;
  }, [shifts]);

  function goMonth(delta: number) {
    router.push(`/app/shifts?month=${ymString(y, m + delta)}`);
  }
  function goToday() {
    const now = new Date();
    router.push(`/app/shifts?month=${ymString(now.getUTCFullYear(), now.getUTCMonth())}`);
  }

  async function onRemove(id: string) {
    if (!window.confirm(s.removeConfirm)) return;
    const res = await removeShift(id);
    if (res.ok) {
      toast.success(s.removed);
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const noData = members.length === 0 && shifts.length === 0;

  function sectionLabel(id: string): string {
    if (id === "receptionist") return s.posReceptionist;
    if (id === "housekeeper") return s.posHousekeeper;
    return s.posOther;
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
          <p className="mt-0.5 text-sm text-[var(--app-fg-muted)]">
            {canEdit ? s.subEdit : s.subRead}
          </p>
        </div>
        {/* Tabs */}
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-[var(--app-border)]">
          {(["schedule", "staff"] as const).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3.5 py-1.5 text-sm ${
                tab === id
                  ? "bg-[var(--app-accent)] font-semibold text-[var(--app-accent-fg)]"
                  : "text-[var(--app-fg)] hover:bg-[var(--app-surface-2)]"
              }`}
            >
              {id === "schedule" ? s.tabSchedule : s.tabStaff}
            </button>
          ))}
        </div>
      </div>

      {tab === "schedule" ? (
        <>
          {/* Month bar */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => goMonth(-1)}
              className="rounded-lg p-1.5 hover:bg-[var(--app-surface-2)]"
              aria-label={s.prev}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={goToday}
              className="rounded-lg border border-[var(--app-border)] px-3 py-1 text-sm hover:bg-[var(--app-surface-2)]"
            >
              {s.today}
            </button>
            <button
              onClick={() => goMonth(1)}
              className="rounded-lg p-1.5 hover:bg-[var(--app-surface-2)]"
              aria-label={s.next}
            >
              <ChevronRight size={18} />
            </button>
            <span className="text-sm font-medium text-[var(--app-fg-muted)]">
              {monthLabel}
            </span>

            <div className="ml-auto flex items-center gap-2">
              <Legend
                shiftLabels={{ day: s.day, night: s.night }}
                posLabels={{ receptionist: s.posReceptionist, housekeeper: s.posHousekeeper }}
              />
              {canEdit && (
                <>
                  <Button variant="ghost" onClick={() => setBulkOpen(true)}>
                    <CalendarDays size={16} /> {s.bulk}
                  </Button>
                  <Button onClick={() => setAddOpen(true)}>
                    <Plus size={16} /> {s.add}
                  </Button>
                </>
              )}
            </div>
          </div>

          {noData ? (
            <div className="app-surface rounded-2xl border border-[var(--app-border)]">
              <EmptyState
                icon={<CalendarDays size={22} />}
                title={s.noData}
                hint={canEdit ? s.noDataHint : s.inviteFirst}
              />
            </div>
          ) : (
            <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
              {/* weekday header */}
              <div className="grid grid-cols-7 border-b border-[var(--app-border)] bg-[var(--app-surface-2)]">
                {WEEKDAYS[locale].map((w, i) => (
                  <div
                    key={w}
                    className={`py-2 text-center text-[11px] font-medium ${
                      i === 0 || i === 6
                        ? "text-[var(--app-danger,#b91c1c)]"
                        : "text-[var(--app-fg-muted)]"
                    }`}
                  >
                    {w}
                  </div>
                ))}
              </div>
              {/* day cells */}
              <div className="grid grid-cols-7">
                {grid.map((cell, i) => {
                  const isToday = cell.iso === today;
                  const isWeekend = cell.dow === 0 || cell.dow === 6;
                  const cellShifts = cell.inMonth ? byDate.get(cell.iso) ?? [] : [];

                  // Group this day's shifts by the member's position section.
                  const groups = new Map<string, ShiftAssignment[]>();
                  for (const sec of SECTIONS) groups.set(sec.id, []);
                  for (const sh of cellShifts) {
                    const mm = memberById.get(sh.member_id);
                    groups.get(sectionKeyForPosition(mm?.position))!.push(sh);
                  }

                  return (
                    <div
                      key={cell.iso + i}
                      className={`min-h-[96px] border-b border-r border-[var(--app-border)] p-1.5 [&:nth-child(7n)]:border-r-0 ${
                        cell.inMonth
                          ? isWeekend
                            ? "bg-[var(--app-surface-2)]/30"
                            : ""
                          : "bg-[var(--app-surface-2)]/40"
                      }`}
                    >
                      <div className="mb-1 flex justify-end">
                        <span
                          className={`grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1 text-[11px] font-semibold ${
                            isToday
                              ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                              : !cell.inMonth
                                ? "text-[var(--app-fg-muted)]"
                                : isWeekend
                                  ? "text-[var(--app-danger,#b91c1c)]"
                                  : "text-[var(--app-fg)]"
                          }`}
                        >
                          {cell.day}
                        </span>
                      </div>

                      {cell.inMonth &&
                        SECTIONS.map((sec, si) => {
                          const list = groups.get(sec.id) ?? [];
                          if (sec.id === "other" && list.length === 0) return null;
                          return (
                            <div
                              key={sec.id}
                              className={
                                si > 0 ? "mt-1 border-t border-dashed border-[var(--app-border)] pt-1" : ""
                              }
                            >
                              <div className="mb-0.5 flex items-center gap-1">
                                <span
                                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{ background: sec.dot }}
                                  aria-hidden
                                />
                                <span className="text-[9.5px] font-medium uppercase tracking-wide text-[var(--app-fg-muted)]">
                                  {sectionLabel(sec.id)}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                {list.map((sh) => (
                                  <ShiftPill
                                    key={sh.id}
                                    shift={sh}
                                    name={firstName(memberById.get(sh.member_id))}
                                    canEdit={canEdit}
                                    onRemove={() => onRemove(sh.id)}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <StaffTab members={members} canEdit={canEdit} />
      )}

      {addOpen && (
        <AddShiftModal month={month} members={members} onClose={() => setAddOpen(false)} />
      )}
      {bulkOpen && (
        <BulkAssignModal month={month} members={members} onClose={() => setBulkOpen(false)} />
      )}
    </div>
  );
}

// ── shift pill (calendar cell) ──────────────────────────────────────────────────
function pillTone(type: ShiftType): string {
  if (type === "day") {
    return "bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40";
  }
  if (type === "night") {
    return "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40";
  }
  return "bg-[var(--app-surface-2)] text-[var(--app-fg-muted)] border border-[var(--app-border)]";
}

function pillTime(sh: ShiftAssignment): string {
  const def = SHIFTS.find((x) => x.id === sh.shift_type);
  const start = (sh.start_time ?? "").slice(0, 5) || def?.start || "";
  const end = (sh.end_time ?? "").slice(0, 5) || def?.end || "";
  return start && end ? `${start}–${end}` : "";
}

function ShiftPill({
  shift,
  name,
  canEdit,
  onRemove,
}: {
  shift: ShiftAssignment;
  name: string;
  canEdit: boolean;
  onRemove: () => void;
}) {
  const time = pillTime(shift);
  const title = time ? `${name} · ${time}` : name;
  return (
    <div
      title={title}
      className={`group flex w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${pillTone(
        shift.shift_type
      )}`}
    >
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {canEdit && (
        <button onClick={onRemove} aria-label="remove" className="shrink-0">
          <X size={11} className="opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
    </div>
  );
}

// ── legend ──────────────────────────────────────────────────────────────────────
function Legend({
  shiftLabels,
  posLabels,
}: {
  shiftLabels: { day: string; night: string };
  posLabels: { receptionist: string; housekeeper: string };
}) {
  return (
    <div className="hidden flex-wrap items-center gap-2.5 text-[11px] text-[var(--app-fg-muted)] sm:flex">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-amber-400" /> {shiftLabels.day}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-indigo-500" /> {shiftLabels.night}
      </span>
      <span className="h-3 w-px bg-[var(--app-border)]" aria-hidden />
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full" style={{ background: "#2563eb" }} />
        {posLabels.receptionist}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full" style={{ background: "#16a34a" }} />
        {posLabels.housekeeper}
      </span>
    </div>
  );
}

// ── staff tab ─────────────────────────────────────────────────────────────────
function StaffTab({ members, canEdit }: { members: TenantMember[]; canEdit: boolean }) {
  const { locale } = useI18n();
  const s = STR[locale];
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState<TenantMember | null>(null);

  function roleLabel(r: TenantMember["role"]): string {
    return r === "owner" ? s.roleOwner : r === "admin" ? s.roleAdmin : s.roleStaff;
  }
  function positionLabel(p: string | null): string {
    if (!p) return "";
    const k = p.toLowerCase();
    if (k === "receptionist") return s.posReceptionist;
    if (k === "housekeeper") return s.posHousekeeper;
    return p;
  }

  async function toggleActive(m: TenantMember) {
    const res = await setMemberActiveShifts(m.user_id, !m.is_active);
    if (res.ok) {
      toast.success(s.statusSaved);
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  if (members.length === 0) {
    return (
      <div className="app-surface rounded-2xl border border-[var(--app-border)]">
        <EmptyState icon={<Users size={22} />} title={s.noStaff} hint={s.noStaffHint} />
      </div>
    );
  }

  return (
    <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--app-border)] bg-[var(--app-surface-2)] text-left text-xs text-[var(--app-fg-muted)]">
            <th className="px-4 py-2.5 font-medium">{s.staffName}</th>
            <th className="px-4 py-2.5 font-medium">{s.staffRole}</th>
            <th className="px-4 py-2.5 font-medium">{s.staffPosition}</th>
            <th className="px-4 py-2.5 font-medium">{s.staffStatus}</th>
            {canEdit && <th className="px-4 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.user_id} className="border-b border-[var(--app-border)] last:border-0">
              <td className="px-4 py-2.5 font-medium">{memberLabel(m)}</td>
              <td className="px-4 py-2.5 text-[var(--app-fg-muted)]">{roleLabel(m.role)}</td>
              <td className="px-4 py-2.5">
                {m.position ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background:
                          sectionKeyForPosition(m.position) === "receptionist"
                            ? "#2563eb"
                            : sectionKeyForPosition(m.position) === "housekeeper"
                              ? "#16a34a"
                              : "#94a3b8",
                      }}
                    />
                    {positionLabel(m.position)}
                  </span>
                ) : (
                  <span className="text-[var(--app-fg-muted)]">—</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.is_active
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-[var(--app-surface-2)] text-[var(--app-fg-muted)]"
                  }`}
                >
                  {m.is_active ? s.active : s.inactive}
                </span>
              </td>
              {canEdit && (
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditing(m)}
                      title={s.editPosition}
                      aria-label={s.editPosition}
                      className="rounded-lg border border-[var(--app-border)] p-1.5 text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => toggleActive(m)}
                      className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-surface-2)]"
                    >
                      {m.is_active ? s.disable : s.enable}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {editing && <PositionModal member={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PositionModal({ member, onClose }: { member: TenantMember; onClose: () => void }) {
  const { locale } = useI18n();
  const s = STR[locale];
  const toast = useToast();
  const router = useRouter();
  const [position, setPosition] = useState(member.position ?? "");
  const [saving, setSaving] = useState(false);

  // Show a saved free-text value verbatim if it isn't one of the canonical
  // positions (legacy rows). Selecting a canonical option overwrites it.
  const lower = position ? position.toLowerCase() : "";
  const isCustom = !!position && !POSITIONS.some((p) => p.value.toLowerCase() === lower);

  async function save() {
    setSaving(true);
    const res = await setMemberPosition(member.user_id, position.trim() || null);
    setSaving(false);
    if (res.ok) {
      toast.success(s.positionSaved);
      onClose();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${s.editPosition} · ${memberLabel(member)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {s.cancel}
          </Button>
          <Button onClick={save} loading={saving}>
            {s.save}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <label className={label}>{s.staffPosition}</label>
        <select
          className={field}
          value={isCustom ? "__custom__" : position}
          onChange={(e) => {
            if (e.target.value === "__custom__") return;
            setPosition(e.target.value);
          }}
        >
          <option value="">{s.none}</option>
          <option value="Receptionist">{s.posReceptionist}</option>
          <option value="Housekeeper">{s.posHousekeeper}</option>
          {isCustom && (
            <option value="__custom__" disabled>
              {position}
            </option>
          )}
        </select>
      </div>
    </Modal>
  );
}

// ── add-shift modal ─────────────────────────────────────────────────────────────
function AddShiftModal({
  month,
  members,
  onClose,
}: {
  month: string;
  members: TenantMember[];
  onClose: () => void;
}) {
  const { locale } = useI18n();
  const s = STR[locale];
  const toast = useToast();
  const router = useRouter();

  const { y, m } = parseMonth(month);
  const defaultDate = dateISO(y, m, 1);

  const [memberId, setMemberId] = useState(members[0]?.user_id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState<ShiftType>("day");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const noMembers = members.length === 0;

  async function save() {
    if (noMembers) return;
    if (!memberId) return toast.error(s.needMember);
    if (!date) return toast.error(s.needDate);
    setSaving(true);
    const res = await newShift({
      member_id: memberId,
      work_date: date,
      shift_type: type,
      start_time: start ? `${start}:00` : null,
      end_time: end ? `${end}:00` : null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (res.ok) {
      toast.success(s.saved);
      onClose();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={s.addTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {s.cancel}
          </Button>
          <Button onClick={save} loading={saving} disabled={noMembers}>
            {s.save}
          </Button>
        </>
      }
    >
      {noMembers ? (
        <p className="py-4 text-sm text-[var(--app-fg-muted)]">{s.inviteFirst}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className={label}>{s.member}</label>
            <select className={field} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">{s.selectMember}</option>
              {members.map((mm) => (
                <option key={mm.user_id} value={mm.user_id}>
                  {memberLabel(mm)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{s.date}</label>
              <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className={label}>{s.type}</label>
              <select className={field} value={type} onChange={(e) => setType(e.target.value as ShiftType)}>
                <option value="day">{s.day}</option>
                <option value="night">{s.night}</option>
                <option value="custom">{s.custom}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{s.start}</label>
              <input type="time" className={field} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className={label}>{s.end}</label>
              <input type="time" className={field} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={label}>{s.notes}</label>
            <input
              type="text"
              className={field}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={s.notesPh}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── bulk-assign modal ───────────────────────────────────────────────────────────
function BulkAssignModal({
  month,
  members,
  onClose,
}: {
  month: string;
  members: TenantMember[];
  onClose: () => void;
}) {
  const { locale } = useI18n();
  const s = STR[locale];
  const toast = useToast();
  const router = useRouter();

  // Default the range to the visible month (most common case).
  const { y, m } = parseMonth(month);
  const monthStart = dateISO(y, m, 1);
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const monthEnd = dateISO(y, m, lastDay);

  const active = members.filter((mm) => mm.is_active);
  const noMembers = active.length === 0;

  const [memberId, setMemberId] = useState(active[0]?.user_id ?? "");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(monthEnd);
  const [includeDay, setIncludeDay] = useState(true);
  const [includeNight, setIncludeNight] = useState(false);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [bulkStart, setBulkStart] = useState("08:00");
  const [bulkEnd, setBulkEnd] = useState("17:00");
  const [saving, setSaving] = useState(false);

  function toggleWeekday(d: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  // Preview count (mirrors the server's generation rules).
  const count = useMemo(() => {
    if (!memberId || !from || !to || from > to) return 0;
    if (!includeDay && !includeNight) return 0;
    if (weekdays.size === 0) return 0;
    const shiftsN = (includeDay ? 1 : 0) + (includeNight ? 1 : 0);
    const start = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    let days = 0;
    let i = 0;
    for (let t = start.getTime(); t <= end.getTime() && i < 400; t += 86_400_000, i++) {
      if (weekdays.has(new Date(t).getDay())) days++;
    }
    return days * shiftsN;
  }, [memberId, from, to, includeDay, includeNight, weekdays]);

  async function apply() {
    if (count === 0) return;
    const shiftTypes: ShiftType[] = [];
    if (includeDay) shiftTypes.push("day");
    if (includeNight) shiftTypes.push("night");
    const input: BulkAssignInput = {
      member_id: memberId,
      from,
      to,
      shifts: shiftTypes,
      weekdays: [...weekdays],
      start_time: useCustomTime ? bulkStart : null,
      end_time: useCustomTime ? bulkEnd : null,
    };
    setSaving(true);
    const res = await bulkAssignShifts(input);
    setSaving(false);
    if (res.ok) {
      toast.success(`${s.bulkDone} (${res.data.count})`);
      onClose();
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={s.bulkTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {s.cancel}
          </Button>
          <Button onClick={apply} loading={saving} disabled={noMembers || count === 0}>
            {saving ? s.applying : `${s.apply} (${count})`}
          </Button>
        </>
      }
    >
      {noMembers ? (
        <p className="py-4 text-sm text-[var(--app-fg-muted)]">{s.inviteFirst}</p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-[var(--app-fg-muted)]">{s.bulkSub}</p>

          <div>
            <label className={label}>{s.member}</label>
            <select className={field} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {active.map((mm) => (
                <option key={mm.user_id} value={mm.user_id}>
                  {memberLabel(mm)}
                  {mm.position ? ` — ${mm.position}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{s.dateFrom}</label>
              <input type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className={label}>{s.dateTo}</label>
              <input type="date" className={field} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={label}>{s.shift}</label>
            <div className="flex gap-2">
              <ShiftToggle
                checked={includeDay}
                onChange={() => setIncludeDay((v) => !v)}
                label={s.day}
                sub="08:00–17:00"
              />
              <ShiftToggle
                checked={includeNight}
                onChange={() => setIncludeNight((v) => !v)}
                label={s.night}
                sub="17:00–01:00"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useCustomTime}
                onChange={(e) => setUseCustomTime(e.target.checked)}
              />
              {s.useCustomTime}
            </label>
            {useCustomTime && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>{s.start}</label>
                  <input type="time" className={field} value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} />
                </div>
                <div>
                  <label className={label}>{s.end}</label>
                  <input type="time" className={field} value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={label}>{s.daysOfWeek}</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS[locale].map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(i)}
                  className={`rounded-lg border px-2.5 py-1 text-xs ${
                    weekdays.has(i)
                      ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                      : "border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                  }`}
                >
                  {d}
                </button>
              ))}
              <span className="w-px self-stretch bg-[var(--app-border)]" aria-hidden />
              <button
                type="button"
                onClick={() => setWeekdays(new Set([1, 2, 3, 4, 5]))}
                className="rounded-lg border border-[var(--app-border)] px-2.5 py-1 text-xs hover:bg-[var(--app-surface-2)]"
              >
                {s.presetWeekdays}
              </button>
              <button
                type="button"
                onClick={() => setWeekdays(new Set([0, 6]))}
                className="rounded-lg border border-[var(--app-border)] px-2.5 py-1 text-xs hover:bg-[var(--app-surface-2)]"
              >
                {s.presetWeekend}
              </button>
              <button
                type="button"
                onClick={() => setWeekdays(new Set([0, 1, 2, 3, 4, 5, 6]))}
                className="rounded-lg border border-[var(--app-border)] px-2.5 py-1 text-xs hover:bg-[var(--app-surface-2)]"
              >
                {s.presetAll}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2 text-sm">
            {s.willCreate} <strong>{count}</strong> {s.rows}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ShiftToggle({
  checked,
  onChange,
  label: lbl,
  sub,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  sub: string;
}) {
  return (
    <label
      className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        checked
          ? "border-[var(--app-accent)] bg-[var(--app-accent)]/10"
          : "border-[var(--app-border)]"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="min-w-0">
        <span className="block font-medium">{lbl}</span>
        <span className="block text-[11px] text-[var(--app-fg-muted)]">{sub}</span>
      </span>
    </label>
  );
}
