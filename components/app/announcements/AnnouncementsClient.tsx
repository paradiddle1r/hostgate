"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  Info,
  AlertTriangle,
  AlertOctagon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Announcement, AnnouncementSeverity } from "@/lib/db/announcements";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import Modal from "@/components/app/ui/Modal";
import {
  newAnnouncement,
  editAnnouncement,
  removeAnnouncement,
} from "@/app/app/announcements/actions";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "ประกาศ",
    sub: "ปักหมุดข้อความไว้บนแถบด้านบนของทุกหน้า เจ้าของและแอดมินเท่านั้นที่แก้ไขได้",
    add: "เพิ่มประกาศ",
    titleField: "หัวข้อ",
    titlePh: "หัวข้อสั้น ๆ (ไม่บังคับ)",
    body: "เนื้อหา",
    bodyPh: "พิมพ์ข้อความประกาศ…",
    severity: "ระดับความสำคัญ",
    info: "ข้อมูล",
    warning: "คำเตือน",
    critical: "สำคัญมาก",
    pinned: "ปักหมุด",
    pin: "ปักหมุด",
    unpin: "เลิกปักหมุด",
    pinHint: "เฉพาะประกาศที่ปักหมุดจะแสดงบนแถบด้านบน",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    edit: "แก้ไข",
    del: "ลบ",
    delDone: "ลบแล้ว",
    delConfirm: "ลบประกาศนี้?",
    cancel: "ยกเลิก",
    needBody: "ใส่เนื้อหาประกาศ",
    empty: "ยังไม่มีประกาศ",
    emptyHint: "สร้างประกาศแรกเพื่อปักหมุดข้อความไว้บนทุกหน้า",
    addTitle: "ประกาศใหม่",
    editTitle: "แก้ไขประกาศ",
  },
  en: {
    title: "Announcements",
    sub: "Pin a message to the top banner of every page. Owners and admins only.",
    add: "Add announcement",
    titleField: "Title",
    titlePh: "Short headline (optional)",
    body: "Message",
    bodyPh: "Type the announcement message…",
    severity: "Severity",
    info: "Info",
    warning: "Warning",
    critical: "Critical",
    pinned: "Pinned",
    pin: "Pin",
    unpin: "Unpin",
    pinHint: "Only pinned announcements show in the top banner.",
    save: "Save",
    saved: "Saved",
    edit: "Edit",
    del: "Delete",
    delDone: "Deleted",
    delConfirm: "Delete this announcement?",
    cancel: "Cancel",
    needBody: "Enter a message",
    empty: "No announcements yet",
    emptyHint: "Create your first announcement to pin a message across every page.",
    addTitle: "New announcement",
    editTitle: "Edit announcement",
  },
};

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

const SEVERITIES: Array<{
  id: AnnouncementSeverity;
  bg: string;
  fg: string;
  border: string;
}> = [
  { id: "info", bg: "#dbeafe", fg: "#1e3a8a", border: "#93c5fd" },
  { id: "warning", bg: "#fef3c7", fg: "#78350f", border: "#fcd34d" },
  { id: "critical", bg: "#fee2e2", fg: "#7f1d1d", border: "#fca5a5" },
];
const sevCfg = (id: AnnouncementSeverity) =>
  SEVERITIES.find((s) => s.id === id) ?? SEVERITIES[0];

function SevIcon({ id, size = 14 }: { id: AnnouncementSeverity; size?: number }) {
  if (id === "warning") return <AlertTriangle size={size} />;
  if (id === "critical") return <AlertOctagon size={size} />;
  return <Info size={size} />;
}

interface Draft {
  id?: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  is_pinned: boolean;
}

export default function AnnouncementsClient({
  initial,
  canManage,
}: {
  initial: Announcement[];
  canManage: boolean;
}) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  function startNew() {
    setEditing({ title: "", body: "", severity: "info", is_pinned: true });
  }
  function startEdit(a: Announcement) {
    setEditing({
      id: a.id,
      title: a.title,
      body: a.body,
      severity: a.severity,
      is_pinned: a.is_pinned,
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.body.trim()) return toast.error(s("needBody"));
    setSaving(true);
    const input = {
      title: editing.title.trim(),
      body: editing.body.trim(),
      severity: editing.severity,
      is_pinned: editing.is_pinned,
    };
    const res = editing.id
      ? await editAnnouncement(editing.id, input)
      : await newAnnouncement(input);
    setSaving(false);
    if (res.ok) {
      toast.success(s("saved"));
      setEditing(null);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function togglePin(a: Announcement) {
    const res = await editAnnouncement(a.id, { is_pinned: !a.is_pinned });
    if (res.ok) {
      toast.success(s("saved"));
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function del(a: Announcement) {
    const res = await removeAnnouncement(a.id);
    if (res.ok) {
      toast.success(s("delDone"));
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
        {canManage && (
          <Button onClick={startNew} className="flex-none">
            <Plus size={16} /> {s("add")}
          </Button>
        )}
      </div>

      {initial.length === 0 && !editing && (
        <EmptyState
          icon={<Megaphone size={22} />}
          title={s("empty")}
          hint={s("emptyHint")}
          action={
            canManage ? (
              <Button onClick={startNew}>
                <Plus size={16} /> {s("add")}
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="space-y-2">
        {initial.map((a) => {
          const cfg = sevCfg(a.severity);
          return (
            <div
              key={a.id}
              className="app-surface flex items-start gap-3 rounded-2xl border border-[var(--app-border)] p-4"
            >
              <span
                className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg"
                style={{ background: cfg.bg, color: cfg.fg }}
                aria-hidden
              >
                <SevIcon id={a.severity} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {a.title && <span className="font-semibold">{a.title}</span>}
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: cfg.bg, color: cfg.fg }}
                  >
                    <SevIcon id={a.severity} size={11} /> {s(a.severity)}
                  </span>
                  {a.is_pinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_15%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--app-accent)]">
                      <Pin size={11} /> {s("pinned")}
                    </span>
                  )}
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--app-fg)]">
                  {a.body}
                </div>
                <div className="mt-1.5 text-xs text-[var(--app-fg-muted)]">
                  {new Date(a.created_at).toLocaleString(
                    locale === "th" ? "th-TH" : "en-US"
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex flex-none items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => togglePin(a)}
                    aria-label={a.is_pinned ? s("unpin") : s("pin")}
                    title={a.is_pinned ? s("unpin") : s("pin")}
                  >
                    {a.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(a)}
                    aria-label={s("edit")}
                    title={s("edit")}
                  >
                    <Pencil size={14} />
                  </Button>
                  <button
                    onClick={() => {
                      if (window.confirm(s("delConfirm"))) del(a);
                    }}
                    aria-label={s("del")}
                    title={s("del")}
                    className="grid h-8 w-8 place-items-center rounded-lg text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* create / edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? s("editTitle") : s("addTitle")}
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
            <div>
              <label className={labelCls}>{s("titleField")}</label>
              <input
                className={field}
                value={editing.title}
                placeholder={s("titlePh")}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                autoFocus
              />
            </div>

            <div>
              <label className={labelCls}>{s("body")}</label>
              <textarea
                className={`${field} min-h-[96px] resize-y`}
                rows={4}
                maxLength={2000}
                value={editing.body}
                placeholder={s("bodyPh")}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              />
            </div>

            <div>
              <label className={labelCls}>{s("severity")}</label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={s("severity")}>
                {SEVERITIES.map((sev) => {
                  const selected = editing.severity === sev.id;
                  return (
                    <button
                      key={sev.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setEditing({ ...editing, severity: sev.id })}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
                      style={{
                        background: selected ? sev.bg : "transparent",
                        color: selected ? sev.fg : "var(--app-fg)",
                        border: `1px solid ${selected ? sev.border : "var(--app-border)"}`,
                      }}
                    >
                      <SevIcon id={sev.id} size={14} />
                      {s(sev.id)}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={editing.is_pinned}
                onChange={(e) => setEditing({ ...editing, is_pinned: e.target.checked })}
              />
              <span className="text-sm font-medium">{s("pinned")}</span>
              <span className="text-xs text-[var(--app-fg-muted)]">— {s("pinHint")}</span>
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
