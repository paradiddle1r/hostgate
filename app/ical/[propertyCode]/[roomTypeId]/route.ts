import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBookingsICS, type ICalBookingEvent } from "@/lib/ical";

// Public per-room-type iCal export — Channel Sync m1. OTAs (Booking.com /
// Agoda / Airbnb) poll this URL with no auth to see HostGate's existing
// bookings for one room type and stop double-selling it. Import (writing
// OTA bookings back into HostGate) is a later milestone — this route is
// read-only / export-only.
//
// Trust model: the property `code` + room_type `id` are the shared secret,
// exactly like the existing /book/[code] public flow — there is no session.
// Anon has ZERO table RLS access (see migration 14's comment), so the
// RLS-scoped server client can't read room_types/bookings here at all, and
// adding a new SECURITY DEFINER RPC would mean a new migration — out of
// scope for this milestone. Instead this reads through the service-role
// client (lib/supabase/admin.ts, the same escape hatch the public checkout
// already uses for invoice writes) — safe here because every query below is
// scoped by an id/code pair the caller must already know, is read-only, and
// the response contains no guest PII (see lib/ical.ts — SUMMARY is always
// the literal "Booked").
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(): NextResponse {
  return new NextResponse("Not found", { status: 404 });
}

export async function GET(
  _request: Request,
  { params }: { params: { propertyCode: string; roomTypeId: string } }
) {
  const propertyCode = decodeURIComponent(params.propertyCode || "").trim();
  const roomTypeId = decodeURIComponent(params.roomTypeId || "").trim();
  if (!propertyCode || !roomTypeId || !UUID_RE.test(roomTypeId)) {
    return notFound();
  }

  const supabase = createAdminClient();

  // 1) Property by public code (case-insensitive exact match, same tie-break
  // as the public_property_by_code RPC the booking flow uses — `code` is
  // only unique per-tenant (properties_tenant_code_uniq), so two tenants can
  // share a code; oldest property wins, exactly like that RPC's `order by
  // created_at limit 1`). Plain `.eq` (not `.ilike`) avoids treating any
  // %/_ in the URL segment as a LIKE wildcard.
  const { data: properties } = await supabase
    .from("properties")
    .select("id, code, name")
    .eq("code", propertyCode.toUpperCase())
    .order("created_at", { ascending: true })
    .limit(1);
  const property = properties?.[0];
  if (!property) return notFound();

  // 2) Confirm the room type actually belongs to this property.
  const { data: roomType } = await supabase
    .from("room_types")
    .select("id, name")
    .eq("id", roomTypeId)
    .eq("property_id", property.id)
    .maybeSingle();
  if (!roomType) return notFound();

  // 3) Every non-cancelled booking for that room type. Cancelled bookings
  // are excluded — an OTA calendar should never be told a date is taken
  // because of a booking that no longer holds the room.
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, check_in, check_out")
    .eq("property_id", property.id)
    .eq("room_type_id", roomType.id)
    .neq("status", "cancelled");
  if (error) {
    return new NextResponse("Error building calendar feed", { status: 500 });
  }

  const events: ICalBookingEvent[] = (bookings ?? []).map((b) => ({
    id: String(b.id),
    checkIn: String(b.check_in),
    checkOut: String(b.check_out),
  }));

  const body = buildBookingsICS(
    `${property.name} — ${roomType.name}`,
    events,
    new Date().toISOString()
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${property.code}-${roomType.id}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
