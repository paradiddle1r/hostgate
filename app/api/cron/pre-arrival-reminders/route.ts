import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  selectBookingsDueForReminder,
  type ReminderCandidateBooking,
} from "@/lib/pre-arrival-reminders";
import { sendPreArrivalReminderEmail } from "@/lib/mailer";

/**
 * Pre-arrival reminder cron — roadmap m1, the scheduled pre-arrival reminder
 * email pipeline. Fires once daily (see vercel.json's `crons` entry) and
 * sends a reminder to every confirmed/checked-in booking checking in exactly
 * `daysBefore` (3) days from today, across ALL tenants/properties.
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
 * TODO(duplicate-send risk): there is no `reminder_sent_at` column (no
 * migration in this milestone — the date-window check in
 * selectBookingsDueForReminder is the only gate). If this route reruns on
 * the same day (manual retrigger, retried invocation, etc.) the same
 * bookings will get reminded again. Acceptable for now since Vercel Cron
 * fires once/day; revisit if that becomes a real problem.
 */

const DAYS_BEFORE = 3;

interface ReminderBookingRow extends ReminderCandidateBooking {
  id: string;
  code: string;
  check_out: string;
  guest_name: string;
  properties: { name: string; currency: string } | null;
  room_types: { name: string } | null;
  guests: { email: string | null } | null;
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const supabase = createAdminClient();

  // Every property/tenant's bookings — the service-role client bypasses RLS.
  // gte(check_in, today) is just a scan-size optimization (a reminder target
  // date is always in the future); the exact date-window match still happens
  // in selectBookingsDueForReminder below.
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, code, check_in, check_out, status, guest_name, properties(name, currency), room_types(name), guests(email)"
    )
    .neq("status", "cancelled")
    .gte("check_in", todayISO);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as ReminderBookingRow[];
  const due = selectBookingsDueForReminder(todayISO, rows, DAYS_BEFORE);

  let sent = 0;
  let skipped = 0;

  for (const booking of due) {
    const to = booking.guests?.email;
    if (!to) {
      skipped++;
      continue;
    }
    const result = await sendPreArrivalReminderEmail({
      to,
      propertyName: booking.properties?.name ?? "",
      guestName: booking.guest_name,
      bookingCode: booking.code,
      roomTypeName: booking.room_types?.name ?? "",
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      currency: booking.properties?.currency ?? "THB",
    });
    if (result.ok) {
      sent++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ sent, skipped });
}
