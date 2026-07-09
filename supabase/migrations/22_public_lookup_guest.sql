-- =====================================================================
-- HostGate · Migration 22 — Public returning-guest recognition
-- =====================================================================
-- Anon has ZERO table RLS access (see migration 14's header comment) — this
-- adds one more minimal SECURITY DEFINER RPC, mirroring the
-- public_lookup_booking pattern (migration 20): given a property_id + an
-- EXACT email+phone pair (BOTH required — matching on email alone would let
-- a stranger who merely guesses/knows someone's email see their name),
-- return just that guest's full_name if an existing `guests` row for that
-- property matches. No id, no contact info, no booking history — used only
-- by the public checkout form (components/book/CheckoutForm.tsx) to
-- auto-fill an still-empty name field and show a "welcome back" note.
--
-- Idempotent. Apply via MCP apply_migration name="public_lookup_guest".
-- =====================================================================

create or replace function public.public_lookup_guest(p_property uuid, p_email text, p_phone text)
returns table (full_name text)
language sql security definer set search_path = public, pg_temp stable as $$
  select g.full_name
  from public.guests g
  where g.property_id = p_property
    and trim(coalesce(p_email, '')) <> ''
    and trim(coalesce(p_phone, '')) <> ''
    and lower(trim(g.email)) = lower(trim(p_email))
    and trim(g.phone) = trim(p_phone)
  order by g.created_at desc
  limit 1;
$$;

-- ── grants: anon (+ authenticated/service_role) may call this only ──────────
revoke all on function public.public_lookup_guest(uuid, text, text) from public;
grant execute on function public.public_lookup_guest(uuid, text, text) to anon, authenticated, service_role;

-- =====================================================================
-- End of migration 22
-- =====================================================================
