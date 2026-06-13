"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StickyNote, X, Plus, ExternalLink, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Note } from "@/lib/db/notes";
import { getNotesForWidget, newNote } from "@/app/app/notes/actions";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    title: "โน้ต",
    hide: "ซ่อน",
    open: "เปิดหน้าโน้ต",
    quickPh: "เพิ่มโน้ตด่วน…",
    add: "เพิ่ม",
    empty: "ไม่มีโน้ตที่ค้างอยู่",
    emptyHint: "โน้ตใหม่จากทีมจะมาแสดงที่นี่",
    moreLink: "ดูทั้งหมด",
  },
  en: {
    title: "Notes",
    hide: "Hide",
    open: "Open notes page",
    quickPh: "Quick add a note…",
    add: "Add",
    empty: "No active notes",
    emptyHint: "New notes from the team show up here.",
    moreLink: "View all",
  },
};

// Mirror NotesClient's named-color tints for the edge accent on each row.
const EDGE: Record<string, string> = {
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  pink: "#ec4899",
  purple: "#8b5cf6",
  orange: "#f97316",
};

/**
 * Floating team-notes launcher, pinned bottom-right on every app page.
 * AppShell mounts <NotesWidget /> with no props; the widget self-fetches via
 * the getNotesForWidget() server action on mount (and after a quick-add, since
 * router.refresh won't touch this component's own fetched state).
 */
export default function NotesWidget() {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;

  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quick, setQuick] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    const res = await getNotesForWidget();
    if (res.ok) setNotes(res.data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = notes.filter((n) => !n.done);
  const latest = active.slice(0, 4);

  async function add() {
    const body = quick.trim();
    if (!body) return;
    setAdding(true);
    const res = await newNote({ body, color: "yellow" });
    setAdding(false);
    if (res.ok) {
      setQuick("");
      void refresh();
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="app-surface pointer-events-auto w-[min(92vw,20rem)] overflow-hidden rounded-2xl border border-[var(--app-border)] shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--app-border)] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--app-fg-muted)]">
              {active.length === 0 ? s("empty") : `${active.length} · ${s("title")}`}
            </span>
            <div className="flex items-center gap-1">
              <Link
                href="/app/notes"
                title={s("open")}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)]"
              >
                <ExternalLink size={12} /> {s("moreLink")}
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label={s("hide")}
                className="grid h-7 w-7 place-items-center rounded-lg text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-fg)]"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="max-h-[48vh] overflow-y-auto px-3 py-2">
            {latest.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-[var(--app-fg-muted)]">
                {s("emptyHint")}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {latest.map((n) => (
                  <li
                    key={n.id}
                    className="flex gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-2)] p-2"
                  >
                    <span
                      className="mt-0.5 w-1 flex-none rounded-full"
                      style={{ background: EDGE[n.color] ?? EDGE.yellow }}
                    />
                    <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs leading-snug text-[var(--app-fg)]">
                      {n.body.trim() || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-[var(--app-border)] px-3 py-2.5">
            <input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void add();
              }}
              placeholder={s("quickPh")}
              className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--app-accent)]"
            />
            <button
              onClick={add}
              disabled={!quick.trim() || adding}
              aria-label={s("add")}
              className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[var(--app-accent)] text-[var(--app-accent-fg)] transition hover:brightness-110 disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={s("title")}
        className="app-surface pointer-events-auto relative inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] px-4 py-2.5 text-sm font-semibold text-[var(--app-fg)] shadow-xl transition hover:bg-[var(--app-surface-2)]"
      >
        <StickyNote size={16} />
        <span>{s("title")}</span>
        {active.length > 0 && (
          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--app-accent)] px-1.5 text-[11px] font-bold text-[var(--app-accent-fg)]">
            {active.length}
          </span>
        )}
        <ChevronDown
          size={14}
          className="transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
    </div>
  );
}
