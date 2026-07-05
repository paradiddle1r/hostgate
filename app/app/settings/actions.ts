"use server";

// Server actions for OTA calendar IMPORT — the reverse of the read-only
// export feed at app/ical/[propertyCode]/[roomTypeId]/route.ts. A property
// admin pastes an external OTA (Booking.com/Airbnb/Agoda) .ics feed URL for
// one room type; we fetch + parse it server-side and auto-block those dates
// on the internal calendar so the direct-booking widget can't double-sell
// the room type while it's held on an OTA.

import { revalidatePath } from "next/cache";
import dns from "node:dns/promises";
import { isIP } from "node:net";
import { createClient } from "@/lib/supabase/server";
import { ActionResult, ok, fail, mapPgError } from "@/lib/errors";
import { getActiveProperty } from "@/lib/active-property-server";
import { createBooking } from "@/lib/db/bookings";
import { parseICS } from "@/lib/ical-import";

// ── SSRF guard for the user-supplied OTA .ics URL ──────────────────────────
// This URL is admin-supplied but the server does the fetching, so it's a
// textbook SSRF target (cloud metadata endpoints, internal admin panels,
// other tenants' infra). We resolve the hostname ourselves and refuse to
// fetch anything that resolves to a private / loopback / link-local /
// reserved address — checking EVERY resolved A/AAAA record, not just the
// first, so a multi-answer DNS response can't sneak a private IP past us.
// Residual risk: this is resolve-then-fetch, not resolve-then-connect-to-that-
// exact-IP, so a DNS-rebinding attacker who flips the record between our
// check and fetch()'s own resolution could still slip through — closing that
// fully would need a custom low-level connect (pinning the checked IP while
// keeping the original Host header), which is out of scope for this pass.

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true; // fail closed
  const [a, b, c] = parts;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true; // 6to4 relay anycast
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast (224-239) + reserved (240-255) + broadcast
  return false;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  if (addr.startsWith("fe80:") || addr.startsWith("fec0:")) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true; // unique local, fc00::/7
  const v4mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped IPv6
  if (v4mapped) return isPrivateOrReservedIPv4(v4mapped[1]);
  return false;
}

/** Throws if `urlString` isn't a safe public http(s) URL to fetch server-side. */
async function assertSafeExternalUrl(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("bad-url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad-url");

  const hostname = parsed.hostname;
  const literalKind = isIP(hostname);
  if (literalKind === 4) {
    if (isPrivateOrReservedIPv4(hostname)) throw new Error("blocked-host");
    return;
  }
  if (literalKind === 6) {
    if (isPrivateOrReservedIPv6(hostname)) throw new Error("blocked-host");
    return;
  }

  if (hostname.toLowerCase() === "localhost") throw new Error("blocked-host");

  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("bad-url");
  }
  if (records.length === 0) throw new Error("bad-url");
  for (const r of records) {
    if (r.family === 4 && isPrivateOrReservedIPv4(r.address)) throw new Error("blocked-host");
    if (r.family === 6 && isPrivateOrReservedIPv6(r.address)) throw new Error("blocked-host");
  }
}

/**
 * Fetch an external OTA .ics feed and import it as blocking bookings for one
 * room type of the active property.
 *
 * Idempotency: each imported booking's `notes` is stamped with
 * `ota-import:<uid>` (the VEVENT's UID). Re-syncing the same feed re-fetches
 * everything but skips any UID that already has a booking with that notes
 * value for this property, so re-running the sync never double-blocks.
 *
 * Every VEVENT is a room-type-level block (room_id/guest_id left null, exactly
 * like the export feed's "Booked" placeholder) — it never collides with the
 * room-level conflict trigger, which only fires when room_id is set
 * (see supabase/migrations/05_pms_tables.sql).
 */
export async function importOtaIcal(
  roomTypeId: string,
  icsUrl: string
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  try {
    const active = await getActiveProperty();
    if (!active.ok) return active;
    const { id: propertyId, tenant_id: tenantId } = active.data.property;

    const url = icsUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      return fail("HG-VALIDATION-422", "Enter a valid http(s) calendar URL.");
    }
    try {
      await assertSafeExternalUrl(url);
    } catch {
      return fail("HG-VALIDATION-422", "That calendar URL isn't allowed.");
    }

    const supabase = createClient();

    // Confirm the room type actually belongs to the active property — same
    // ownership guard the export route uses, so a stale/foreign roomTypeId
    // 404s instead of silently importing into the wrong calendar.
    const { data: roomType, error: rtErr } = await supabase
      .from("room_types")
      .select("id")
      .eq("id", roomTypeId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (rtErr) throw rtErr;
    if (!roomType) return fail("HG-ROOM-404", "Room type not found.");

    let icsText: string;
    try {
      // redirect: "manual" — never auto-follow. A redirect target isn't
      // covered by the assertSafeExternalUrl() check above and could point
      // at an internal address, so we require the caller to paste the direct
      // .ics link instead of silently chasing 3xx hops.
      const res = await fetch(url, { cache: "no-store", redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        return fail("HG-VALIDATION-422", "That link redirects — paste the direct .ics URL instead.");
      }
      if (!res.ok) {
        // Deliberately generic: echoing the upstream status code back turns
        // this endpoint into a port/host scanning oracle.
        return fail("HG-VALIDATION-422", "Could not fetch that calendar.");
      }
      icsText = await res.text();
    } catch {
      return fail("HG-VALIDATION-422", "Could not fetch that calendar.");
    }

    const events = parseICS(icsText);

    let imported = 0;
    let skipped = 0;

    for (const ev of events) {
      const dedupeKey = `ota-import:${ev.uid}`;

      const { data: existing, error: exErr } = await supabase
        .from("bookings")
        .select("id")
        .eq("property_id", propertyId)
        .eq("notes", dedupeKey)
        .limit(1);
      if (exErr) throw exErr;
      if (existing && existing.length > 0) {
        skipped += 1;
        continue;
      }

      const created = await createBooking(propertyId, tenantId, {
        room_type_id: roomTypeId,
        room_id: null,
        guest_id: null,
        guest_name: "OTA Block",
        check_in: ev.checkIn,
        check_out: ev.checkOut,
        source: "ota",
        notes: dedupeKey,
      });

      // One bad event (e.g. a conflict/validation error) shouldn't sink the
      // whole sync — count it as skipped and keep going.
      if (!created.ok) {
        skipped += 1;
        continue;
      }
      imported += 1;
    }

    revalidatePath("/app/settings");
    revalidatePath("/app/calendar");
    return ok({ imported, skipped });
  } catch (e) {
    return mapPgError(e);
  }
}
