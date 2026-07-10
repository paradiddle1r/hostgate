import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  selectBookingsDueForReviewRequest,
  type ReviewRequestCandidateBooking,
} from "@/lib/post-stay-review-requests";
import { createPostStayReviewRequestToken } from "@/lib/guest-session";
import { sendPostStayReviewRequestEmail } from "@/lib/mailer";

/**
 * Post-stay review request cron — roadmap m1, the scheduled post-stay review
 * email pipeline. Fires once daily (see vercel.json's `crons` entry) and
 * sends a review request to every checked-out booking whose checkout date was
 * exactly `daysAfter` (1) day ago, across ALL tenants/properties.
 *
 * Auth: Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`
 * (a project env var) — anything else, or a missing/misconfigured
 * CRON_SECRET, gets a 401 so this can't be hit by a random caller.
 *
 * Uses the service-role client (lib/supabase/admin.ts), NOT the RLS-scoped
 * cookie client (lib/supabase/server.ts) — there is no signed-in user on a
 * cron invocation, and the RLS-scoped client only ever sees one tenant's
 * rows via auth_tenant_ids() anyway, so it could never read across every
 * tenant the way this job needs to.
 *
 * TODO(duplicate-send risk): there is no `review_request_sent_at` column (no
 * migration in this milestone — the date-window check in
 * selectBookingsDueForReviewRequest is the only gate). If this route reruns
 * on the same day (manual retrigger, retried invocation, etc.) the same
 * bookings will get requested again. Acceptable for now since Vercel Cron
 * fires once/day; revisit if that becomes a real problem.
 */

const DAYS_AFTER = 1;

interface ReviewRequestBookingRow extends ReviewRequestCandidateBooking {
  id: string;
  code: string;
  check_in: string;
  guest_name: string;
  properties: { name: string } | null;
  room_types: { name: string } | null;
  guests: { email: string | null } | null;
}

function reviewBaseOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }
  return new URL(request.url).origin;
}

function buildReviewLink(request: NextRequest, booking: ReviewRequestBookingRow, token: string): string {
  const base = reviewBaseOrigin(request);
  const path = `/book/${encodeURIComponent(booking.code)}/review/${encodeURIComponent(booking.id)}`;
  const url = new URL(path, base);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const supabase = createAdminClient();

  // Every property/tenant's checked-out bookings — the service-role client
  // bypasses RLS. lte(check_out, today) is just a scan-size optimization; the
  // exact date-window match still happens in selectBookingsDueForReviewRequest.
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, code, check_in, check_out, status, guest_name, properties(name), room_types(name), guests(email)"
    )
    .eq("status", "checked_out")
    .lte("check_out", todayISO);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as ReviewRequestBookingRow[];
  const due = selectBookingsDueForReviewRequest(todayISO, rows, DAYS_AFTER);

  let sent = 0;
  let skipped = 0;

  for (const booking of due) {
    const to = booking.guests?.email;
    if (!to) {
      skipped++;
      continue;
    }

    const token = createPostStayReviewRequestToken(booking.id, booking.code);
    if (!token) {
      skipped++;
      continue;
    }

    const result = await sendPostStayReviewRequestEmail({
      to,
      propertyName: booking.properties?.name ?? "",
      guestName: booking.guest_name,
      bookingCode: booking.code,
      roomTypeName: booking.room_types?.name ?? "",
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      reviewLink: buildReviewLink(request, booking, token),
    });
    if (result.ok) {
      sent++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ sent, skipped });
}
