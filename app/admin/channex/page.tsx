import { createServiceClient } from "@/lib/supabase/service";
import { channexBaseUrl } from "@/lib/channex/client";
import ChannexClient, { ConnectionView, UnconnectedProperty } from "./ChannexClient";

export const dynamic = "force-dynamic";

export default async function AdminChannex() {
  const sb = createServiceClient();
  const [{ data: conns }, { data: props }, { data: tenants }, { data: rtm }, { data: pendingAri }] = await Promise.all([
    sb.from("channex_connections")
      .select("id, tenant_id, property_id, environment, status, channex_property_id, last_synced_at, last_error")
      .order("created_at", { ascending: false }),
    sb.from("properties").select("id, tenant_id, name, code"),
    sb.from("tenants").select("id, name"),
    sb.from("channex_room_type_map").select("connection_id"),
    sb.from("channex_ari_queue").select("connection_id").eq("status", "pending"),
  ]);

  const propById = new Map((props ?? []).map((p) => [p.id, p]));
  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));
  const rtCount = new Map<string, number>();
  for (const m of rtm ?? []) rtCount.set(m.connection_id, (rtCount.get(m.connection_id) ?? 0) + 1);
  const pendingCount = new Map<string, number>();
  for (const q of pendingAri ?? []) pendingCount.set(q.connection_id, (pendingCount.get(q.connection_id) ?? 0) + 1);

  const connections: ConnectionView[] = (conns ?? []).map((c) => ({
    id: c.id,
    environment: c.environment,
    status: c.status,
    channex_property_id: c.channex_property_id,
    last_synced_at: c.last_synced_at,
    last_error: c.last_error,
    property: {
      id: c.property_id,
      name: propById.get(c.property_id)?.name ?? "?",
      code: propById.get(c.property_id)?.code ?? null,
    },
    tenant: { id: c.tenant_id, name: tenantById.get(c.tenant_id)?.name ?? "?" },
    roomTypesMapped: rtCount.get(c.id) ?? 0,
    pendingAri: pendingCount.get(c.id) ?? 0,
  }));

  const connectedPropIds = new Set((conns ?? []).map((c) => c.property_id));
  const unconnected: UnconnectedProperty[] = (props ?? [])
    .filter((p) => !connectedPropIds.has(p.id))
    .map((p) => ({
      id: p.id, name: p.name, code: p.code ?? null,
      tenant_name: tenantById.get(p.tenant_id)?.name ?? "?",
    }));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Channex connections</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Environment: <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">{channexBaseUrl()}</code>
      </p>
      <ChannexClient connections={connections} unconnected={unconnected} />
    </div>
  );
}
