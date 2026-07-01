import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

interface TenantRow {
  id: string;
  name: string;
  plan: string;
  created_at: string;
}

export default async function AdminTenants() {
  const sb = createServiceClient();
  const [{ data: tenants }, { data: members }, { data: properties }, { data: connections }] = await Promise.all([
    sb.from("tenants").select("id, name, plan, created_at").order("created_at", { ascending: false }).limit(500),
    sb.from("tenant_members").select("tenant_id"),
    sb.from("properties").select("id, tenant_id, name, code, currency"),
    sb.from("channex_connections").select("property_id, status"),
  ]);

  const memberCount = new Map<string, number>();
  for (const m of members ?? []) memberCount.set(m.tenant_id, (memberCount.get(m.tenant_id) ?? 0) + 1);
  const propsByTenant = new Map<string, { id: string; name: string; code: string | null; currency: string }[]>();
  for (const p of properties ?? []) {
    if (!propsByTenant.has(p.tenant_id)) propsByTenant.set(p.tenant_id, []);
    propsByTenant.get(p.tenant_id)!.push(p);
  }
  const connByProperty = new Map<string, string>();
  for (const c of connections ?? []) connByProperty.set(c.property_id, c.status);

  const planBadge = (plan: string) =>
    plan === "pro" ? "bg-emerald-500/15 text-emerald-300 border-emerald-600/40"
    : plan === "standard" ? "bg-sky-500/15 text-sky-300 border-sky-600/40"
    : "bg-zinc-700/30 text-zinc-300 border-zinc-600/50";

  const chxBadge = (status?: string) =>
    !status ? { cls: "bg-zinc-800 text-zinc-500 border-zinc-700", label: "not connected" }
    : status === "provisioned" || status === "live"
      ? { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-600/40", label: status }
    : status === "error"
      ? { cls: "bg-red-500/15 text-red-300 border-red-600/40", label: "error" }
      : { cls: "bg-amber-500/15 text-amber-300 border-amber-600/40", label: status };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Tenants</h1>
      <p className="mb-6 text-sm text-zinc-400">{(tenants ?? []).length} customer account(s)</p>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Properties</th>
              <th className="px-4 py-3">Channex</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {(tenants ?? []).map((t: TenantRow) => {
              const props = propsByTenant.get(t.id) ?? [];
              return (
                <tr key={t.id} className="bg-zinc-950/40 hover:bg-zinc-900/60">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${planBadge(t.plan)}`}>{t.plan}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{memberCount.get(t.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    {props.length === 0 ? <span className="text-zinc-600">—</span> : (
                      <div className="flex flex-wrap gap-1.5">
                        {props.map((p) => (
                          <span key={p.id} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                            {p.code ? `${p.code} · ` : ""}{p.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {props.length === 0 ? <span className="text-zinc-600">—</span> :
                        props.map((p) => {
                          const b = chxBadge(connByProperty.get(p.id));
                          return <span key={p.id} className={`rounded-full border px-2 py-0.5 text-xs ${b.cls}`}>{b.label}</span>;
                        })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(t.created_at).toISOString().slice(0, 10)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
