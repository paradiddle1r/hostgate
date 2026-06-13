import { getActiveProperty } from "@/lib/active-property-server";
import { createClient } from "@/lib/supabase/server";
import { listTenantMembers } from "@/lib/db/operations";
import type { ActivityEntry } from "@/lib/db/admin";
import ActivityClient from "@/components/app/admin/ActivityClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Known action prefixes (text before the first "."). Kept in sync with the
// chip palette in ActivityClient. Used to drive the server-side prefix filter
// (`action like 'prefix.%'`) — pagination means we can't derive the set from a
// single page of rows anymore, so the list is static.
const KNOWN_PREFIXES = ["member", "sale", "booking", "invoice"];

function intParam(v: string | string[] | undefined, fallback: number): number {
  const n = Array.isArray(v) ? Number(v[0]) : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function strParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const { tenant } = active.data;

  const sp = (await searchParams) ?? {};
  const page = intParam(sp.page, 0);
  const prefix = strParam(sp.prefix);
  const actor = strParam(sp.actor);
  const q = strParam(sp.q);

  // Members for the actor dropdown + actor_id → name/role resolution.
  const membersRes = await listTenantMembers(tenant.id);
  const members = membersRes.ok ? membersRes.data : [];

  // Server-side, tenant-scoped, filtered + paginated read. Inline query (lib/db
  // is off-limits and only exposes an unfiltered limit-200 list). Filters are
  // applied BEFORE .range() with count:'exact' so `total` reflects the filtered
  // set, not the whole table.
  const supabase = createClient();
  let query = supabase
    .from("activity_log")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenant.id);

  if (prefix && KNOWN_PREFIXES.includes(prefix)) {
    query = query.like("action", `${prefix}.%`);
  }
  if (actor) {
    query = query.eq("actor_id", actor);
  }
  if (q) {
    // Match the human-readable summary, the raw action, or the entity label.
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(
      `summary.ilike.%${safe}%,action.ilike.%${safe}%,entity.ilike.%${safe}%`,
    );
  }

  const from = page * PAGE_SIZE;
  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  return (
    <ActivityClient
      entries={(data ?? []) as ActivityEntry[]}
      members={members}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      prefix={prefix}
      actor={actor}
      q={q}
      prefixes={KNOWN_PREFIXES}
    />
  );
}
