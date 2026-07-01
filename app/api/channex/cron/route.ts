import { NextRequest, NextResponse } from "next/server";
import { processRevisionFeed } from "@/lib/channex/bookings";
import { flushAllQueues, retryFailed } from "@/lib/channex/ari";

// Channex safety-net cron:
//   – poll the booking-revisions feed (webhooks can drop; the feed is the
//     source of truth, so this catches anything missed)
//   – retry failed ARI queue rows, then flush all pending queues
//
// Triggered two ways:
//   1. Vercel cron (vercel.json) — daily on the Hobby plan.
//   2. Supabase pg_cron + pg_net every 5 minutes (the real driver; see
//      docs/channex/ONBOARDING.md).
// Auth: Vercel cron sends Authorization: Bearer ${CRON_SECRET} automatically;
// pg_cron sends the same header explicitly.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const out: Record<string, unknown> = {};
  try {
    out.feed = await processRevisionFeed();
  } catch (e) {
    out.feedError = (e instanceof Error ? e.message : String(e)).slice(0, 300);
  }
  try {
    await retryFailed();
    out.ariFlushed = await flushAllQueues();
  } catch (e) {
    out.ariError = (e instanceof Error ? e.message : String(e)).slice(0, 300);
  }
  return NextResponse.json({ ok: true, ...out });
}
