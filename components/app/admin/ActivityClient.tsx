"use client";

// Read-only tenant audit trail. Data arrives once via server props (capped at
// 200 rows server-side, newest-first). Search (action / entity / entity_id)
// and action-prefix chips run in-memory — no server actions here.

import { useMemo, useState } from "react";
import {
  Search,
  Activity,
  Users,
  ShoppingCart,
  CalendarDays,
  Receipt,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ActivityEntry } from "@/lib/db/admin";
import type { TenantMember } from "@/lib/db/operations";
import { useI18n } from "@/lib/i18n";
import EmptyState from "@/components/app/ui/EmptyState";

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

// The action prefix (text before the first ".") drives the chip colour + icon.
const PREFIX_COLOR: Record<string, string> = {
  member: "#2563eb",
  sale: "var(--app-success)",
  booking: "var(--app-accent)",
  invoice: "#7c3aed",
};

const PREFIX_ICON: Record<string, ReactNode> = {
  member: <Users size={14} />,
  sale: <ShoppingCart size={14} />,
  booking: <CalendarDays size={14} />,
  invoice: <Receipt size={14} />,
};

function prefixOf(action: string): string {
  const i = action.indexOf(".");
  return i === -1 ? action : action.slice(0, i);
}

function colorFor(prefix: string): string {
  return PREFIX_COLOR[prefix] ?? "var(--app-fg-muted)";
}

function iconFor(prefix: string): ReactNode {
  return PREFIX_ICON[prefix] ?? <Activity size={14} />;
}

const STR = {
  th: {
    title: "บันทึกกิจกรรม",
    count: "รายการ",
    search: "ค้นหา การกระทำ / รายการ / รหัส",
    all: "ทั้งหมด",
    system: "ระบบ",
    empty: "ยังไม่มีบันทึกกิจกรรม",
    emptyHint: "กิจกรรมจะปรากฏที่นี่เมื่อมีการเปลี่ยนแปลง",
    noMatch: "ไม่พบรายการที่ตรงกัน",
    noMatchHint: "ลองปรับคำค้นหรือตัวกรอง",
  },
  en: {
    title: "Activity",
    count: "entries",
    search: "Search action / entity / id",
    all: "All",
    system: "System",
    empty: "No activity yet",
    emptyHint: "Activity will appear here as changes are made.",
    noMatch: "No matching entries",
    noMatchHint: "Try adjusting your search or filter.",
  },
} as const;

export default function ActivityClient({
  entries,
  members,
}: {
  entries: ActivityEntry[];
  members: TenantMember[];
}) {
  const { locale } = useI18n();
  const tr = STR[locale === "en" ? "en" : "th"];

  const [q, setQ] = useState("");
  const [prefix, setPrefix] = useState<string>("all");

  // actor_id → display name. Falls back to the email local-part, then "System".
  const actorName = useMemo(() => {
    const byId = new Map<string, TenantMember>();
    for (const m of members) byId.set(m.user_id, m);
    return (actorId: string | null): string => {
      if (!actorId) return tr.system;
      const m = byId.get(actorId);
      if (!m) return tr.system;
      if (m.display_name && m.display_name.trim()) return m.display_name;
      if (m.email && m.email.includes("@")) return m.email.split("@")[0];
      if (m.email) return m.email;
      return tr.system;
    };
  }, [members, tr.system]);

  // Distinct action prefixes present, for the filter chips.
  const prefixes = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(prefixOf(e.action));
    return Array.from(set).sort();
  }, [entries]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (prefix !== "all" && prefixOf(e.action) !== prefix) return false;
      if (!needle) return true;
      return (
        e.action.toLowerCase().includes(needle) ||
        (e.entity ?? "").toLowerCase().includes(needle) ||
        (e.entity_id ?? "").toLowerCase().includes(needle)
      );
    });
  }, [entries, q, prefix]);

  // One-line render of the detail object (skips null / non-object payloads).
  const detailLine = (detail: Record<string, unknown> | null): string => {
    if (!detail || typeof detail !== "object") return "";
    return Object.entries(detail)
      .map(([k, v]) => `${k}: ${formatVal(v)}`)
      .join(" · ");
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <span className="text-sm text-[var(--app-fg-muted)]">
          {rows.length} {tr.count}
        </span>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-fg-muted)]"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr.search}
            className={`${field} w-full pl-8`}
          />
        </div>
        {prefixes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip
              label={tr.all}
              active={prefix === "all"}
              color="var(--app-fg-muted)"
              onClick={() => setPrefix("all")}
            />
            {prefixes.map((p) => (
              <Chip
                key={p}
                label={p}
                active={prefix === p}
                color={colorFor(p)}
                onClick={() => setPrefix(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState
            icon={<Activity size={22} />}
            title={entries.length === 0 ? tr.empty : tr.noMatch}
            hint={entries.length === 0 ? tr.emptyHint : tr.noMatchHint}
          />
        </div>
      ) : (
        <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
          <ul className="divide-y divide-[var(--app-border)]">
            {rows.map((e) => {
              const p = prefixOf(e.action);
              const color = colorFor(p);
              const detail = detailLine(e.detail);
              return (
                <li
                  key={e.id}
                  className="flex items-start gap-3 px-4 py-3 text-sm"
                >
                  <span
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full"
                    style={{ background: color, color: "#fff" }}
                  >
                    {iconFor(p)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ background: color }}
                      >
                        {e.action}
                      </span>
                      <span className="font-medium">{actorName(e.actor_id)}</span>
                      {e.entity != null && (
                        <span className="min-w-0 truncate text-xs text-[var(--app-fg-muted)]">
                          {e.entity}
                          {e.entity_id != null && (
                            <span className="opacity-70"> #{e.entity_id}</span>
                          )}
                        </span>
                      )}
                    </div>
                    {detail && (
                      <p className="mt-1 truncate text-xs text-[var(--app-fg-muted)]">
                        {detail}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs text-[var(--app-fg-muted)]">
                    {new Date(e.created_at).toLocaleString(
                      locale === "en" ? "en-US" : "th-TH",
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-transparent text-white"
          : "border-[var(--app-border)] text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
      }`}
      style={active ? { background: color } : undefined}
    >
      {!active && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
        />
      )}
      {label}
    </button>
  );
}

// Render a single detail value compactly. Objects/arrays are JSON-stringified
// (short), everything else coerced to string.
function formatVal(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
