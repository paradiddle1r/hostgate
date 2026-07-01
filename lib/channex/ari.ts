import "server-only";

// ARI (Availability / Rates / Inventory) engine.
//
// Channex certification rules baked in here:
//   – N changes must leave as ONE call with N values (never per-date loops):
//     enqueue writes rows, flushQueue() groups everything pending for a
//     connection into ≤1 availability call + ≤1 restrictions call.
//   – Ranges: consecutive dates with identical values are run-length encoded
//     into date_from/date_to spans (a 500-day full sync = a handful of spans).
//   – Deltas only; full syncs at most once a day (the admin button / nightly
//     cron calls enqueueFullSync explicitly).
//   – Availability zeroing: booking changes call enqueueAvailability for the
//     affected window, so OTA availability follows the PMS immediately.

import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { pushAvailability, pushRestrictions } from "./client";
import type { ChannexAvailabilityValue, ChannexRestrictionValue } from "./types";

const FULL_SYNC_DAYS = 500; // certification test 1 — 500 days in one call

// ── date helpers (UTC-safe, date-only) ──────────────────────────────────────
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
function today(): string {
  return iso(new Date());
}

/** Run-length encode a per-date series into [from, to, value] spans. */
function spans<V>(dates: string[], valueAt: (date: string) => V): { from: string; to: string; value: V }[] {
  const out: { from: string; to: string; value: V }[] = [];
  for (const d of dates) {
    const v = valueAt(d);
    const last = out[out.length - 1];
    if (last && last.to === addDays(d, -1) && JSON.stringify(last.value) === JSON.stringify(v)) {
      last.to = d;
    } else {
      out.push({ from: d, to: d, value: v });
    }
  }
  return out;
}

interface ConnectionRow {
  id: string;
  tenant_id: string;
  property_id: string;
  channex_property_id: string | null;
  status: string;
}

async function getConnection(sb: SupabaseClient, connectionId: string): Promise<ConnectionRow | null> {
  const { data } = await sb
    .from("channex_connections")
    .select("id, tenant_id, property_id, channex_property_id, status")
    .eq("id", connectionId)
    .maybeSingle();
  return (data as ConnectionRow) ?? null;
}

// ── availability computation ────────────────────────────────────────────────
/**
 * Compute availability per (room_type, date) for [from, from+days):
 *   total = active physical rooms of that type (fallback: room_types.quantity)
 *   booked = non-cancelled bookings of that type overlapping the date
 */
export async function computeAvailability(
  sb: SupabaseClient,
  propertyId: string,
  from: string,
  days: number,
): Promise<Map<string, number[]>> {
  const to = addDays(from, days); // exclusive
  const [{ data: roomTypes }, { data: rooms }, { data: bookings }] = await Promise.all([
    sb.from("room_types").select("id, quantity").eq("property_id", propertyId),
    sb.from("rooms").select("room_type_id").eq("property_id", propertyId).eq("status", "active"),
    sb.from("bookings")
      .select("room_type_id, check_in, check_out")
      .eq("property_id", propertyId)
      .neq("status", "cancelled")
      .lt("check_in", to)
      .gt("check_out", from),
  ]);

  const roomCount = new Map<string, number>();
  for (const r of rooms ?? []) {
    if (!r.room_type_id) continue;
    roomCount.set(r.room_type_id, (roomCount.get(r.room_type_id) ?? 0) + 1);
  }

  const result = new Map<string, number[]>(); // room_type_id → per-day availability
  for (const rt of roomTypes ?? []) {
    const total = roomCount.get(rt.id) ?? rt.quantity ?? 0;
    result.set(rt.id, new Array(days).fill(total));
  }

  for (const b of bookings ?? []) {
    if (!b.room_type_id) continue;
    const arr = result.get(b.room_type_id);
    if (!arr) continue;
    // clamp booking window to [from, to)
    let d = b.check_in < from ? from : b.check_in;
    const end = b.check_out > to ? to : b.check_out;
    for (; d < end; d = addDays(d, 1)) {
      const idx = Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
      if (idx >= 0 && idx < days) arr[idx] = Math.max(0, arr[idx] - 1);
    }
  }
  return result;
}

// ── queueing ────────────────────────────────────────────────────────────────

/** Enqueue availability values for a window (run-length encoded). */
export async function enqueueAvailability(
  connectionId: string,
  from: string,
  days: number,
): Promise<number> {
  const sb = createServiceClient();
  const conn = await getConnection(sb, connectionId);
  if (!conn?.channex_property_id) return 0;

  const [rtMapRes, avail] = await Promise.all([
    sb.from("channex_room_type_map").select("room_type_id, channex_room_type_id").eq("connection_id", connectionId),
    computeAvailability(sb, conn.property_id, from, days),
  ]);
  const rtMap = new Map((rtMapRes.data ?? []).map((m) => [m.room_type_id, m.channex_room_type_id]));

  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const rows: { connection_id: string; kind: string; payload: ChannexAvailabilityValue }[] = [];
  for (const [roomTypeId, perDay] of avail) {
    const chxRoomType = rtMap.get(roomTypeId);
    if (!chxRoomType) continue; // unmapped room type — nothing to push
    for (const s of spans(dates, (d) => perDay[dates.indexOf(d)])) {
      rows.push({
        connection_id: connectionId,
        kind: "availability",
        payload: {
          property_id: conn.channex_property_id,
          room_type_id: chxRoomType,
          date_from: s.from,
          date_to: s.to,
          availability: s.value,
        },
      });
    }
  }
  if (rows.length) await sb.from("channex_ari_queue").insert(rows);
  return rows.length;
}

/** Enqueue rate values (from daily_rates, fallback room_types.daily_rate). */
export async function enqueueRates(
  connectionId: string,
  from: string,
  days: number,
): Promise<number> {
  const sb = createServiceClient();
  const conn = await getConnection(sb, connectionId);
  if (!conn?.channex_property_id) return 0;
  const to = addDays(from, days);

  const [rpMapRes, ratesRes, rtRes] = await Promise.all([
    sb.from("channex_rate_plan_map").select("room_type_id, channex_rate_plan_id").eq("connection_id", connectionId),
    sb.from("daily_rates").select("room_type_id, date, price")
      .eq("property_id", conn.property_id).gte("date", from).lt("date", to),
    sb.from("room_types").select("id, daily_rate").eq("property_id", conn.property_id),
  ]);

  const defaultRate = new Map((rtRes.data ?? []).map((r) => [r.id, r.daily_rate ? Number(r.daily_rate) : null]));
  const priceByRtDate = new Map<string, number>();
  for (const r of ratesRes.data ?? []) {
    priceByRtDate.set(`${r.room_type_id}|${r.date}`, Number(r.price));
  }

  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const rows: { connection_id: string; kind: string; payload: ChannexRestrictionValue }[] = [];
  for (const m of rpMapRes.data ?? []) {
    const fallback = defaultRate.get(m.room_type_id) ?? null;
    const rateAt = (d: string): number | null => priceByRtDate.get(`${m.room_type_id}|${d}`) ?? fallback;
    for (const s of spans(dates, rateAt)) {
      if (s.value == null || s.value <= 0) continue; // Channex rejects rate ≤ 0 — skip unknown dates
      rows.push({
        connection_id: connectionId,
        kind: "restrictions",
        payload: {
          property_id: conn.channex_property_id,
          rate_plan_id: m.channex_rate_plan_id,
          date_from: s.from,
          date_to: s.to,
          rate: String(s.value.toFixed(2)),
        },
      });
    }
  }
  if (rows.length) await sb.from("channex_ari_queue").insert(rows);
  return rows.length;
}

/** Full sync = availability + rates for the next 500 days (cert test 1). */
export async function enqueueFullSync(connectionId: string): Promise<{ availability: number; rates: number }> {
  const from = today();
  const availability = await enqueueAvailability(connectionId, from, FULL_SYNC_DAYS);
  const rates = await enqueueRates(connectionId, from, FULL_SYNC_DAYS);
  return { availability, rates };
}

// ── flushing ────────────────────────────────────────────────────────────────
/**
 * Send everything pending for a connection as ≤1 availability call and
 * ≤1 restrictions call. Later rows for the same target override earlier ones
 * (last-write-wins), matching Channex's own FIFO semantics.
 */
export async function flushQueue(connectionId: string): Promise<{ sent: number; failed: number }> {
  const sb = createServiceClient();
  const { data: pending } = await sb
    .from("channex_ari_queue")
    .select("id, kind, payload")
    .eq("connection_id", connectionId)
    .eq("status", "pending")
    .order("id", { ascending: true })
    .limit(2000);
  if (!pending || pending.length === 0) return { sent: 0, failed: 0 };

  const availability = pending.filter((p) => p.kind === "availability").map((p) => p.payload as ChannexAvailabilityValue);
  const restrictions = pending.filter((p) => p.kind === "restrictions").map((p) => p.payload as ChannexRestrictionValue);
  const ids = pending.map((p) => p.id);

  try {
    if (availability.length) await pushAvailability(availability);
    if (restrictions.length) await pushRestrictions(restrictions);
    await sb.from("channex_ari_queue")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .in("id", ids);
    await sb.from("channex_sync_log").insert({
      connection_id: connectionId, direction: "push", operation: "ari_flush", ok: true,
      detail: { availability: availability.length, restrictions: restrictions.length },
    });
    return { sent: pending.length, failed: 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // failed rows are retried by cron: retryFailed() flips failed→pending with attempts+1 (≤5)
    await sb.from("channex_ari_queue")
      .update({ status: "failed", last_error: msg.slice(0, 500) })
      .in("id", ids);
    await sb.from("channex_sync_log").insert({
      connection_id: connectionId, direction: "push", operation: "ari_flush", ok: false,
      detail: { error: msg.slice(0, 500) },
    });
    return { sent: 0, failed: pending.length };
  }
}

/** Flush every connection that has pending rows (called by cron). */
export async function flushAllQueues(): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("channex_ari_queue")
    .select("connection_id")
    .eq("status", "pending")
    .limit(1000);
  const connIds = Array.from(new Set((data ?? []).map((r) => r.connection_id)));
  let total = 0;
  for (const id of connIds) {
    const { sent } = await flushQueue(id);
    total += sent;
  }
  return total;
}

/** Retry failed rows (bounded attempts), then flush. Called by cron. */
export async function retryFailed(): Promise<void> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("channex_ari_queue")
    .select("id, attempts")
    .eq("status", "failed")
    .lt("attempts", 5)
    .limit(500);
  for (const row of data ?? []) {
    await sb.from("channex_ari_queue")
      .update({ status: "pending", attempts: row.attempts + 1 })
      .eq("id", row.id);
  }
}
