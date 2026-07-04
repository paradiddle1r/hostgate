-- =====================================================================
-- HostGate · Migration 21 — Expose property logo/photo to the public
-- booking page (public_property_by_code)
-- =====================================================================
-- Commit 1625611 ("Booking-widget branding & shareable embed link in
-- Settings") added a Settings → "Direct booking widget" panel that tells
-- owners: "The logo above (in Company profile) also appears in the
-- header of your public booking page." That was never true — the anon
-- RPC the guest-facing /book/[code] pages call, public_property_by_code
-- (migration 14), never selected properties.logo_url, so there was no
-- way for app/book/[code]/page.tsx or layout.tsx to render it.
--
-- Purely additive: widen the RPC's return table with logo_url (a column
-- that already exists on public.properties since migration 15). No RLS
-- change needed — the function is already SECURITY DEFINER and already
-- granted to anon/authenticated/service_role.
-- Idempotent. Apply via MCP apply_migration name="public_property_logo".
-- =====================================================================

create or replace function public.public_property_by_code(p_code text)
returns table (id uuid, name text, currency text, city text, country text, logo_url text)
language sql security definer set search_path = public, pg_temp stable as $$
  select p.id, p.name, p.currency, p.city, p.country, p.logo_url
  from public.properties p
  where upper(p.code) = upper(trim(p_code))
  order by p.created_at
  limit 1;
$$;

-- =====================================================================
-- End of migration 21
-- =====================================================================
