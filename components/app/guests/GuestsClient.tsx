"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Users, Search, Plus, Phone, Mail, Star, Ban, Crown, X } from "lucide-react";
import type { Guest, GuestInput } from "@/lib/db/guests";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import Modal from "@/components/app/ui/Modal";
import EmptyState from "@/components/app/ui/EmptyState";
import { saveGuest } from "@/app/app/guests/actions";

// Per-guest rolled-up history, computed server-side in page.tsx.
export type GuestStat = {
  visits: number;
  nights: number;
  spend: number;
  lastStay: string | null;
  inHouseRoomId: string | null;
};

// Local bilingual strings, keyed off useI18n().locale — same shape lib/app-i18n.ts uses.
const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "แขก",
    subtitle: "ฐานข้อมูลลูกค้า — ประวัติการเข้าพัก ยอดใช้จ่าย และบันทึก",
    searchPlaceholder: "ค้นหา ชื่อ ชื่อไทย เบอร์โทร อีเมล เลขบัตร ทะเบียนรถ…",
    newGuest: "เพิ่มแขก",
    name: "ชื่อ-นามสกุล",
    thaiName: "ชื่อภาษาไทย",
    phone: "เบอร์โทรศัพท์",
    email: "อีเมล",
    preferences: "ความต้องการพิเศษ",
    save: "บันทึก",
    creating: "กำลังสร้าง…",
    create: "สร้างแขก",
    cancel: "ยกเลิก",
    optional: "(ไม่บังคับ)",
    emptyTitle: "ยังไม่มีแขก",
    emptyHint: "เพิ่มแขกคนแรกเพื่อเริ่มเก็บข้อมูลลูกค้า",
    noMatchTitle: "ไม่พบแขก",
    noMatchHint: "ลองค้นหาด้วยคำอื่น",
    vip: "VIP",
    blacklist: "บัญชีดำ",
    returning: "ลูกค้าประจำ",
    inHouse: "กำลังพัก",
    unnamed: "ไม่ระบุชื่อ",
    // filters
    fAll: "ทั้งหมด",
    fVip: "VIP",
    fReturning: "ลูกค้าประจำ",
    fInHouse: "กำลังพัก",
    fBlacklist: "บัญชีดำ",
    // columns
    cGuest: "แขก",
    cContact: "การติดต่อ",
    cVisits: "เข้าพัก",
    cNights: "คืน",
    cSpend: "ยอดใช้จ่าย",
    cLastStay: "เข้าพักล่าสุด",
    cStatus: "สถานะ",
    never: "—",
  },
  en: {
    title: "Guests",
    subtitle: "Your guest CRM — stay history, lifetime spend, and notes.",
    searchPlaceholder: "Search name, Thai name, phone, email, ID, plate…",
    newGuest: "New guest",
    name: "Full name",
    thaiName: "Thai name",
    phone: "Phone",
    email: "Email",
    preferences: "Preferences",
    save: "Save",
    creating: "Creating…",
    create: "Create guest",
    cancel: "Cancel",
    optional: "(optional)",
    emptyTitle: "No guests yet",
    emptyHint: "Add your first guest to start building your CRM.",
    noMatchTitle: "No guests found",
    noMatchHint: "Try a different search term.",
    vip: "VIP",
    blacklist: "Blacklisted",
    returning: "Returning",
    inHouse: "In-house",
    unnamed: "Unnamed guest",
    // filters
    fAll: "All",
    fVip: "VIP",
    fReturning: "Returning",
    fInHouse: "In-house",
    fBlacklist: "Blacklist",
    // columns
    cGuest: "Guest",
    cContact: "Contact",
    cVisits: "Visits",
    cNights: "Nights",
    cSpend: "Spend",
    cLastStay: "Last stay",
    cStatus: "Status",
    never: "—",
  },
};

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

type FilterId = "all" | "vip" | "returning" | "in_house" | "blacklist";

const FILTERS: { id: FilterId; key: string }[] = [
  { id: "all", key: "fAll" },
  { id: "vip", key: "fVip" },
  { id: "returning", key: "fReturning" },
  { id: "in_house", key: "fInHouse" },
  { id: "blacklist", key: "fBlacklist" },
];

const EMPTY_STAT: GuestStat = {
  visits: 0,
  nights: 0,
  spend: 0,
  lastStay: null,
  inHouseRoomId: null,
};

function fmtSpend(n: number, currency: string): string {
  const sym = currency === "THB" ? "฿" : "";
  return `${sym}${Math.round(n).toLocaleString()}${sym ? "" : ` ${currency}`}`;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const badge =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";

export default function GuestsClient({
  initialGuests,
  statsByGuestId,
  roomNumberById,
  currency,
}: {
  initialGuests: Guest[];
  statsByGuestId: Record<string, GuestStat>;
  roomNumberById: Record<string, string>;
  currency: string;
}) {
  const { locale } = useI18n();
  const s = (k: string) => STR[locale][k] ?? k;
  const toast = useToast();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [showNew, setShowNew] = useState(false);

  const stat = (id: string): GuestStat => statsByGuestId[id] ?? EMPTY_STAT;

  // Search (over name/thai_name/phone/email/id/plate) + filter chips + sort,
  // all client-side over the full list the loader provided.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = initialGuests.filter((g) => {
      if (!q) return true;
      const hay = [
        g.full_name,
        g.thai_name,
        g.phone,
        g.email,
        g.citizen_id,
        g.id_number,
        g.car_plate,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    if (filter === "vip") rows = rows.filter((g) => g.is_vip);
    if (filter === "blacklist") rows = rows.filter((g) => g.is_blacklisted);
    if (filter === "returning") rows = rows.filter((g) => stat(g.id).visits >= 2);
    if (filter === "in_house") rows = rows.filter((g) => stat(g.id).inHouseRoomId);

    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGuests, query, filter, statsByGuestId]);

  const isSearching = query.trim().length > 0 || filter !== "all";

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-2 flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
          <p className="mt-1 text-sm text-[var(--app-fg-muted)]">{s("subtitle")}</p>
        </div>
        <span className="text-sm text-[var(--app-fg-muted)]">{initialGuests.length}</span>
        <Button className="ml-auto" onClick={() => setShowNew(true)}>
          <Plus size={16} /> {s("newGuest")}
        </Button>
      </div>

      {/* Toolbar: search + filter chips */}
      <div className="mb-4 mt-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
          <Search size={16} className="shrink-0 text-[var(--app-fg-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s("searchPlaceholder")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-fg-muted)]"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-[var(--app-fg-muted)] hover:text-[var(--app-fg)]"
              aria-label="clear"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                (filter === f.id
                  ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                  : "border border-[var(--app-border)] bg-transparent text-[var(--app-fg)] hover:bg-[var(--app-surface-2)]")
              }
            >
              {s(f.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats table / empty */}
      {visible.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState
            icon={<Users size={22} />}
            title={isSearching ? s("noMatchTitle") : s("emptyTitle")}
            hint={isSearching ? s("noMatchHint") : s("emptyHint")}
            action={
              !isSearching ? (
                <Button onClick={() => setShowNew(true)}>
                  <Plus size={16} /> {s("newGuest")}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--app-border)] text-left text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
                <th className="px-4 py-2.5 font-medium">{s("cGuest")}</th>
                <th className="px-4 py-2.5 font-medium">{s("cContact")}</th>
                <th className="px-4 py-2.5 text-right font-medium">{s("cVisits")}</th>
                <th className="px-4 py-2.5 text-right font-medium">{s("cNights")}</th>
                <th className="px-4 py-2.5 text-right font-medium">{s("cSpend")}</th>
                <th className="px-4 py-2.5 font-medium">{s("cLastStay")}</th>
                <th className="px-4 py-2.5 font-medium">{s("cStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => {
                const st = stat(g.id);
                const roomNo = st.inHouseRoomId ? roomNumberById[st.inHouseRoomId] : null;
                return (
                  <tr
                    key={g.id}
                    onClick={() => router.push(`/app/guests/${g.id}`)}
                    className="cursor-pointer border-t border-[var(--app-border)] transition-colors first:border-t-0 hover:bg-[var(--app-surface-2)]"
                  >
                    {/* Guest */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--app-accent)] text-xs font-bold text-[var(--app-accent-fg)]">
                          {initials(g.full_name)}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-semibold">
                            {g.full_name || s("unnamed")}
                            {g.is_vip && <Crown size={12} className="text-[#b45309]" />}
                            {g.is_blacklisted && (
                              <Ban size={12} className="text-[var(--app-danger)]" />
                            )}
                          </span>
                          {g.thai_name && (
                            <span className="block text-xs text-[var(--app-fg-muted)]">
                              {g.thai_name}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    {/* Contact */}
                    <td className="px-4 py-3 text-xs text-[var(--app-fg-muted)]">
                      {g.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} /> {g.phone}
                        </span>
                      )}
                      {g.email && (
                        <span className="mt-0.5 flex items-center gap-1">
                          <Mail size={12} /> {g.email}
                        </span>
                      )}
                      {!g.phone && !g.email && s("never")}
                    </td>
                    {/* Visits / Nights / Spend */}
                    <td className="px-4 py-3 text-right tabular-nums">{st.visits}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{st.nights}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {st.spend ? fmtSpend(st.spend, currency) : s("never")}
                    </td>
                    {/* Last stay */}
                    <td className="px-4 py-3 text-[var(--app-fg-muted)]">
                      {st.lastStay ?? s("never")}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {st.inHouseRoomId && (
                          <span className={`${badge} bg-[var(--app-success)]/15 text-[var(--app-success)]`}>
                            {s("inHouse")}
                            {roomNo ? ` · #${roomNo}` : ""}
                          </span>
                        )}
                        {g.is_vip && !st.inHouseRoomId && (
                          <span className={`${badge} bg-[#f59e0b]/15 text-[#b45309]`}>
                            <Star size={10} /> {s("vip")}
                          </span>
                        )}
                        {g.is_blacklisted && (
                          <span className={`${badge} bg-[var(--app-danger)]/15 text-[var(--app-danger)]`}>
                            <Ban size={10} /> {s("blacklist")}
                          </span>
                        )}
                        {!st.inHouseRoomId &&
                          !g.is_vip &&
                          !g.is_blacklisted &&
                          st.visits >= 2 && (
                            <span className={`${badge} bg-[var(--app-accent)]/15 text-[var(--app-accent)]`}>
                              {s("returning")}
                            </span>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick-create modal */}
      {showNew && (
        <NewGuestModal
          s={s}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            router.push(`/app/guests/${id}`);
          }}
          onError={(msg) => toast.error(msg)}
        />
      )}
    </div>
  );
}

// ── New-guest modal ───────────────────────────────────────────────────────
// Minimal — name is enough to create a profile. The detail page covers the
// rest (Thai ID, address, preferences, tags, etc.).
function NewGuestModal({
  s,
  onClose,
  onCreated,
  onError,
}: {
  s: (k: string) => string;
  onClose: () => void;
  onCreated: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    full_name: "",
    thai_name: "",
    phone: "",
    email: "",
    preferences: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const savingRef = useRef(false);

  async function submit() {
    if (savingRef.current) return;
    const name = form.full_name.trim();
    if (!name) return;
    savingRef.current = true;
    setSaving(true);
    const input: GuestInput & { id?: string } = {
      full_name: name,
      thai_name: form.thai_name.trim() || null,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      preferences: form.preferences.trim() || null,
    };
    const res = await saveGuest(input);
    savingRef.current = false;
    setSaving(false);
    if (res.ok) onCreated(res.data.id);
    else onError(`${res.code} · ${res.message}`);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={s("newGuest")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {s("cancel")}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!form.full_name.trim()}>
            {saving ? s("creating") : s("create")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
            {s("name")} *
          </span>
          <input
            autoFocus
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            className={`${field} w-full`}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              {s("thaiName")} {s("optional")}
            </span>
            <input
              value={form.thai_name}
              onChange={(e) => set("thai_name", e.target.value)}
              className={`${field} w-full`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              {s("phone")}
            </span>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className={`${field} w-full`}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
            {s("email")}
          </span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className={`${field} w-full`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
            {s("preferences")} {s("optional")}
          </span>
          <textarea
            rows={3}
            value={form.preferences}
            onChange={(e) => set("preferences", e.target.value)}
            className={`${field} w-full resize-none`}
          />
        </label>
      </div>
    </Modal>
  );
}
