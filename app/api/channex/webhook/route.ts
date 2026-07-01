import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { processRevisionFeed } from "@/lib/channex/bookings";
import type { ChannexWebhookDelivery } from "@/lib/channex/types";

// Channex webhook receiver.
//
// Channex webhooks are UNSIGNED (no HMAC) — we authenticate with our own
// shared-secret header (x-hostgate-secret, registered on the webhook at
// provision time) and treat the payload as a trigger only: booking data is
// re-fetched through the booking-revisions feed, never trusted from here.
//
// Always answer 200 fast (Channex retries 5xx with backoff for ~24h);
// the heavy lifting happens after the event row is safely stored.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BOOKING_EVENTS = new Set([
  "booking", "booking_new", "booking_modification", "booking_cancellation",
  "non_acked_booking",
]);

export async function POST(req: NextRequest) {
  const secret = process.env.CHANNEX_WEBHOOK_SECRET;
  const given = req.headers.get("x-hostgate-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: ChannexWebhookDelivery | null = null;
  try { body = await req.json(); } catch { /* keep null */ }
  const event = body?.event ?? "unknown";

  const sb = createServiceClient();
  const { data: row } = await sb.from("channex_webhook_events").insert({
    event,
    channex_property_id: body?.property_id ?? null,
    payload: (body as unknown as Record<string, unknown>) ?? null,
  }).select("id").single();

  let processed = 0, failed = 0, error: string | null = null;
  if (BOOKING_EVENTS.has(event)) {
    try {
      const r = await processRevisionFeed();
      processed = r.processed; failed = r.failed;
    } catch (e) {
      error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    }
  }

  if (row?.id) {
    await sb.from("channex_webhook_events")
      .update({ processed: error === null, error })
      .eq("id", row.id);
  }
  return NextResponse.json({ ok: true, event, processed, failed });
}
