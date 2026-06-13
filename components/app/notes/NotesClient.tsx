"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Plus, Pin, PinOff, Check, RotateCcw, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Note } from "@/lib/db/notes";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import EmptyState from "@/components/app/ui/EmptyState";
import { newNote, editNote, removeNote } from "@/app/app/notes/actions";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "โน้ตทีม",
    sub: "กระดานโน้ตที่ทุกคนในทีมเห็นร่วมกัน — ปักหมุดเรื่องสำคัญ ทำเครื่องหมายเสร็จ",
    add: "เพิ่มโน้ต",
    composerPh: "เขียนโน้ตใหม่…",
    notePh: "เขียนโน้ต…",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    added: "เพิ่มโน้ตแล้ว",
    del: "ลบ",
    delDone: "ลบแล้ว",
    pin: "ปักหมุด",
    unpin: "เลิกปักหมุด",
    markDone: "ทำเครื่องหมายเสร็จ",
    markActive: "กลับมาทำต่อ",
    pinned: "ปักหมุด",
    done: "เสร็จแล้ว",
    color: "สี",
    all: "ทั้งหมด",
    active: "ที่ค้างอยู่",
    doneFilter: "เสร็จแล้ว",
    empty: "ยังไม่มีโน้ต",
    emptyHint: "เพิ่มโน้ตแรกของทีม — เตือนความจำ งานที่ต้องทำ หรือข้อความถึงกะถัดไป",
    emptyDone: "ยังไม่มีโน้ตที่เสร็จ",
    emptyActive: "ไม่มีโน้ตที่ค้างอยู่ — เคลียร์หมดแล้ว",
  },
  en: {
    title: "Team notes",
    sub: "A shared sticky-note board everyone on the team can see — pin what matters, check off what's done.",
    add: "Add note",
    composerPh: "Write a new note…",
    notePh: "Write a note…",
    save: "Save",
    saved: "Saved",
    added: "Note added",
    del: "Delete",
    delDone: "Deleted",
    pin: "Pin",
    unpin: "Unpin",
    markDone: "Mark done",
    markActive: "Reopen",
    pinned: "Pinned",
    done: "Done",
    color: "Color",
    all: "All",
    active: "Active",
    doneFilter: "Done",
    empty: "No notes yet",
    emptyHint: "Add the team's first note — a reminder, a to-do, or a message for the next shift.",
    emptyDone: "No completed notes yet",
    emptyActive: "No active notes — all clear.",
  },
};

// Named colors (DB default is 'yellow') → tinted card background + accent edge.
// Kept token-friendly: solid pastel tints that read on every theme.
const COLORS: Record<string, { bg: string; edge: string }> = {
  yellow: { bg: "#fef9c3", edge: "#eab308" },
  green: { bg: "#dcfce7", edge: "#22c55e" },
  blue: { bg: "#dbeafe", edge: "#3b82f6" },
  pink: { bg: "#fce7f3", edge: "#ec4899" },
  purple: { bg: "#ede9fe", edge: "#8b5cf6" },
  orange: { bg: "#ffedd5", edge: "#f97316" },
};
const COLOR_NAMES = Object.keys(COLORS);
const colorOf = (name: string) => COLORS[name] ?? COLORS.yellow;

const SAVE_DEBOUNCE_MS = 600;
type Filter = "all" | "active" | "done";

export default function NotesClient({ initialNotes }: { initialNotes: Note[] }) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>("active");
  const [composer, setComposer] = useState("");
  const [composerColor, setComposerColor] = useState<string>("yellow");
  const [adding, setAdding] = useState(false);

  // Local text overrides for the note currently being edited, so the textarea
  // stays smooth while a debounced save round-trips. Render still reads from the
  // initialNotes prop (refreshed on mutation) for everything else.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      for (const id of Object.keys(timers)) clearTimeout(timers[id]);
    };
  }, []);

  const notes = useMemo(() => {
    if (filter === "active") return initialNotes.filter((n) => !n.done);
    if (filter === "done") return initialNotes.filter((n) => n.done);
    return initialNotes;
  }, [initialNotes, filter]);

  async function add() {
    const body = composer.trim();
    if (!body) return;
    setAdding(true);
    const res = await newNote({ body, color: composerColor });
    setAdding(false);
    if (res.ok) {
      setComposer("");
      toast.success(s("added"));
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  function onBodyChange(n: Note, value: string) {
    setDrafts((d) => ({ ...d, [n.id]: value }));
    clearTimeout(saveTimers.current[n.id]);
    saveTimers.current[n.id] = setTimeout(() => void persistBody(n.id, value), SAVE_DEBOUNCE_MS);
  }

  async function persistBody(id: string, value: string) {
    const res = await editNote(id, { body: value });
    if (res.ok) {
      setDrafts((d) => {
        const { [id]: _gone, ...rest } = d;
        return rest;
      });
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function flushBody(n: Note) {
    if (!(n.id in drafts)) return;
    clearTimeout(saveTimers.current[n.id]);
    await persistBody(n.id, drafts[n.id]);
  }

  async function toggle(n: Note, patch: Partial<Note>) {
    const res = await editNote(n.id, patch);
    if (res.ok) router.refresh();
    else toast.error(`${res.code} · ${res.message}`);
  }

  async function setColor(n: Note, color: string) {
    const res = await editNote(n.id, { color });
    if (res.ok) router.refresh();
    else toast.error(`${res.code} · ${res.message}`);
  }

  async function del(n: Note) {
    const res = await removeNote(n.id);
    if (res.ok) {
      toast.success(s("delDone"));
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "active", label: s("active") },
    { key: "all", label: s("all") },
    { key: "done", label: s("doneFilter") },
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
          <p className="text-sm text-[var(--app-fg-muted)]">{s("sub")}</p>
        </div>
        <div className="flex flex-none gap-1 rounded-xl border border-[var(--app-border)] p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors " +
                (filter === f.key
                  ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                  : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="app-surface mb-5 rounded-2xl border border-[var(--app-border)] p-3">
        <textarea
          rows={2}
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          placeholder={s("composerPh")}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[var(--app-fg-muted)]"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void add();
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {COLOR_NAMES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setComposerColor(c)}
                aria-label={c}
                className="h-6 w-6 rounded-full border"
                style={{
                  background: COLORS[c].bg,
                  borderColor: COLORS[c].edge,
                  outline: composerColor === c ? "2px solid var(--app-fg)" : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
          <Button size="sm" onClick={add} loading={adding} disabled={!composer.trim()}>
            <Plus size={15} /> {s("add")}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={<StickyNote size={22} />}
          title={
            filter === "done" ? s("emptyDone") : filter === "active" ? s("emptyActive") : s("empty")
          }
          hint={filter === "all" ? s("emptyHint") : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => {
            const sw = colorOf(n.color);
            const value = n.id in drafts ? drafts[n.id] : n.body;
            return (
              <div
                key={n.id}
                className="flex flex-col rounded-2xl border p-3 shadow-sm"
                style={{ background: sw.bg, borderColor: sw.edge, color: "#1c1917" }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {n.pinned && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: sw.edge, color: "#fff" }}
                      >
                        <Pin size={9} /> {s("pinned")}
                      </span>
                    )}
                    {n.done && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold text-black/60">
                        <Check size={9} /> {s("done")}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => del(n)}
                    aria-label={s("del")}
                    title={s("del")}
                    className="grid h-7 w-7 place-items-center rounded-lg text-black/40 hover:bg-black/10 hover:text-black/70"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={value}
                  placeholder={s("notePh")}
                  onChange={(e) => onBodyChange(n, e.target.value)}
                  onBlur={() => flushBody(n)}
                  className="w-full flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-black/40"
                  style={{ textDecoration: n.done ? "line-through" : "none", opacity: n.done ? 0.65 : 1 }}
                />

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/10 pt-2">
                  <div className="flex items-center gap-1">
                    {COLOR_NAMES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(n, c)}
                        aria-label={c}
                        className="h-4 w-4 rounded-full border"
                        style={{
                          background: COLORS[c].bg,
                          borderColor: COLORS[c].edge,
                          outline: n.color === c ? "1.5px solid #1c1917" : "none",
                          outlineOffset: 1,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggle(n, { pinned: !n.pinned })}
                      aria-label={n.pinned ? s("unpin") : s("pin")}
                      title={n.pinned ? s("unpin") : s("pin")}
                      className="grid h-7 w-7 place-items-center rounded-lg text-black/50 hover:bg-black/10 hover:text-black/80"
                    >
                      {n.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                    </button>
                    <button
                      onClick={() => toggle(n, { done: !n.done })}
                      aria-label={n.done ? s("markActive") : s("markDone")}
                      title={n.done ? s("markActive") : s("markDone")}
                      className="grid h-7 w-7 place-items-center rounded-lg text-black/50 hover:bg-black/10 hover:text-black/80"
                    >
                      {n.done ? <RotateCcw size={14} /> : <Check size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
