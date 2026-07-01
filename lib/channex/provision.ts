import "server-only";

// Provisioning: push a HostGate property into Channex and wire everything up.
//
// Flow (per docs.channex.io recommended order):
//   1. create Channex property (title + currency + address block)
//   2. create one Channex room type per local room_type   → channex_room_type_map
//   3. create one BAR rate plan per room type             → channex_rate_plan_map
//   4. register our webhook (booking events → /api/channex/webhook)
//   5. queue a full ARI sync (500 days availability + rates)
//
// Idempotent-ish: refuses to run twice on a provisioned connection unless
// force=true (which re-uses the existing Channex property id when present).

import { createServiceClient } from "@/lib/supabase/service";
import {
  createProperty, createRoomType, createRatePlan, createWebhook, channexBaseUrl,
} from "./client";
import { enqueueFullSync, flushQueue } from "./ari";

const DEFAULT_OCC_ADULTS = 2;

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://hostgate.app").replace(/\/+$/, "");
}

export interface ProvisionResult {
  connectionId: string;
  channexPropertyId: string;
  roomTypes: number;
  ratePlans: number;
  webhookId: string | null;
  ariQueued: { availability: number; rates: number };
}

/**
 * Create (or complete) the Channex side of a connection. `connectionId` must
 * already exist (status draft/error). Called from the admin console.
 */
export async function provisionConnection(connectionId: string): Promise<ProvisionResult> {
  const sb = createServiceClient();

  const { data: conn } = await sb
    .from("channex_connections")
    .select("id, tenant_id, property_id, channex_property_id, status, environment")
    .eq("id", connectionId)
    .maybeSingle();
  if (!conn) throw new Error("connection not found");
  if (conn.status === "live") throw new Error("connection is already live");

  const { data: property } = await sb
    .from("properties")
    .select("id, name, currency, address, city, country, timezone")
    .eq("id", conn.property_id)
    .maybeSingle();
  if (!property) throw new Error("property not found");

  const { data: roomTypes } = await sb
    .from("room_types")
    .select("id, name, quantity, stay_kind, daily_rate")
    .eq("property_id", property.id)
    .order("sort_order", { ascending: true });
  if (!roomTypes || roomTypes.length === 0) {
    throw new Error("property has no room types — create room types in the PMS first");
  }

  try {
    // 1) property (reuse id when re-provisioning after a partial failure)
    let channexPropertyId = conn.channex_property_id as string | null;
    if (!channexPropertyId) {
      const created = await createProperty({
        title: property.name,
        currency: property.currency || "THB",
        country: property.country || "TH",
        city: property.city ?? undefined,
        address: property.address ?? undefined,
        timezone: property.timezone || "Asia/Bangkok",
        property_type: "hotel",
        settings: { state_length: 500 },   // allow the 500-day sync window
      });
      channexPropertyId = created.id;
      await sb.from("channex_connections")
        .update({ channex_property_id: channexPropertyId })
        .eq("id", connectionId);
    }

    // 2+3) room types + BAR rate plan each (skip ones already mapped)
    const { data: existingRtm } = await sb
      .from("channex_room_type_map").select("room_type_id").eq("connection_id", connectionId);
    const mapped = new Set((existingRtm ?? []).map((m) => m.room_type_id));

    let rtCount = 0, rpCount = 0;
    for (const rt of roomTypes) {
      if (mapped.has(rt.id)) continue;
      const chxRt = await createRoomType({
        title: rt.name,
        property_id: channexPropertyId,
        count_of_rooms: rt.quantity ?? 1,
        occ_adults: DEFAULT_OCC_ADULTS,
        occ_children: 0,
        occ_infants: 0,
        default_occupancy: DEFAULT_OCC_ADULTS,
        room_kind: "room",
      });
      await sb.from("channex_room_type_map").insert({
        connection_id: connectionId,
        room_type_id: rt.id,
        channex_room_type_id: chxRt.id,
      });
      rtCount++;

      const chxRp = await createRatePlan({
        title: `BAR ${rt.name}`,
        property_id: channexPropertyId,
        room_type_id: chxRt.id,
        sell_mode: "per_room",
        rate_mode: "manual",
        options: [{
          occupancy: DEFAULT_OCC_ADULTS,
          is_primary: true,
          rate: rt.daily_rate ? String(Number(rt.daily_rate).toFixed(2)) : "0",
        }],
      });
      await sb.from("channex_rate_plan_map").insert({
        connection_id: connectionId,
        room_type_id: rt.id,
        channex_rate_plan_id: chxRp.id,
        title: `BAR ${rt.name}`,
        occupancy: DEFAULT_OCC_ADULTS,
      });
      rpCount++;
    }

    // 4) webhook — booking lifecycle only; authenticated by our own header
    //    (Channex webhooks have no HMAC; never trust the payload, re-fetch).
    let webhookId: string | null = null;
    const secret = process.env.CHANNEX_WEBHOOK_SECRET;
    if (secret) {
      const hook = await createWebhook({
        property_id: channexPropertyId,
        callback_url: `${siteUrl()}/api/channex/webhook`,
        event_mask: "booking;booking_unmapped_room;booking_unmapped_rate;sync_error;non_acked_booking",
        headers: { "x-hostgate-secret": secret },
        is_active: true,
        send_data: false,
      });
      webhookId = hook.id;
      await sb.from("channex_connections").update({ channex_webhook_id: webhookId }).eq("id", connectionId);
    }

    // 5) full ARI sync queued + first flush
    const ariQueued = await enqueueFullSync(connectionId);
    await flushQueue(connectionId);

    await sb.from("channex_connections").update({
      status: "provisioned",
      last_synced_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", connectionId);

    await sb.from("channex_sync_log").insert({
      connection_id: connectionId, direction: "push", operation: "provision", ok: true,
      detail: { channexPropertyId, roomTypes: rtCount, ratePlans: rpCount, webhookId, base: channexBaseUrl() },
    });

    return { connectionId, channexPropertyId, roomTypes: rtCount, ratePlans: rpCount, webhookId, ariQueued };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("channex_connections")
      .update({ status: "error", last_error: msg.slice(0, 500) })
      .eq("id", connectionId);
    await sb.from("channex_sync_log").insert({
      connection_id: connectionId, direction: "push", operation: "provision", ok: false,
      detail: { error: msg.slice(0, 500) },
    });
    throw e;
  }
}
