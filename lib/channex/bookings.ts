import "server-only";

// Booking ingestion — the certified Channex pattern:
//
//   webhook (ping) ──► processRevisionFeed() ──► store revision
//                                             ├► apply to local bookings
//                                             ├► ACK the revision  (required!)
//                                             └► enqueue availability update
//                                                (availability zeroing)
//
// The feed returns only unacknowledged revisions; unacked ones re-deliver and
// raise `non_acked_booking` warnings after 30 min — so we ack every revision
// we could store, even if applying it to a local booking failed (the error is
// kept on the revision row for the admin console to surface).

import { createServiceClient } from "@/lib/supabase/service";
import { bookingRevisionsFeed, ackBookingRevision } from "./client";
import { enqueueAvailability, flushQueue } from "./ari";
import type { ChannexBookingRevision } from "./types";

interface ApplyOutcome {
  applied: boolean;
  localBookingIds: string[];
  error?: string;
}

function fullName(rev: ChannexBookingRevision): string {
  const c = rev.attributes.customer;
  const name = [c?.name, c?.surname].filter(Boolean).join(" ").trim();
  return name || "OTA guest";
}

function dayDiff(from: string, to: string): number {
  return Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000));
}

/**
 * Apply one revision to local bookings.
 *   new       → insert one local booking per Channex room (room_id null —
 *               staff assign the physical room on the calendar; source 'ota')
 *   modified  → update dates/amount/guest on the linked local bookings
 *   cancelled → set linked local bookings to cancelled
 */
async function applyRevision(rev: ChannexBookingRevision): Promise<ApplyOutcome> {
  const sb = createServiceClient();
  const a = rev.attributes;

  // Which connection does this belong to?
  const { data: conn } = await sb
    .from("channex_connections")
    .select("id, tenant_id, property_id")
    .eq("channex_property_id", a.property_id)
    .maybeSingle();
  if (!conn) return { applied: false, localBookingIds: [], error: "no connection for channex property" };

  const { data: link } = await sb
    .from("channex_bookings")
    .select("channex_booking_id, local_booking_ids")
    .eq("channex_booking_id", a.booking_id)
    .maybeSingle();

  // Reverse room-type mapping (Channex room_type_id → local room_type_id).
  const { data: rtm } = await sb
    .from("channex_room_type_map")
    .select("room_type_id, channex_room_type_id")
    .eq("connection_id", conn.id);
  const reverseRt = new Map((rtm ?? []).map((m) => [m.channex_room_type_id, m.room_type_id]));

  const otaTag = [a.ota_name, a.unique_id].filter(Boolean).join(" · ");

  try {
    if (a.status === "cancelled") {
      const ids = link?.local_booking_ids ?? [];
      if (ids.length) {
        await sb.from("bookings").update({ status: "cancelled" }).in("id", ids);
      }
      await sb.from("channex_bookings").upsert({
        channex_booking_id: a.booking_id,
        connection_id: conn.id,
        unique_id: a.unique_id ?? null,
        ota_name: a.ota_name ?? null,
        status: "cancelled",
        local_booking_ids: ids,
      });
      return { applied: true, localBookingIds: ids };
    }

    if (a.status === "modified" && link?.local_booking_ids?.length) {
      await sb.from("bookings").update({
        guest_name: fullName(rev),
        check_in: a.arrival_date,
        check_out: a.departure_date,
        total_amount: a.amount ? Number(a.amount) : null,
        notes: `Channex ${otaTag} (modified)`,
      }).in("id", link.local_booking_ids);
      await sb.from("channex_bookings").update({ status: "modified" })
        .eq("channex_booking_id", a.booking_id);
      return { applied: true, localBookingIds: link.local_booking_ids };
    }

    // status === "new" (or modified-without-link → treat as new)
    const rooms = a.rooms?.length ? a.rooms : [{ room_type_id: null, rate_plan_id: null }];
    const created: string[] = [];
    for (const room of rooms) {
      const localRoomType = room.room_type_id ? reverseRt.get(room.room_type_id) ?? null : null;
      const checkIn = room.checkin_date ?? a.arrival_date!;
      const checkOut = room.checkout_date ?? a.departure_date!;
      const amount = room.amount ? Number(room.amount)
        : a.amount ? Number(a.amount) / rooms.length : null;
      const { data: inserted, error } = await sb.from("bookings").insert({
        tenant_id: conn.tenant_id,
        property_id: conn.property_id,
        room_id: null,                       // staff assign the physical room
        room_type_id: localRoomType,         // null = unmapped (flagged in admin)
        guest_name: fullName(rev),
        phone: a.customer?.phone ?? null,
        check_in: checkIn,
        check_out: checkOut,
        status: "confirmed",
        source: "ota",
        adults: room.occupancy?.adults ?? 1,
        children: room.occupancy?.children ?? 0,
        total_amount: amount,
        notes: `Channex ${otaTag}${localRoomType ? "" : " — UNMAPPED room type"}`,
      }).select("id").single();
      if (error) throw error;
      created.push(inserted.id);
    }

    await sb.from("channex_bookings").upsert({
      channex_booking_id: a.booking_id,
      connection_id: conn.id,
      unique_id: a.unique_id ?? null,
      ota_name: a.ota_name ?? null,
      status: a.status,
      local_booking_ids: created,
    });

    // Availability zeroing — push the new occupancy picture for the stay window.
    if (a.arrival_date && a.departure_date) {
      await enqueueAvailability(conn.id, a.arrival_date, dayDiff(a.arrival_date, a.departure_date));
      await flushQueue(conn.id);
    }
    return { applied: true, localBookingIds: created };
  } catch (e) {
    return { applied: false, localBookingIds: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Pull the unacknowledged-revisions feed, store + apply + ACK each.
 * Safe to call concurrently / repeatedly (revision id is the PK; reprocessing
 * an already-stored revision is skipped).
 */
export async function processRevisionFeed(): Promise<{ processed: number; failed: number }> {
  const sb = createServiceClient();
  const feed = await bookingRevisionsFeed();
  let processed = 0, failed = 0;

  for (const rev of feed) {
    const a = rev.attributes;
    // Store first (idempotent by PK) — never lose a revision.
    const { data: existing } = await sb
      .from("channex_booking_revisions").select("id, acked_at").eq("id", rev.id).maybeSingle();

    const { data: conn } = await sb
      .from("channex_connections").select("id")
      .eq("channex_property_id", a.property_id).maybeSingle();

    if (!existing) {
      await sb.from("channex_booking_revisions").insert({
        id: rev.id,
        connection_id: conn?.id ?? null,
        channex_booking_id: a.booking_id,
        channex_property_id: a.property_id,
        status: a.status,
        ota_name: a.ota_name ?? null,
        payload: rev as unknown as Record<string, unknown>,
      });
    }

    const outcome = await applyRevision(rev);

    // ACK regardless of apply success — the revision is durably stored here;
    // leaving it unacked would only trigger redelivery + warning spam. Apply
    // errors stay visible on the row for the admin console.
    try {
      await ackBookingRevision(rev.id);
      await sb.from("channex_booking_revisions").update({
        acked_at: new Date().toISOString(),
        applied: outcome.applied,
        applied_at: outcome.applied ? new Date().toISOString() : null,
        error: outcome.error ?? null,
      }).eq("id", rev.id);
      outcome.applied ? processed++ : failed++;
    } catch (e) {
      failed++;
      await sb.from("channex_booking_revisions").update({
        error: `ack failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500),
      }).eq("id", rev.id);
    }

    await sb.from("channex_sync_log").insert({
      connection_id: conn?.id ?? null,
      direction: "pull",
      operation: `revision_${a.status}`,
      ok: outcome.applied,
      detail: { revision: rev.id, booking: a.booking_id, ota: a.ota_name, error: outcome.error },
    });
  }
  return { processed, failed };
}
