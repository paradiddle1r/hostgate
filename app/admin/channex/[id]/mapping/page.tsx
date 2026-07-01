import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { getPlatformAdmin } from "@/lib/admin";
import { oneTimeToken, mappingIframeUrl } from "@/lib/channex/client";

// Channel-mapping iframe — Channex's white-label UI embedded in the admin
// console. One-time token (15-min TTL) is minted server-side per render;
// once the iframe loads, the session survives.

export const dynamic = "force-dynamic";

export default async function MappingPage({ params }: { params: { id: string } }) {
  const admin = await getPlatformAdmin();
  const sb = createServiceClient();
  const { data: conn } = await sb
    .from("channex_connections")
    .select("id, channex_property_id, status, property_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!conn?.channex_property_id) {
    return (
      <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-4 text-sm text-amber-200">
        Connection not provisioned yet — provision it first, then manage channels here.
      </div>
    );
  }

  const { data: property } = await sb
    .from("properties").select("name, code").eq("id", conn.property_id).maybeSingle();

  let iframeSrc: string | null = null;
  let error: string | null = null;
  try {
    const token = await oneTimeToken(conn.channex_property_id, admin?.email ?? "hostgate-admin");
    iframeSrc = mappingIframeUrl(token, conn.channex_property_id);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/admin/channex" className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft size={14} /> Connections
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          Channels — {property?.code ? `${property.code} · ` : ""}{property?.name}
        </h1>
      </div>
      {error ? (
        <div className="rounded-xl border border-red-600/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : (
        <iframe
          src={iframeSrc!}
          className="h-[calc(100vh-180px)] w-full rounded-xl border border-zinc-800 bg-white"
          title="Channex channel mapping"
        />
      )}
    </div>
  );
}
