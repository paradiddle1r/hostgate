"use server";

// Admin-console server actions for the Channex integration. Every action
// re-checks the platform-admin gate (never trust the client), then uses the
// service client — these operate across tenants by design.

import { revalidatePath } from "next/cache";
import { getPlatformAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { provisionConnection } from "@/lib/channex/provision";
import { enqueueFullSync, flushQueue } from "@/lib/channex/ari";
import { processRevisionFeed } from "@/lib/channex/bookings";
import { healthCheck } from "@/lib/channex/client";

type R<T = unknown> = { ok: true; data?: T } | { ok: false; message: string };

async function gate(): Promise<string | null> {
  const admin = await getPlatformAdmin();
  return admin ? null : "not a platform admin";
}

export async function createConnectionAction(propertyId: string): Promise<R> {
  const denied = await gate(); if (denied) return { ok: false, message: denied };
  try {
    const sb = createServiceClient();
    const { data: prop } = await sb.from("properties").select("id, tenant_id").eq("id", propertyId).maybeSingle();
    if (!prop) return { ok: false, message: "property not found" };
    const environment = (process.env.CHANNEX_BASE_URL ?? "").includes("app.channex.io") ? "production" : "staging";
    const { error } = await sb.from("channex_connections").insert({
      tenant_id: prop.tenant_id, property_id: prop.id, environment,
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/channex");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function provisionAction(connectionId: string): Promise<R> {
  const denied = await gate(); if (denied) return { ok: false, message: denied };
  try {
    const result = await provisionConnection(connectionId);
    revalidatePath("/admin/channex");
    return { ok: true, data: result };
  } catch (e) {
    revalidatePath("/admin/channex");
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function fullSyncAction(connectionId: string): Promise<R> {
  const denied = await gate(); if (denied) return { ok: false, message: denied };
  try {
    const queued = await enqueueFullSync(connectionId);
    const flushed = await flushQueue(connectionId);
    const sb = createServiceClient();
    await sb.from("channex_connections")
      .update({ last_synced_at: new Date().toISOString() }).eq("id", connectionId);
    revalidatePath("/admin/channex");
    return { ok: true, data: { queued, flushed } };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function processFeedAction(): Promise<R> {
  const denied = await gate(); if (denied) return { ok: false, message: denied };
  try {
    const result = await processRevisionFeed();
    revalidatePath("/admin/channex");
    revalidatePath("/admin/events");
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function testConnectionAction(): Promise<R<{ properties: number }>> {
  const denied = await gate(); if (denied) return { ok: false, message: denied };
  const health = await healthCheck();
  return health.ok
    ? { ok: true, data: { properties: health.properties } }
    : { ok: false, message: health.error ?? "health check failed" };
}
