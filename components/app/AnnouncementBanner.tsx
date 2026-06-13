"use client";

// Sticky top banner showing the active property's pinned announcements.
// Self-fetches via the getPinnedForBanner() server action on mount (no client
// supabase reads — security model keeps data access server-side). Each
// announcement can be dismissed for the current browser session (sessionStorage,
// keyed by id), so it stays gone until the tab is closed. Renders nothing when
// there's nothing pinned or everything's been dismissed. Lightweight by design.

import { useEffect, useState } from "react";
import { Info, AlertTriangle, AlertOctagon, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Announcement, AnnouncementSeverity } from "@/lib/db/announcements";
import { getPinnedForBanner } from "@/app/app/announcements/actions";

const SEVERITY: Record<
  AnnouncementSeverity,
  { bg: string; fg: string; border: string }
> = {
  info: { bg: "#dbeafe", fg: "#1e3a8a", border: "#93c5fd" },
  warning: { bg: "#fef3c7", fg: "#78350f", border: "#fcd34d" },
  critical: { bg: "#fee2e2", fg: "#7f1d1d", border: "#fca5a5" },
};

const SESSION_KEY = "hg_dismissed_announcements";

function SevIcon({ id }: { id: AnnouncementSeverity }) {
  if (id === "warning") return <AlertTriangle size={16} />;
  if (id === "critical") return <AlertOctagon size={16} />;
  return <Info size={16} />;
}

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export default function AnnouncementBanner() {
  const { locale } = useI18n();
  const dismissLabel = locale === "en" ? "Dismiss" : "ปิด";

  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(readDismissed());
    let active = true;
    getPinnedForBanner()
      .then((res) => {
        if (active && res.ok) setItems(res.data);
      })
      .catch(() => {
        /* never break the layout — just show no banner */
      });
    return () => {
      active = false;
    };
  }, []);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(next)));
      } catch {
        /* sessionStorage unavailable — dismiss is just in-memory */
      }
      return next;
    });
  }

  const visible = items.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="sticky top-0 z-20 flex flex-col">
      {visible.map((a) => {
        const sev = SEVERITY[a.severity] ?? SEVERITY.info;
        return (
          <div
            key={a.id}
            role="status"
            className="flex items-start gap-2.5 px-4 py-2.5 text-sm"
            style={{
              background: sev.bg,
              color: sev.fg,
              borderBottom: `1px solid ${sev.border}`,
            }}
          >
            <span className="mt-0.5 flex-none">
              <SevIcon id={a.severity} />
            </span>
            <div className="min-w-0 flex-1 leading-snug">
              {a.title && <span className="font-semibold">{a.title} · </span>}
              <span className="whitespace-pre-wrap break-words">{a.body}</span>
            </div>
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              aria-label={dismissLabel}
              title={dismissLabel}
              className="-mr-1 -mt-0.5 flex-none rounded-md p-1 transition-opacity hover:opacity-70"
              style={{ color: sev.fg }}
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
