"use client";

// Read-only tenant audit trail. Server-side paginated: the page loader applies
// the prefix / actor / search filters and slices one PAGE_SIZE window (newest
// first) with an exact count. This component drives all of that through the URL
// (router.push) so the server re-runs the filtered query — search is debounced
// so each keystroke isn't a navigation. The visible summary column prefers the
// stored `summary`, falling back to a composed line from the detail payload.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Activity,
  Users,
  ShoppingCart,
  CalendarDays,
  Receipt,
  ChevronLeft,
  ChevronRight,
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
    search: "ค้นหา สรุป / การกระทำ / รายการ",
    all: "ทั้งหมด",
    allActors: "ทุกผู้ใช้",
    system: "ระบบ",
    empty: "ยังไม่มีบันทึกกิจกรรม",
    emptyHint: "กิจกรรมจะปรากฏที่นี่เมื่อมีการเปลี่ยนแปลง",
    noMatch: "ไม่พบรายการที่ตรงกัน",
    noMatchHint: "ลองปรับคำค้นหรือตัวกรอง",
    newer: "ใหม่กว่า",
    older: "เก่ากว่า",
    page: "หน้า",
  },
  en: {
    title: "Activity",
    count: "entries",
    search: "Search summary / action / entity",
    all: "All",
    allActors: "All users",
    system: "System",
    empty: "No activity yet",
    emptyHint: "Activity will appear here as changes are made.",
    noMatch: "No matching entries",
    noMatchHint: "Try adjusting your search or filter.",
    newer: "Newer",
    older: "Older",
    page: "Page",
  },
} as const;

// Pretty role label for the muted actor sub-line.
const ROLE_STR: Record<string, { th: string; en: string }> = {
  owner: { th: "เจ้าของ", en: "Owner" },
  admin: { th: "ผู้ดูแล", en: "Admin" },
  staff: { th: "พนักงาน", en: "Staff" },
};

export default function ActivityClient({
  entries,
  members,
  total,
  page,
  pageSize,
  prefix,
  actor,
  q: qInitial,
  prefixes,
}: {
  entries: ActivityEntry[];
  members: TenantMember[];
  total: number;
  page: number;
  pageSize: number;
  prefix: string;
  actor: string;
  q: string;
  prefixes: string[];
}) {
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "th";
  const tr = STR[lang];
  const router = useRouter();

  // Local search box state, debounced into the URL so each keystroke isn't a
  // navigation. Seeded from the server-resolved value.
  const [q, setQ] = useState(qInitial);
  useEffect(() => {
    setQ(qInitial);
  }, [qInitial]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (q === qInitial) return;
    const id = setTimeout(() => {
      navigate({ q, page: 0 });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Build a fresh query string from the current server state + overrides, then
  // push it. Any filter change resets to page 0 (callers pass page:0).
  function navigate(next: Partial<{ prefix: string; actor: string; q: string; page: number }>) {
    const merged = {
      prefix: next.prefix ?? prefix,
      actor: next.actor ?? actor,
      q: next.q ?? q,
      page: next.page ?? page,
    };
    const params = new URLSearchParams();
    if (merged.prefix) params.set("prefix", merged.prefix);
    if (merged.actor) params.set("actor", merged.actor);
    if (merged.q) params.set("q", merged.q);
    if (merged.page > 0) params.set("page", String(merged.page));
    const qs = params.toString();
    router.push(qs ? `/app/activity?${qs}` : "/app/activity");
  }

  // actor_id → display name (falls back to email local-part, then "System").
  const memberById = useMemo(() => {
    const m = new Map<string, TenantMember>();
    for (const x of members) m.set(x.user_id, x);
    return m;
  }, [members]);

  function actorName(actorId: string | null): string {
    if (!actorId) return tr.system;
    const m = memberById.get(actorId);
    if (!m) return tr.system;
    if (m.display_name && m.display_name.trim()) return m.display_name;
    if (m.email && m.email.includes("@")) return m.email.split("@")[0];
    if (m.email) return m.email;
    return tr.system;
  }

  // Role label for a row: prefer the stored actor_role (snapshot at write
  // time), else the member's current role.
  function actorRoleLabel(e: ActivityEntry): string | null {
    const raw = (e.actor_role || memberById.get(e.actor_id ?? "")?.role || "").toLowerCase();
    if (!raw) return null;
    return ROLE_STR[raw]?.[lang] ?? raw;
  }

  // Human-readable summary: stored `summary` wins; else compose from detail.
  function summaryLine(e: ActivityEntry): string {
    if (e.summary && e.summary.trim()) return e.summary.trim();
    return detailLine(e.detail);
  }

  const detailLine = (detail: Record<string, unknown> | null): string => {
    if (!detail || typeof detail !== "object") return "";
    return Object.entries(detail)
      .map(([k, v]) => `${k}: ${formatVal(v)}`)
      .join(" · ");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <span className="text-sm text-[var(--app-fg-muted)]">
          {total.toLocaleString()} {tr.count}
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

        {/* Actor dropdown — filters by actor_id (the log has no actor_email). */}
        <select
          value={actor}
          onChange={(e) => navigate({ actor: e.target.value, page: 0 })}
          className={field}
        >
          <option value="">{tr.allActors}</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {actorName(m.user_id)}
            </option>
          ))}
        </select>

        {/* Action-prefix chips. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip
            label={tr.all}
            active={prefix === ""}
            color="var(--app-fg-muted)"
            onClick={() => navigate({ prefix: "", page: 0 })}
          />
          {prefixes.map((p) => (
            <Chip
              key={p}
              label={p}
              active={prefix === p}
              color={colorFor(p)}
              onClick={() => navigate({ prefix: p, page: 0 })}
            />
          ))}
        </div>
      </div>

      {/* List */}
      {entries.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState
            icon={<Activity size={22} />}
            title={total === 0 && !q && !prefix && !actor ? tr.empty : tr.noMatch}
            hint={
              total === 0 && !q && !prefix && !actor ? tr.emptyHint : tr.noMatchHint
            }
          />
        </div>
      ) : (
        <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
          <ul className="divide-y divide-[var(--app-border)]">
            {entries.map((e) => {
              const p = prefixOf(e.action);
              const color = colorFor(p);
              const summary = summaryLine(e);
              const role = actorRoleLabel(e);
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
                      {role && (
                        <span className="text-xs text-[var(--app-fg-muted)]">
                          · {role}
                        </span>
                      )}
                      {e.entity != null && (
                        <span className="min-w-0 truncate text-xs text-[var(--app-fg-muted)]">
                          {e.entity}
                          {e.entity_id != null && (
                            <span className="opacity-70"> #{e.entity_id}</span>
                          )}
                        </span>
                      )}
                    </div>
                    {summary && (
                      <p className="mt-1 truncate text-xs text-[var(--app-fg-muted)]">
                        {summary}
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

      {/* Pagination footer */}
      {total > pageSize && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate({ page: Math.max(0, page - 1) })}
            disabled={page === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-fg)] transition-colors hover:bg-[var(--app-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} /> {tr.newer}
          </button>
          <span className="text-xs text-[var(--app-fg-muted)]">
            {tr.page} {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => navigate({ page: page + 1 < totalPages ? page + 1 : page })}
            disabled={page + 1 >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-fg)] transition-colors hover:bg-[var(--app-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tr.older} <ChevronRight size={14} />
          </button>
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
