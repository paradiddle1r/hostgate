"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Cable, ExternalLink, Play, RefreshCw, Zap } from "lucide-react";
import {
  createConnectionAction, provisionAction, fullSyncAction,
  processFeedAction, testConnectionAction,
} from "./actions";

export interface ConnectionView {
  id: string;
  environment: string;
  status: string;
  channex_property_id: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  property: { id: string; name: string; code: string | null };
  tenant: { id: string; name: string };
  roomTypesMapped: number;
  pendingAri: number;
}

export interface UnconnectedProperty {
  id: string;
  name: string;
  code: string | null;
  tenant_name: string;
}

const STATUS_CLS: Record<string, string> = {
  draft: "bg-zinc-700/30 text-zinc-300 border-zinc-600/50",
  provisioned: "bg-emerald-500/15 text-emerald-300 border-emerald-600/40",
  live: "bg-emerald-500/15 text-emerald-300 border-emerald-600/40",
  error: "bg-red-500/15 text-red-300 border-red-600/40",
  disabled: "bg-zinc-800 text-zinc-500 border-zinc-700",
};

export default function ChannexClient({ connections, unconnected }: {
  connections: ConnectionView[];
  unconnected: UnconnectedProperty[];
}) {
  const [busy, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; data?: unknown }>, label: string) =>
    startTransition(async () => {
      setNote(`${label}…`);
      const r = await fn();
      setNote(r.ok ? `${label}: OK ${r.data ? JSON.stringify(r.data).slice(0, 160) : ""}` : `${label} failed: ${r.message}`);
    });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => run(() => testConnectionAction(), "Test Channex API")}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:border-zinc-500 disabled:opacity-50">
          <Zap size={14} /> Test Channex API
        </button>
        <button
          onClick={() => run(() => processFeedAction(), "Process booking feed")}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:border-zinc-500 disabled:opacity-50">
          <RefreshCw size={14} /> Process booking feed
        </button>
        {note && <span className="ml-2 max-w-xl truncate text-xs text-zinc-400">{note}</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Env</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Channex ID</th>
              <th className="px-4 py-3">Mapped</th>
              <th className="px-4 py-3">Last sync</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {connections.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                No connections yet — connect a property below.
              </td></tr>
            )}
            {connections.map((c) => (
              <tr key={c.id} className="bg-zinc-950/40 hover:bg-zinc-900/60">
                <td className="px-4 py-3 font-medium">{c.property.code ? `${c.property.code} · ` : ""}{c.property.name}</td>
                <td className="px-4 py-3 text-zinc-400">{c.tenant.name}</td>
                <td className="px-4 py-3"><span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">{c.environment}</span></td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_CLS[c.status] ?? STATUS_CLS.draft}`}>{c.status}</span>
                  {c.last_error && <div className="mt-1 max-w-56 truncate text-xs text-red-400" title={c.last_error}>{c.last_error}</div>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{c.channex_property_id ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-400">
                  {c.roomTypesMapped} rt{c.pendingAri > 0 && <span className="ml-2 text-amber-400">{c.pendingAri} ARI pending</span>}
                </td>
                <td className="px-4 py-3 text-zinc-500">{c.last_synced_at ? c.last_synced_at.slice(0, 16).replace("T", " ") : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(c.status === "draft" || c.status === "error") && (
                      <button onClick={() => run(() => provisionAction(c.id), "Provision")}
                        disabled={busy}
                        className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                        <Play size={12} /> Provision
                      </button>
                    )}
                    {(c.status === "provisioned" || c.status === "live") && (
                      <>
                        <button onClick={() => run(() => fullSyncAction(c.id), "Full sync")}
                          disabled={busy}
                          className="flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1 text-xs hover:border-zinc-500 disabled:opacity-50">
                          <RefreshCw size={12} /> Full sync
                        </button>
                        <Link href={`/admin/channex/${c.id}/mapping`}
                          className="flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1 text-xs hover:border-zinc-500">
                          <ExternalLink size={12} /> Channels
                        </Link>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unconnected.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Not yet connected</h2>
          <div className="flex flex-wrap gap-2">
            {unconnected.map((p) => (
              <button key={p.id}
                onClick={() => run(() => createConnectionAction(p.id), `Connect ${p.name}`)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-emerald-600 hover:text-emerald-300 disabled:opacity-50">
                <Cable size={14} /> {p.code ? `${p.code} · ` : ""}{p.name}
                <span className="text-xs text-zinc-500">({p.tenant_name})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
