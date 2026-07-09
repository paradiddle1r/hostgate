-- =====================================================================
-- HostGate · Migration 23 — Public guest booking history ("my other stays")
-- =====================================================================
-- Guest self-service (migration 20) already proves a guest owns an email by
-- requiring booking_code + email to BOTH match before showing that one
-- booking's details (public_lookup_booking). This RPC itself takes email
-- ONLY (no code) so it can list every OTHER matching booking — the code
-- proof therefore has to happen one layer up, in the calling server action
-- (getGuestBookingHistoryAction in app/book/actions.ts), which must re-run
-- lookupPublicBooking(code, email) FIRST and only call this RPC if that
-- succeeds. Never call this RPC directly off a bare client-supplied email —
-- Next.js server actions are plain POST endpoints, reachable without going
-- through the UI's lookup step first, so an email-only gate here would let
-- anyone who merely knows/guesses a guest's email enumerate their stay
-- history. Scoped otherwise IDENTICALLY to lookup (same property_id + the
-- same anchored email match against b.notes, since public_create_booking has
-- no guest_email column — see migration 20's header for why); lists the
-- guest's OTHER `source = 'web'` bookings at that same property (optionally
-- excluding the booking id just looked up, so it isn't duplicated in the
-- list). Deliberately does NOT return booking `code` — this RPC must never
-- be usable to harvest another booking's code, which is the one thing that
-- unlocks full detail + cancel via public_lookup_booking /
-- public_cancel_booking. Never returns anything beyond what the
-- manage-booking UI shows for a single booking otherwise (no guest id, no
-- phone, no other guests' data) — used only by
-- components/book/ManageBookingForm.tsx after a successful lookup.
--
-- NOTE on matching: public_lookup_booking's tail match is a raw ILIKE with
-- p_email concatenated straight into the pattern — since ILIKE treats `_`
-- and `%` in the *pattern* as wildcards, a p_email containing `_` (common in
-- real addresses, e.g. mary_jane@x.com) can over-match a DIFFERENT guest's
-- notes (e.g. maryxjane@x.com). Lookup gets away with it only because it
-- ALSO requires the exact booking code to match. This RPC has no code to
-- fall back on — email is the sole identity gate — so it uses an exact,
-- case-insensitive tail-length comparison instead of ILIKE, which has no
-- wildcard characters to worry about.
--
-- Idempotent. Apply via MCP apply_migration name="public_guest_history".
-- =====================================================================

create or replace function public.public_guest_booking_history(
  p_property uuid, p_email text, p_exclude_id uuid default null
)
returns table (
  id uuid, status text, check_in date, check_out date,
  room_type_name text
)
language sql security definer set search_path = public, pg_temp stable as $$
  select b.id, b.status, b.check_in, b.check_out,
    coalesce(rt.name, 'Room') as room_type_name
  from public.bookings b
  left join public.room_types rt on rt.id = b.room_type_id
  where b.property_id = p_property
    and b.source = 'web'
    and trim(coalesce(p_email, '')) <> ''
    and b.notes is not null
    and lower(right(b.notes, length('email: ' || trim(p_email))))
      = lower('email: ' || trim(p_email))
    and (p_exclude_id is null or b.id <> p_exclude_id)
  order by b.check_in desc
  limit 20;
$$;

-- ── grants: anon (+ authenticated/service_role) may call this only ──────────
revoke all on function public.public_guest_booking_history(uuid, text, uuid) from public;
grant execute on function public.public_guest_booking_history(uuid, text, uuid) to anon, authenticated, service_role;

-- =====================================================================
-- End of migration 23
-- =====================================================================
