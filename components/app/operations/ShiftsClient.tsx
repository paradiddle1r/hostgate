"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import Modal from "@/components/app/ui/Modal";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import { newShift, removeShift } from "@/app/app/shifts/actions";
import type { ShiftAssignment, ShiftType, TenantMember } from "@/lib/db/operations";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "เวรงาน",
    today: "วันนี้",
    prev: "เดือนก่อน",
    next: "เดือนถัดไป",
    add: "เพิ่มเวร",
    addTitle: "เพิ่มเวรงาน",
    member: "พนักงาน",
    date: "วันที่",
    type: "ประเภทเวร",
    day: "กลางวัน",
    night: "กลางคืน",
    custom: "กำหนดเอง",
    start: "เริ่ม",
    end: "สิ้นสุด",
    notes: "หมายเหตุ",
    notesPh: "เพิ่มเติม (ถ้ามี)",
    cancel: "ยกเลิก",
    save: "บันทึก",
    saved: "เพิ่มเวรแล้ว",
    removed: "ลบเวรแล้ว",
    needMember: "เลือกพนักงาน",
    needDate: "เลือกวันที่",
    inviteFirst: "เชิญพนักงานเข้าทีมก่อน",
    noData: "ยังไม่มีเวรงาน",
    noDataHint: "เพิ่มเวรงานเพื่อจัดตารางพนักงานในเดือนนี้",
    removeConfirm: "ลบเวรนี้?",
    selectMember: "— เลือกพนักงาน —",
    listTitle: "เวรในเดือนนี้",
    shiftsCount: "เวร",
  },
  en: {
    title: "Shifts",
    today: "Today",
    prev: "Previous month",
    next: "Next month",
    add: "Add shift",
    addTitle: "Add shift",
    member: "Member",
    date: "Date",
    type: "Shift type",
    day: "Day",
    night: "Night",
    custom: "Custom",
    start: "Start",
    end: "End",
    notes: "Notes",
    notesPh: "Optional",
    cancel: "Cancel",
    save: "Save",
    saved: "Shift added",
    removed: "Shift removed",
    needMember: "Pick a member",
    needDate: "Pick a date",
    inviteFirst: "Invite staff first",
    noData: "No shifts yet",
    noDataHint: "Add a shift to schedule staff this month.",
    removeConfirm: "Remove this shift?",
    selectMember: "— Select member —",
    listTitle: "Shifts this month",
    shiftsCount: "shifts",
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
  // Sun → Sat to match en-US grid.
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  th: ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."],
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

// ── UTC date helpers (no Date.now-based libs; new Date() is fine client-side) ──
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
/** Year/month from a "YYYY-MM" string. */
function parseMonth(month: string): { y: number; m: number } {
  const [y, m] = month.split("-").map(Number);
  return { y, m: m - 1 }; // m is 0-based
}
function ymString(y: number, m0: number): string {
  // m0 is 0-based; normalize roll-over.
  const d = new Date(Date.UTC(y, m0, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** Build "YYYY-MM-DD" for a given Y / 0-based month / day, in UTC. */
function dateISO(y: number, m0: number, day: number): string {
  return new Date(Date.UTC(y, m0, day)).toISOString().slice(0, 10);
}

interface GridCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** Sun–Sat weeks covering the whole month (with leading/trailing adjacent days). */
function buildGrid(y: number, m0: number): GridCell[] {
  const first = new Date(Date.UTC(y, m0, 1));
  const firstDow = first.getUTCDay(); // 0 = Sun
  const daysInMonth = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const cells: GridCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    // dayOffset relative to the 1st of the month; can be negative for leading days.
    const dayOffset = i - firstDow;
    const d = new Date(Date.UTC(y, m0, 1 + dayOffset));
    cells.push({
      iso: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === m0 && d.getUTCFullYear() === y,
    });
  }
  return cells;
}

function firstName(m: TenantMember | undefined): string {
  if (!m) return "?";
  if (m.display_name && m.display_name.trim()) {
    return m.display_name.trim().split(/\s+/)[0];
  }
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
}: {
  month: string;
  shifts: ShiftAssignment[];
  members: TenantMember[];
}) {
  const { locale } = useI18n();
  const s = STR[locale];
  const toast = useToast();
  const router = useRouter();

  const [addOpen, setAddOpen] = useState(false);

  const { y, m } = parseMonth(month);
  const grid = buildGrid(y, m);
  const today = todayISO();
  const monthLabel = `${MONTHS[locale][m]} ${y}`;

  const memberById = new Map(members.map((mm) => [mm.user_id, mm] as const));

  // Shifts bucketed by work_date for quick cell lookup.
  const byDate = new Map<string, ShiftAssignment[]>();
  for (const sh of shifts) {
    const arr = byDate.get(sh.work_date);
    if (arr) arr.push(sh);
    else byDate.set(sh.work_date, [sh]);
  }

  function goMonth(delta: number) {
    router.push(`/app/shifts?month=${ymString(y, m + delta)}`);
  }
  function goToday() {
    const now = new Date();
    router.push(
      `/app/shifts?month=${ymString(now.getUTCFullYear(), now.getUTCMonth())}`
    );
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

  // Sorted flat list (this month) for the compact list below the grid.
  const monthShifts = [...shifts].sort((a, b) =>
    a.work_date === b.work_date
      ? a.shift_type.localeCompare(b.shift_type)
      : a.work_date.localeCompare(b.work_date)
  );

  const noData = members.length === 0 && shifts.length === 0;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
        <div className="flex items-center gap-1">
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
        </div>
        <span className="text-sm font-medium text-[var(--app-fg-muted)]">
          {monthLabel}
        </span>
        <div className="ml-auto">
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} /> {s.add}
          </Button>
        </div>
      </div>

      {noData ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState
            icon={<CalendarDays size={22} />}
            title={s.noData}
            hint={s.inviteFirst}
          />
        </div>
      ) : (
        <>
          {/* Month calendar grid */}
          <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
            {/* weekday header */}
            <div className="grid grid-cols-7 border-b border-[var(--app-border)] bg-[var(--app-surface-2)]">
              {WEEKDAYS[locale].map((w) => (
                <div
                  key={w}
                  className="py-2 text-center text-[11px] font-medium text-[var(--app-fg-muted)]"
                >
                  {w}
                </div>
              ))}
            </div>
            {/* day cells */}
            <div className="grid grid-cols-7">
              {grid.map((cell, i) => {
                const isToday = cell.iso === today;
                const cellShifts = cell.inMonth ? byDate.get(cell.iso) ?? [] : [];
                return (
                  <div
                    key={cell.iso + i}
                    className={`min-h-[88px] border-b border-r border-[var(--app-border)] p-1.5 [&:nth-child(7n)]:border-r-0 ${
                      cell.inMonth ? "" : "bg-[var(--app-surface-2)]/40"
                    }`}
                  >
                    <div className="mb-1 flex justify-end">
                      <span
                        className={`grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1 text-[11px] font-semibold ${
                          isToday
                            ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                            : cell.inMonth
                              ? "text-[var(--app-fg)]"
                              : "text-[var(--app-fg-muted)]"
                        }`}
                      >
                        {cell.day}
                      </span>
                    </div>
                    {cell.inMonth && (
                      <div className="space-y-1">
                        {cellShifts.map((sh) => (
                          <ShiftPill
                            key={sh.id}
                            shift={sh}
                            name={firstName(memberById.get(sh.member_id))}
                            onRemove={() => onRemove(sh.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact list of this month's shifts */}
          {monthShifts.length > 0 && (
            <div className="app-surface mt-4 rounded-2xl border border-[var(--app-border)] p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Users size={15} /> {s.listTitle}
                <span className="text-[var(--app-fg-muted)]">
                  ({monthShifts.length} {s.shiftsCount})
                </span>
              </h3>
              <ul className="divide-y divide-[var(--app-border)]">
                {monthShifts.map((sh) => {
                  const mm = memberById.get(sh.member_id);
                  const typeName =
                    sh.shift_type === "day"
                      ? s.day
                      : sh.shift_type === "night"
                        ? s.night
                        : s.custom;
                  const time =
                    sh.start_time || sh.end_time
                      ? ` · ${(sh.start_time ?? "").slice(0, 5)}–${(sh.end_time ?? "").slice(0, 5)}`
                      : "";
                  return (
                    <li
                      key={sh.id}
                      className="flex items-center gap-3 py-2 text-sm"
                    >
                      <span className="w-24 shrink-0 text-[var(--app-fg-muted)]">
                        {sh.work_date.slice(5)}
                      </span>
                      <ShiftDot type={sh.shift_type} />
                      <span className="min-w-0 flex-1 truncate">
                        {mm ? memberLabel(mm) : sh.member_id}
                        <span className="text-[var(--app-fg-muted)]">
                          {" · "}
                          {typeName}
                          {time}
                        </span>
                      </span>
                      <button
                        onClick={() => onRemove(sh.id)}
                        aria-label={s.removeConfirm}
                        title={s.removeConfirm}
                        className="shrink-0 rounded-lg border border-[var(--app-border)] p-1 text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {addOpen && (
        <AddShiftModal
          month={month}
          members={members}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

// ── Shift pill (calendar cell) ────────────────────────────────────────────────
function pillTone(type: ShiftType): string {
  if (type === "day") {
    return "bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40";
  }
  if (type === "night") {
    return "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40";
  }
  return "bg-[var(--app-surface-2)] text-[var(--app-fg-muted)] border border-[var(--app-border)]";
}

function ShiftPill({
  shift,
  name,
  onRemove,
}: {
  shift: ShiftAssignment;
  name: string;
  onRemove: () => void;
}) {
  return (
    <button
      onClick={onRemove}
      title={name}
      className={`group flex w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium ${pillTone(
        shift.shift_type
      )}`}
    >
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <X
        size={11}
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}

function ShiftDot({ type }: { type: ShiftType }) {
  const bg =
    type === "day" ? "#fbbf24" : type === "night" ? "#6366f1" : "var(--app-fg-muted)";
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: bg }}
    />
  );
}

// ── Add-shift modal ───────────────────────────────────────────────────────────
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
            <select
              className={field}
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
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
              <input
                type="date"
                className={field}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className={label}>{s.type}</label>
              <select
                className={field}
                value={type}
                onChange={(e) => setType(e.target.value as ShiftType)}
              >
                <option value="day">{s.day}</option>
                <option value="night">{s.night}</option>
                <option value="custom">{s.custom}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{s.start}</label>
              <input
                type="time"
                className={field}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className={label}>{s.end}</label>
              <input
                type="time"
                className={field}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
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
