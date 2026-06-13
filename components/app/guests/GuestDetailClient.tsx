"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Crown,
  Edit3,
  CreditCard,
  MapPin,
  Phone,
  Save,
  ShieldAlert,
  Star,
  Trash2,
  UserCircle2,
  X,
} from "lucide-react";
import type { Guest, GuestInput } from "@/lib/db/guests";
import type { Booking } from "@/lib/db/bookings";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import { updateGuestFields, deleteGuestAction } from "@/app/app/guests/actions";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    back: "แขกทั้งหมด",
    unnamed: "ไม่ระบุชื่อ",
    vip: "VIP",
    blacklist: "บัญชีดำ",
    inHouse: "กำลังพัก",
    room: "ห้อง",
    plate: "ทะเบียนรถ",
    markVip: "ตั้งเป็น VIP",
    unmarkVip: "ยกเลิก VIP",
    doBlacklist: "ขึ้นบัญชีดำ",
    unBlacklist: "ปลดบัญชีดำ",
    delete: "ลบ",
    confirmDelete: "ยืนยันการลบ?",
    deleted: "ลบแล้ว",
    saved: "บันทึกแล้ว",
    saving: "กำลังบันทึก…",
    // KPIs
    visits: "เข้าพัก",
    nights: "คืน",
    spend: "ยอดใช้จ่ายรวม",
    lastStay: "เข้าพักล่าสุด",
    // profile
    profile: "ข้อมูลแขก",
    fullName: "ชื่อ-นามสกุล",
    thaiName: "ชื่อภาษาไทย",
    phone: "เบอร์โทรศัพท์",
    email: "อีเมล",
    carPlate: "ทะเบียนรถ",
    nationality: "สัญชาติ",
    // thai id
    thaiId: "บัตรประชาชน",
    idNumber: "เลขบัตรประชาชน",
    dob: "วันเกิด",
    gender: "เพศ",
    issued: "วันออกบัตร",
    expires: "วันหมดอายุ",
    address: "ที่อยู่",
    // prefs / notes
    prefsNotes: "ความต้องการและบันทึก",
    preferences: "ความต้องการของแขก",
    preferencesHelp: "เช่น เช็คอินดึกได้ ไม่เอาหมอนขนเป็ด จอดใกล้ทางเข้า",
    notes: "บันทึกภายใน",
    notesHelp: "เก็บไว้ในโปรไฟล์ ไม่แชร์ให้แขก",
    blacklistReason: "เหตุผลบัญชีดำ",
    blacklistReasonHelp: "เหตุผลที่ขึ้นบัญชีดำ — แสดงให้พนักงานเห็นเมื่อจองซ้ำ",
    tags: "ป้ายกำกับ",
    tagsHelp: "พิมพ์แล้วกด Enter เพื่อเพิ่ม",
    addTag: "เพิ่มป้าย…",
    discard: "ยกเลิก",
    save: "บันทึก",
    // stay history
    stayHistory: "ประวัติการเข้าพัก",
    noStays: "ยังไม่มีการจองที่เชื่อมกับโปรไฟล์นี้",
    cDates: "วันที่",
    cRoom: "ห้อง",
    cNights: "คืน",
    cTotal: "รวม",
    cSource: "ช่องทาง",
    cStatus: "สถานะ",
    none: "—",
    // statuses
    sPending: "รอยืนยัน",
    sConfirmed: "ยืนยันแล้ว",
    sCheckedIn: "เช็คอินแล้ว",
    sCheckedOut: "เช็คเอาท์แล้ว",
    sCancelled: "ยกเลิก",
    tMonthly: "รายเดือน",
    tBlocked: "บล็อก",
    tOos: "งดขาย",
  },
  en: {
    back: "All guests",
    unnamed: "Unnamed guest",
    vip: "VIP",
    blacklist: "Blacklist",
    inHouse: "In-house",
    room: "Room",
    plate: "Plate",
    markVip: "Mark as VIP",
    unmarkVip: "Unmark VIP",
    doBlacklist: "Blacklist",
    unBlacklist: "Unblacklist",
    delete: "Delete",
    confirmDelete: "Confirm delete?",
    deleted: "Deleted",
    saved: "Saved",
    saving: "Saving…",
    visits: "Visits",
    nights: "Nights",
    spend: "Lifetime spend",
    lastStay: "Last stay",
    profile: "Profile",
    fullName: "Full name",
    thaiName: "Thai name",
    phone: "Phone",
    email: "Email",
    carPlate: "Car plate",
    nationality: "Nationality",
    thaiId: "Thai ID card",
    idNumber: "ID number",
    dob: "Date of birth",
    gender: "Gender",
    issued: "Issued",
    expires: "Expires",
    address: "Address",
    prefsNotes: "Preferences & notes",
    preferences: "Guest preferences",
    preferencesHelp: "Carried into bookings — late check-in OK, no down pillows, park by entrance.",
    notes: "Internal staff notes",
    notesHelp: "Stays on the profile, not shared with the guest.",
    blacklistReason: "Blacklist reason",
    blacklistReasonHelp: "Why this guest is blacklisted — shown to staff who try to book them again.",
    tags: "Tags",
    tagsHelp: "Type and press Enter to add.",
    addTag: "Add a tag…",
    discard: "Discard",
    save: "Save",
    stayHistory: "Stay history",
    noStays: "No bookings linked to this profile yet.",
    cDates: "Dates",
    cRoom: "Room",
    cNights: "Nights",
    cTotal: "Total",
    cSource: "Source",
    cStatus: "Status",
    none: "—",
    sPending: "Pending",
    sConfirmed: "Confirmed",
    sCheckedIn: "Checked in",
    sCheckedOut: "Checked out",
    sCancelled: "Cancelled",
    tMonthly: "Monthly",
    tBlocked: "Blocked",
    tOos: "OOS",
  },
};

const inputCls =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)] w-full";

const labelCls =
  "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--app-fg-muted)]";

const badge = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function isoToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function nights(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 86_400_000) : 0;
}

function fmtSpend(n: number, currency: string): string {
  const sym = currency === "THB" ? "฿" : "";
  return `${sym}${Math.round(n).toLocaleString()}${sym ? "" : ` ${currency}`}`;
}

export default function GuestDetailClient({
  guest,
  bookings,
  roomNumberById,
  currency,
}: {
  guest: Guest;
  bookings: Booking[];
  roomNumberById: Record<string, string>;
  currency: string;
}) {
  const { locale } = useI18n();
  const s = (k: string) => STR[locale][k] ?? k;
  const toast = useToast();
  const router = useRouter();

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Stats roll-up over linked bookings (standard stays count toward CRM totals).
  const stats = useMemo(() => {
    const today = isoToday();
    let visits = 0;
    let nightsTotal = 0;
    let spend = 0;
    let lastStay: string | null = null;
    let inHouseRoomId: string | null = null;
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      visits += 1;
      nightsTotal += nights(b.check_in, b.check_out);
      const amt = Number(b.total_amount);
      if (Number.isFinite(amt)) spend += amt;
      if (!lastStay || (b.check_in && b.check_in > lastStay)) lastStay = b.check_in;
      if (
        b.status === "checked_in" ||
        (b.check_in <= today && b.check_out > today)
      ) {
        inHouseRoomId = b.room_id;
      }
    }
    return { visits, nights: nightsTotal, spend, lastStay, inHouseRoomId };
  }, [bookings]);

  // Generic patch → action → refresh. The server re-renders with the new row,
  // so we don't keep optimistic local state.
  async function patch(fields: Partial<GuestInput>, key: string) {
    setSavingKey(key);
    const res = await updateGuestFields(guest.id, fields);
    setSavingKey(null);
    if (res.ok) {
      toast.success(s("saved"));
      router.refresh();
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  async function toggleVip() {
    await patch({ is_vip: !guest.is_vip }, "vip");
  }
  async function toggleBlacklist() {
    await patch({ is_blacklisted: !guest.is_blacklisted }, "blacklist");
  }

  async function removeGuest() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const res = await deleteGuestAction(guest.id);
    if (res.ok) {
      toast.success(s("deleted"));
      router.push("/app/guests");
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const inHouseRoomNo = stats.inHouseRoomId ? roomNumberById[stats.inHouseRoomId] : null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/app/guests"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-[var(--app-fg-muted)] hover:text-[var(--app-fg)]"
      >
        <ArrowLeft size={14} /> {s("back")}
      </Link>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="app-surface mb-4 flex flex-wrap items-start gap-4 rounded-2xl border border-[var(--app-border)] p-5">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--app-accent)] text-2xl font-bold text-[var(--app-accent-fg)]">
          {initials(guest.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {guest.full_name || s("unnamed")}
            </h1>
            {guest.is_vip && (
              <span className={`${badge} bg-[#f59e0b]/15 text-[#b45309]`}>
                <Crown size={12} /> {s("vip")}
              </span>
            )}
            {guest.is_blacklisted && (
              <span className={`${badge} bg-[var(--app-danger)]/15 text-[var(--app-danger)]`}>
                <ShieldAlert size={12} /> {s("blacklist")}
              </span>
            )}
            {stats.inHouseRoomId && (
              <span className={`${badge} bg-[var(--app-success)]/15 text-[var(--app-success)]`}>
                {s("inHouse")}
                {inHouseRoomNo ? ` · ${s("room")} #${inHouseRoomNo}` : ""}
              </span>
            )}
          </div>
          {guest.thai_name && (
            <div className="mt-0.5 text-sm text-[var(--app-fg-muted)]">{guest.thai_name}</div>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {guest.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={12} /> {guest.phone}
              </span>
            )}
            {guest.email && <span>{guest.email}</span>}
            {guest.car_plate && (
              <span className="text-[var(--app-fg-muted)]">
                {s("plate")}: {guest.car_plate}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleVip}
            loading={savingKey === "vip"}
            className={guest.is_vip ? "!border-[#f59e0b] !text-[#b45309]" : ""}
          >
            <Star size={14} fill={guest.is_vip ? "currentColor" : "none"} />{" "}
            {guest.is_vip ? s("unmarkVip") : s("markVip")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleBlacklist}
            loading={savingKey === "blacklist"}
            className={guest.is_blacklisted ? "!border-[var(--app-danger)] !text-[var(--app-danger)]" : ""}
          >
            <ShieldAlert size={14} />{" "}
            {guest.is_blacklisted ? s("unBlacklist") : s("doBlacklist")}
          </Button>
          <Button
            variant={confirmDelete ? "danger" : "ghost"}
            size="sm"
            onClick={removeGuest}
          >
            <Trash2 size={14} /> {confirmDelete ? s("confirmDelete") : s("delete")}
          </Button>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={s("visits")} value={String(stats.visits)} />
        <Kpi label={s("nights")} value={String(stats.nights)} />
        <Kpi label={s("spend")} value={stats.spend ? fmtSpend(stats.spend, currency) : fmtSpend(0, currency)} />
        <Kpi label={s("lastStay")} value={stats.lastStay ?? s("none")} />
      </div>

      {/* ── BODY: two columns ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* PROFILE + THAI ID */}
        <section className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UserCircle2 size={16} /> {s("profile")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EditableField
              label={s("fullName")}
              value={guest.full_name}
              saving={savingKey === "full_name"}
              onCommit={(v) => patch({ full_name: v.trim() || guest.full_name }, "full_name")}
              savingLabel={s("saving")}
            />
            <EditableField
              label={s("thaiName")}
              value={guest.thai_name}
              saving={savingKey === "thai_name"}
              onCommit={(v) => patch({ thai_name: v.trim() || null }, "thai_name")}
              savingLabel={s("saving")}
            />
            <EditableField
              label={s("phone")}
              value={guest.phone}
              saving={savingKey === "phone"}
              onCommit={(v) => patch({ phone: v.trim() || undefined }, "phone")}
              savingLabel={s("saving")}
            />
            <EditableField
              label={s("email")}
              value={guest.email}
              saving={savingKey === "email"}
              onCommit={(v) => patch({ email: v.trim() || undefined }, "email")}
              savingLabel={s("saving")}
            />
            <EditableField
              label={s("carPlate")}
              value={guest.car_plate}
              saving={savingKey === "car_plate"}
              onCommit={(v) => patch({ car_plate: v.trim() || null }, "car_plate")}
              savingLabel={s("saving")}
            />
            <EditableField
              label={s("nationality")}
              value={guest.nationality}
              saving={savingKey === "nationality"}
              onCommit={(v) => patch({ nationality: v.trim() || undefined }, "nationality")}
              savingLabel={s("saving")}
            />
          </div>

          {/* Thai ID panel */}
          <h3 className="mb-3 mt-6 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--app-fg-muted)]">
            <CreditCard size={14} /> {s("thaiId")}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EditableField
              label={s("idNumber")}
              value={guest.citizen_id}
              saving={savingKey === "citizen_id"}
              onCommit={(v) => patch({ citizen_id: v.trim() || null }, "citizen_id")}
              savingLabel={s("saving")}
            />
            <EditableField
              label={s("dob")}
              value={guest.id_dob}
              type="date"
              saving={savingKey === "id_dob"}
              onCommit={(v) => patch({ id_dob: v.trim() || null }, "id_dob")}
              savingLabel={s("saving")}
            />
            <EditableField
              label={s("gender")}
              value={guest.id_gender}
              saving={savingKey === "id_gender"}
              onCommit={(v) => patch({ id_gender: v.trim() || null }, "id_gender")}
              savingLabel={s("saving")}
            />
            <EditableField
              label={s("issued")}
              value={guest.id_issued_date}
              type="date"
              saving={savingKey === "id_issued_date"}
              onCommit={(v) => patch({ id_issued_date: v.trim() || null }, "id_issued_date")}
              savingLabel={s("saving")}
            />
            <EditableField
              label={s("expires")}
              value={guest.id_expires_date}
              type="date"
              saving={savingKey === "id_expires_date"}
              onCommit={(v) => patch({ id_expires_date: v.trim() || null }, "id_expires_date")}
              savingLabel={s("saving")}
            />
            <div className="sm:col-span-2">
              <BigText
                label={`${s("address")}`}
                icon={<MapPin size={11} />}
                value={guest.id_address}
                saving={savingKey === "id_address"}
                onSave={(v) => patch({ id_address: v.trim() || null }, "id_address")}
                savingLabel={s("saving")}
                discardLabel={s("discard")}
                saveLabel={s("save")}
                rows={2}
              />
            </div>
          </div>
        </section>

        {/* PREFERENCES / NOTES / TAGS */}
        <section className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Edit3 size={16} /> {s("prefsNotes")}
          </h2>
          <BigText
            label={s("preferences")}
            help={s("preferencesHelp")}
            value={guest.preferences}
            saving={savingKey === "preferences"}
            onSave={(v) => patch({ preferences: v.trim() || null }, "preferences")}
            savingLabel={s("saving")}
            discardLabel={s("discard")}
            saveLabel={s("save")}
          />
          <BigText
            label={s("notes")}
            help={s("notesHelp")}
            value={guest.notes}
            saving={savingKey === "notes"}
            onSave={(v) => patch({ notes: v.trim() || undefined }, "notes")}
            savingLabel={s("saving")}
            discardLabel={s("discard")}
            saveLabel={s("save")}
          />
          {guest.is_blacklisted && (
            <BigText
              label={s("blacklistReason")}
              help={s("blacklistReasonHelp")}
              value={guest.blacklist_reason}
              saving={savingKey === "blacklist_reason"}
              onSave={(v) => patch({ blacklist_reason: v.trim() || null }, "blacklist_reason")}
              savingLabel={s("saving")}
              discardLabel={s("discard")}
              saveLabel={s("save")}
            />
          )}

          {/* Tags */}
          <div className="mt-2">
            <span className={labelCls}>{s("tags")}</span>
            <p className="mt-0.5 text-[11px] text-[var(--app-fg-muted)]">{s("tagsHelp")}</p>
            <TagEditor
              tags={guest.tags ?? []}
              saving={savingKey === "tags"}
              addPlaceholder={s("addTag")}
              onChange={(next) => patch({ tags: next }, "tags")}
            />
          </div>
        </section>
      </div>

      {/* ── STAY HISTORY ─────────────────────────────────────────────────── */}
      <section className="app-surface mt-4 rounded-2xl border border-[var(--app-border)] p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Calendar size={16} /> {s("stayHistory")}
        </h2>
        {bookings.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-[var(--app-fg-muted)]">
            {s("noStays")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--app-border)] text-left text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
                  <th className="px-3 py-2 font-medium">{s("cDates")}</th>
                  <th className="px-3 py-2 font-medium">{s("cRoom")}</th>
                  <th className="px-3 py-2 text-right font-medium">{s("cNights")}</th>
                  <th className="px-3 py-2 text-right font-medium">{s("cTotal")}</th>
                  <th className="px-3 py-2 font-medium">{s("cSource")}</th>
                  <th className="px-3 py-2 font-medium">{s("cStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const roomNo = b.room_id ? roomNumberById[b.room_id] : null;
                  return (
                    <tr key={b.id} className="border-t border-[var(--app-border)]">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{b.check_in}</div>
                        <div className="text-xs text-[var(--app-fg-muted)]">→ {b.check_out}</div>
                      </td>
                      <td className="px-3 py-2.5">{roomNo ? `#${roomNo}` : s("none")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {nights(b.check_in, b.check_out)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {b.total_amount != null
                          ? fmtSpend(Number(b.total_amount), currency)
                          : s("none")}
                      </td>
                      <td className="px-3 py-2.5">
                        <div>{b.ota || b.source || s("none")}</div>
                        {b.reservation_no && (
                          <div className="text-xs text-[var(--app-fg-muted)]">
                            {b.reservation_no}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={b.status} type={b.booking_type} s={s} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--app-fg-muted)]">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

// Inline-editable field — commits on blur or Enter; Esc reverts. Date inputs
// pass a `type`.
function EditableField({
  label,
  value,
  onCommit,
  saving,
  savingLabel,
  type = "text",
}: {
  label: string;
  value: string | null | undefined;
  onCommit: (v: string) => void;
  saving: boolean;
  savingLabel: string;
  type?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  function commit() {
    setEditing(false);
    if ((value ?? "") === draft) return;
    onCommit(draft);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>
        {label}
        {saving && (
          <span className="ml-1 text-[10px] font-normal normal-case text-[var(--app-success)]">
            {savingLabel}
          </span>
        )}
      </span>
      <input
        type={type}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (!editing) setEditing(true);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(value ?? "");
            e.currentTarget.blur();
          }
        }}
        className={inputCls}
      />
    </label>
  );
}

// Multi-line text with explicit Save/Discard (no blur auto-save — staff tab
// through these while reading).
function BigText({
  label,
  help,
  icon,
  value,
  onSave,
  saving,
  savingLabel,
  discardLabel,
  saveLabel,
  rows = 3,
}: {
  label: string;
  help?: string;
  icon?: React.ReactNode;
  value: string | null | undefined;
  onSave: (v: string) => void;
  saving: boolean;
  savingLabel: string;
  discardLabel: string;
  saveLabel: string;
  rows?: number;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setDraft(value ?? "");
  }, [value, dirty]);

  return (
    <div className="mb-4 flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className={labelCls}>
          {icon}
          {label}
          {saving && (
            <span className="ml-1 text-[10px] font-normal normal-case text-[var(--app-success)]">
              {savingLabel}
            </span>
          )}
        </span>
        {dirty && (
          <span className="flex gap-3">
            <button
              onClick={() => {
                setDraft(value ?? "");
                setDirty(false);
              }}
              className="text-[11px] text-[var(--app-fg-muted)] underline"
            >
              {discardLabel}
            </button>
            <button
              onClick={() => {
                onSave(draft);
                setDirty(false);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--app-accent)]"
            >
              <Save size={11} /> {saveLabel}
            </button>
          </span>
        )}
      </div>
      {help && <div className="text-[11px] text-[var(--app-fg-muted)]">{help}</div>}
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
        rows={rows}
        className={`${inputCls} resize-y`}
      />
    </div>
  );
}

// Free-form tag chip editor. Each commit writes the full tags[] array.
function TagEditor({
  tags,
  onChange,
  saving,
  addPlaceholder,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  saving: boolean;
  addPlaceholder: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const v = input.trim();
    if (!v || tags.includes(v)) {
      setInput("");
      return;
    }
    onChange([...tags, v]);
    setInput("");
  }
  function remove(t: string) {
    onChange(tags.filter((x) => x !== t));
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2.5 py-0.5 text-xs"
        >
          {t}
          <button onClick={() => remove(t)} aria-label="remove tag" className="text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]">
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={addPlaceholder}
        disabled={saving}
        className="min-w-[120px] flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs outline-none focus:border-[var(--app-accent)]"
      />
    </div>
  );
}

function StatusPill({
  status,
  type,
  s,
}: {
  status: Booking["status"];
  type: Booking["booking_type"];
  s: (k: string) => string;
}) {
  let cls = "bg-[var(--app-accent)]/15 text-[var(--app-accent)]";
  let label = s("sConfirmed");
  if (type === "monthly") {
    cls = "bg-[#8b5cf6]/15 text-[#7c3aed]";
    label = s("tMonthly");
  } else if (type === "blocked") {
    cls = "bg-[var(--app-fg-muted)]/15 text-[var(--app-fg-muted)]";
    label = s("tBlocked");
  } else if (type === "oos") {
    cls = "bg-[var(--app-danger)]/15 text-[var(--app-danger)]";
    label = s("tOos");
  } else if (status === "checked_in") {
    cls = "bg-[var(--app-success)]/15 text-[var(--app-success)]";
    label = s("sCheckedIn");
  } else if (status === "checked_out") {
    cls = "bg-[var(--app-fg-muted)]/15 text-[var(--app-fg-muted)]";
    label = s("sCheckedOut");
  } else if (status === "pending") {
    cls = "bg-[#f59e0b]/15 text-[#b45309]";
    label = s("sPending");
  } else if (status === "cancelled") {
    cls = "bg-[var(--app-danger)]/15 text-[var(--app-danger)]";
    label = s("sCancelled");
  }
  return <span className={`${badge} ${cls}`}>{label}</span>;
}
