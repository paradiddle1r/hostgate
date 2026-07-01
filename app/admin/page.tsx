import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { channexBaseUrl, channexConfigured } from "@/lib/channex/client";

export const dynamic = "force-dynamic";

async function count(sb: ReturnType<typeof createServiceClient>, table: string, filter?: (q: any) => any): Promise<number> {
  let q: any = sb.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n } = await q;
  return n ?? 0;
}

export default async function AdminOverview() {
  let stats: Record<string, number> = {};
  let dbError: string | null = null;
  try {
    const sb = createServiceClient();
    const [tenants, properties, connections, live, revisions, unapplied, events24h, failedAri] = await Promise.all([
      count(sb, "tenants"),
      count(sb, "properties"),
      count(sb, "channex_connections"),
      count(sb, "channex_connections", (q) => q.in("status", ["provisioned", "live"])),
      count(sb, "channex_booking_revisions"),
      count(sb, "channex_booking_revisions", (q) => q.eq("applied", false)),
      count(sb, "channex_webhook_events", (q) => q.gte("received_at", new Date(Date.now() - 86400000).toISOString())),
      count(sb, "channex_ari_queue", (q) => q.eq("status", "failed")),
    ]);
    stats = { tenants, properties, connections, live, revisions, unapplied, events24h, failedAri };
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const cards: { label: string; value: number; href: string; warn?: boolean }[] = dbError ? [] : [
    { label: "Tenants", value: stats.tenants, href: "/admin/tenants" },
    { label: "Properties", value: stats.properties, href: "/admin/tenants" },
    { label: "Channex connections", value: stats.connections, href: "/admin/channex" },
    { label: "Provisioned / live", value: stats.live, href: "/admin/channex" },
    { label: "Booking revisions", value: stats.revisions, href: "/admin/events" },
    { label: "Revisions not applied", value: stats.unapplied, href: "/admin/events", warn: stats.unapplied > 0 },
    { label: "Webhook events (24h)", value: stats.events24h, href: "/admin/events" },
    { label: "Failed ARI batches", value: stats.failedAri, href: "/admin/channex", warn: stats.failedAri > 0 },
  ];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Channex environment:{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">{channexBaseUrl()}</code>{" "}
            {channexConfigured()
              ? <span className="text-emerald-400">API key set</span>
              : <span className="text-amber-400">CHANNEX_API_KEY not set</span>}
          </p>
        </div>
      </div>

      {dbError ? (
        <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="font-semibold">Service key missing or DB unreachable</div>
          <p className="mt-1 text-amber-200/80">{dbError}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.label} href={c.href}
              className={`rounded-xl border p-4 transition hover:border-zinc-600 ${
                c.warn ? "border-amber-600/50 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/60"}`}>
              <div className={`text-3xl font-semibold ${c.warn ? "text-amber-300" : ""}`}>{c.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-zinc-500">{c.label}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
        <div className="mb-2 font-medium text-zinc-200">Integration status</div>
        <ul className="list-inside list-disc space-y-1">
          <li>Webhook receiver: <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">POST /api/channex/webhook</code> (header <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">x-hostgate-secret</code>)</li>
          <li>Safety-net cron: <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">GET /api/channex/cron</code> (Vercel daily + pg_cron 5 min)</li>
          <li>Booking ingest: revisions feed → apply → <b>acknowledge</b> (certified pattern)</li>
          <li>ARI: batched queue, run-length encoded spans, 500-day full sync</li>
        </ul>
      </div>
    </div>
  );
}
