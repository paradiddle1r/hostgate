-- =====================================================================
-- HostGate · Migration 20 — Public "manage my booking" (guest self-service)
-- =====================================================================
-- Anon has ZERO table RLS access (see migration 14's header comment) — every
-- guest-facing read/write must go through a SECURITY DEFINER RPC granted to
-- anon. This adds two, mirroring the migration-14 pattern exactly, so a guest
-- can look up and cancel their own DIRECT (source = 'web') booking after the
-- confirmation page, without exposing bookings by code alone:
--
--   public_lookup_booking(property, code, email) — returns a row ONLY if the
--   booking code AND the email the guest typed at checkout both match.
--   public_create_booking (migration 14) doesn't have a guest_email column to
--   check against — it appends the email into `notes` as
--   "Web booking · email: <email>" — so matching is an anchored ILIKE on the
--   trailing "email: <email>" suffix of notes (exact value, not a loose
--   substring: '%' only precedes the anchor, so it must be the literal tail
--   of the string). Bookings taken with phone only (no email) can never be
--   looked up here — expected, matches what was captured at checkout.
--
--   public_cancel_booking(property, code, email) — re-verifies the same
--   code+email match server-side (never trusts a client-held id), then
--   refuses if already cancelled or check_in has passed, else flips status
--   to 'cancelled'.
--
-- Idempotent. Apply via MCP apply_migration name="public_manage_booking".
-- =====================================================================

-- ── guest lookup: booking_code + email must BOTH match ────────────────────────
create or replace function public.public_lookup_booking(p_property uuid, p_code text, p_email text)
returns table (
  id uuid, code text, status text, check_in date, check_out date,
  room_type_name text, total_amount numeric, currency text
)
language sql security definer set search_path = public, pg_temp stable as $$
  select b.id, b.code, b.status, b.check_in, b.check_out,
    coalesce(rt.name, 'Room') as room_type_name, b.total_amount, p.currency
  from public.bookings b
  join public.properties p on p.id = b.property_id
  left join public.room_types rt on rt.id = b.room_type_id
  where b.property_id = p_property
    and b.source = 'web'
    and upper(b.code) = upper(trim(p_code))
    and trim(coalesce(p_email, '')) <> ''
    and b.notes ilike ('%email: ' || trim(p_email))
  order by b.created_at desc
  limit 1;
$$;

-- ── guest cancel: re-verify code+email, then block already-cancelled / past ──
create or replace function public.public_cancel_booking(p_property uuid, p_code text, p_email text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid; v_status text; v_check_in date;
begin
  select b.id, b.status, b.check_in into v_id, v_status, v_check_in
  from public.bookings b
  where b.property_id = p_property
    and b.source = 'web'
    and upper(b.code) = upper(trim(p_code))
    and trim(coalesce(p_email, '')) <> ''
    and b.notes ilike ('%email: ' || trim(p_email))
  order by b.created_at desc
  limit 1;

  if v_id is null then
    raise exception 'HG-BOOK-404: booking not found' using errcode = 'P0001';
  end if;
  if v_status = 'cancelled' then
    raise exception 'HG-BOOK-422: booking is already cancelled' using errcode = 'P0001';
  end if;
  if v_check_in <= current_date then
    raise exception 'HG-BOOK-422: check-in has already passed, contact the property directly' using errcode = 'P0001';
  end if;

  update public.bookings set status = 'cancelled' where id = v_id;

  return jsonb_build_object('id', v_id, 'status', 'cancelled');
end $$;

-- ── grants: anon (+ authenticated/service_role) may call these two only ──────
do $$ declare sig text;
begin
  foreach sig in array array[
    'public.public_lookup_booking(uuid, text, text)',
    'public.public_cancel_booking(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public', sig);
    execute format('grant execute on function %s to anon, authenticated, service_role', sig);
  end loop;
end $$;

-- =====================================================================
-- End of migration 20
-- =====================================================================
