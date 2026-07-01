import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Live log: raw webhook events + booking revisions (the ingest inbox) +
// recent sync operations. Read-only; newest first.

export default async function AdminEvents() {
  const sb = createServiceClient();
  const [{ data: events }, { data: revisions }, { data: syncs }] = await Promise.all([
    sb.from("channex_webhook_events")
      .select("id, event, channex_property_id, processed, error, received_at")
      .order("received_at", { ascending: false }).limit(50),
    sb.from("channex_booking_revisions")
      .select("id, channex_booking_id, status, ota_name, acked_at, applied, error, received_at")
      .order("received_at", { ascending: false }).limit(50),
    sb.from("channex_sync_log")
      .select("id, direction, operation, ok, detail, created_at")
      .order("created_at", { ascending: false }).limit(50),
  ]);

  const ts = (s: string) => s.slice(0, 19).replace("T", " ");

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Booking revisions (inbox)</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2.5">Received</th><th className="px-4 py-2.5">Booking</th>
                <th className="px-4 py-2.5">OTA</th><th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Acked</th><th className="px-4 py-2.5">Applied</th>
                <th className="px-4 py-2.5">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {(revisions ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-500">No revisions yet.</td></tr>
              )}
              {(revisions ?? []).map((r) => (
                <tr key={r.id} className="bg-zinc-950/40">
                  <td className="px-4 py-2.5 text-zinc-500">{ts(r.received_at)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.channex_booking_id}</td>
                  <td className="px-4 py-2.5">{r.ota_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${
                      r.status === "cancelled" ? "border-red-600/40 bg-red-500/15 text-red-300"
                      : r.status === "modified" ? "border-amber-600/40 bg-amber-500/15 text-amber-300"
                      : "border-emerald-600/40 bg-emerald-500/15 text-emerald-300"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2.5">{r.acked_at ? "✓" : <span className="text-amber-400">pending</span>}</td>
                  <td className="px-4 py-2.5">{r.applied ? "✓" : <span className="text-amber-400">no</span>}</td>
                  <td className="max-w-64 truncate px-4 py-2.5 text-xs text-red-400" title={r.error ?? ""}>{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Webhook events</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2.5">Received</th><th className="px-4 py-2.5">Event</th>
                <th className="px-4 py-2.5">Channex property</th><th className="px-4 py-2.5">Processed</th>
                <th className="px-4 py-2.5">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {(events ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-500">No webhook events yet.</td></tr>
              )}
              {(events ?? []).map((e) => (
                <tr key={e.id} className="bg-zinc-950/40">
                  <td className="px-4 py-2.5 text-zinc-500">{ts(e.received_at)}</td>
                  <td className="px-4 py-2.5"><code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">{e.event}</code></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{e.channex_property_id ?? "—"}</td>
                  <td className="px-4 py-2.5">{e.processed ? "✓" : <span className="text-amber-400">no</span>}</td>
                  <td className="max-w-64 truncate px-4 py-2.5 text-xs text-red-400" title={e.error ?? ""}>{e.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Sync log</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2.5">Time</th><th className="px-4 py-2.5">Dir</th>
                <th className="px-4 py-2.5">Operation</th><th className="px-4 py-2.5">OK</th>
                <th className="px-4 py-2.5">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {(syncs ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-500">No sync operations yet.</td></tr>
              )}
              {(syncs ?? []).map((s) => (
                <tr key={s.id} className="bg-zinc-950/40">
                  <td className="px-4 py-2.5 text-zinc-500">{ts(s.created_at)}</td>
                  <td className="px-4 py-2.5">{s.direction === "push" ? "→" : "←"} {s.direction}</td>
                  <td className="px-4 py-2.5">{s.operation}</td>
                  <td className="px-4 py-2.5">{s.ok ? "✓" : <span className="text-red-400">✗</span>}</td>
                  <td className="max-w-96 truncate px-4 py-2.5 font-mono text-xs text-zinc-500"
                      title={JSON.stringify(s.detail)}>{JSON.stringify(s.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
