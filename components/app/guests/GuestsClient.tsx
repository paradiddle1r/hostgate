"use client";

import { useEffect, useRef, useState } from "react";
import { Users, Search, Plus, Phone, Mail, Globe } from "lucide-react";
import type { Guest, GuestInput } from "@/lib/db/guests";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import Modal from "@/components/app/ui/Modal";
import EmptyState from "@/components/app/ui/EmptyState";
import { saveGuest, searchGuestsAction } from "@/app/app/guests/actions";

// Local bilingual strings, keyed off useI18n().locale — same shape lib/app-i18n.ts uses.
const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "แขก",
    searchPlaceholder: "ค้นหาด้วยชื่อ หรือเบอร์โทร…",
    newGuest: "เพิ่มแขก",
    name: "ชื่อ-นามสกุล",
    phone: "เบอร์โทรศัพท์",
    email: "อีเมล",
    idNumber: "เลขบัตรประชาชน / พาสปอร์ต",
    nationality: "สัญชาติ",
    notes: "บันทึก",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    cancel: "ยกเลิก",
    edit: "แก้ไขแขก",
    emptyTitle: "ยังไม่มีแขก",
    emptyHint: "เพิ่มแขกคนแรกเพื่อเริ่มเก็บข้อมูลลูกค้า",
    noMatchTitle: "ไม่พบแขก",
    noMatchHint: "ลองค้นหาด้วยชื่อหรือเบอร์โทรอื่น",
  },
  en: {
    title: "Guests",
    searchPlaceholder: "Search by name or phone…",
    newGuest: "New guest",
    name: "Full name",
    phone: "Phone",
    email: "Email",
    idNumber: "ID / passport number",
    nationality: "Nationality",
    notes: "Notes",
    save: "Save",
    saved: "Saved",
    cancel: "Cancel",
    edit: "Edit guest",
    emptyTitle: "No guests yet",
    emptyHint: "Add your first guest to start building your CRM.",
    noMatchTitle: "No guests found",
    noMatchHint: "Try a different name or phone number.",
  },
};

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

type FormState = {
  id?: string;
  full_name: string;
  phone: string;
  email: string;
  id_number: string;
  nationality: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  full_name: "",
  phone: "",
  email: "",
  id_number: "",
  nationality: "",
  notes: "",
};

function toForm(g: Guest): FormState {
  return {
    id: g.id,
    full_name: g.full_name,
    phone: g.phone ?? "",
    email: g.email ?? "",
    id_number: g.id_number ?? "",
    nationality: g.nationality ?? "",
    notes: g.notes ?? "",
  };
}

export default function GuestsClient({ initialGuests }: { initialGuests: Guest[] }) {
  const { locale } = useI18n();
  const s = (k: string) => STR[locale][k] ?? k;
  const toast = useToast();

  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  // Track the latest query so a slow response can't clobber a newer one.
  const queryRef = useRef("");
  queryRef.current = query;

  // Re-run the current search and replace the list.
  async function runSearch(q: string) {
    const res = await searchGuestsAction(q);
    // Drop stale responses.
    if (queryRef.current !== q) return;
    if (res.ok) setGuests(res.data);
    else toast.error(`${res.code} · ${res.message}`);
  }

  // Debounced search on query change (~300ms). Skip the very first render so we
  // keep the server-provided initial list.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const handle = setTimeout(() => {
      runSearch(query);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function openNew() {
    setEditing({ ...EMPTY_FORM });
  }
  function openEdit(g: Guest) {
    setEditing(toForm(g));
  }
  function closeModal() {
    setEditing(null);
  }

  function patchForm(patch: Partial<FormState>) {
    setEditing((cur) => (cur ? { ...cur, ...patch } : cur));
  }

  async function submit() {
    if (!editing) return;
    const name = editing.full_name.trim();
    if (!name) return;

    const input: GuestInput & { id?: string } = {
      id: editing.id,
      full_name: name,
      phone: editing.phone.trim() || undefined,
      email: editing.email.trim() || undefined,
      id_number: editing.id_number.trim() || undefined,
      nationality: editing.nationality.trim() || undefined,
      notes: editing.notes.trim() || undefined,
    };

    setSaving(true);
    const res = await saveGuest(input);
    setSaving(false);

    if (res.ok) {
      toast.success(s("saved"));
      closeModal();
      runSearch(queryRef.current);
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const isSearching = query.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
        <span className="text-sm text-[var(--app-fg-muted)]">{guests.length}</span>
        <Button className="ml-auto" onClick={openNew}>
          <Plus size={16} /> {s("newGuest")}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
        <Search size={16} className="shrink-0 text-[var(--app-fg-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={s("searchPlaceholder")}
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-fg-muted)]"
        />
      </div>

      {/* List / empty */}
      {guests.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState
            icon={<Users size={22} />}
            title={isSearching ? s("noMatchTitle") : s("emptyTitle")}
            hint={isSearching ? s("noMatchHint") : s("emptyHint")}
            action={
              !isSearching ? (
                <Button onClick={openNew}>
                  <Plus size={16} /> {s("newGuest")}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
          <ul>
            {guests.map((g) => (
              <li
                key={g.id}
                onClick={() => openEdit(g)}
                className="cursor-pointer border-t border-[var(--app-border)] px-4 py-3 transition-colors first:border-t-0 hover:bg-[var(--app-surface-2)]"
              >
                <div className="font-semibold">{g.full_name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--app-fg-muted)]">
                  {g.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} /> {g.phone}
                    </span>
                  )}
                  {g.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} /> {g.email}
                    </span>
                  )}
                  {g.nationality && (
                    <span className="inline-flex items-center gap-1">
                      <Globe size={12} /> {g.nationality}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add / edit modal */}
      <Modal
        open={editing !== null}
        onClose={closeModal}
        title={editing?.id ? s("edit") : s("newGuest")}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>
              {s("cancel")}
            </Button>
            <Button onClick={submit} loading={saving} disabled={!editing?.full_name.trim()}>
              {s("save")}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s("name")}</span>
              <input
                autoFocus
                value={editing.full_name}
                onChange={(e) => patchForm({ full_name: e.target.value })}
                className={`${field} w-full`}
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s("phone")}</span>
                <input
                  value={editing.phone}
                  onChange={(e) => patchForm({ phone: e.target.value })}
                  className={`${field} w-full`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s("email")}</span>
                <input
                  type="email"
                  value={editing.email}
                  onChange={(e) => patchForm({ email: e.target.value })}
                  className={`${field} w-full`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s("idNumber")}</span>
                <input
                  value={editing.id_number}
                  onChange={(e) => patchForm({ id_number: e.target.value })}
                  className={`${field} w-full`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s("nationality")}</span>
                <input
                  value={editing.nationality}
                  onChange={(e) => patchForm({ nationality: e.target.value })}
                  className={`${field} w-full`}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{s("notes")}</span>
              <textarea
                rows={3}
                value={editing.notes}
                onChange={(e) => patchForm({ notes: e.target.value })}
                className={`${field} w-full resize-none`}
              />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
