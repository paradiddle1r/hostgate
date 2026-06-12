-- =====================================================================
-- HostGate · Migration 14 — Phase E: Public booking engine
-- =====================================================================
-- A guest-facing booking flow per property (URL = /book/<property code>),
-- with NO auth. Anonymous guests reach the DB ONLY through these four
-- SECURITY DEFINER functions (granted to anon) — they expose exactly the
-- booking surface (public property info, availability, a stay quote, and a
-- pending-booking insert) and nothing else. Anon has zero table RLS access.
-- The created booking lands as status='pending', source='web', room_id=null
-- (a holding lane); staff confirm + assign a room from the calendar.
-- Idempotent. Applied via MCP apply_migration name="phase_e_booking_engine".
-- =====================================================================

-- ── public property lookup by code ───────────────────────────────────────────
create or replace function public.public_property_by_code(p_code text)
returns table (id uuid, name text, currency text, city text, country text)
language sql security definer set search_path = public, pg_temp stable as $$
  select p.id, p.name, p.currency, p.city, p.country
  from public.properties p
  where upper(p.code) = upper(trim(p_code))
  order by p.created_at
  limit 1;
$$;

-- ── availability per room type for a window ──────────────────────────────────
create or replace function public.public_availability(p_property uuid, p_check_in date, p_check_out date)
returns table (room_type_id uuid, name text, daily_rate numeric, quantity int, available int)
language sql security definer set search_path = public, pg_temp stable as $$
  select rt.id, rt.name, rt.daily_rate, rt.quantity,
    greatest(0, rt.quantity - (
      select count(*) from public.bookings b
      where b.property_id = p_property and b.room_type_id = rt.id
        and b.status <> 'cancelled'
        and b.check_in < p_check_out and b.check_out > p_check_in
    ))::int as available
  from public.room_types rt
  where rt.property_id = p_property and rt.stay_kind = 'daily'
  order by rt.sort_order, rt.name;
$$;

-- ── stay quote (per-night daily_rates override else base rate) ───────────────
create or replace function public.public_quote(p_property uuid, p_room_type uuid, p_check_in date, p_check_out date)
returns numeric language plpgsql security definer set search_path = public, pg_temp stable as $$
declare v_total numeric := 0; v_base numeric; d date;
begin
  select daily_rate into v_base from public.room_types where id = p_room_type and property_id = p_property;
  if v_base is null then return 0; end if;
  if p_check_out <= p_check_in then return 0; end if;
  for d in select generate_series(p_check_in, p_check_out - 1, interval '1 day')::date loop
    v_total := v_total + coalesce(
      (select price from public.daily_rates where room_type_id = p_room_type and date = d), v_base, 0);
  end loop;
  return v_total;
end $$;

-- ── create a pending web booking (re-checks availability to avoid overbooking) ─
create or replace function public.public_create_booking(
  p_property uuid, p_room_type uuid, p_check_in date, p_check_out date,
  p_guest_name text, p_phone text, p_email text, p_adults int, p_children int
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tenant uuid; v_avail int; v_total numeric; v_id uuid; v_code text; v_notes text;
begin
  if p_check_out <= p_check_in then
    raise exception 'HG-BOOK-422: check-out must be after check-in' using errcode = 'P0001';
  end if;
  select tenant_id into v_tenant from public.properties where id = p_property;
  if v_tenant is null then
    raise exception 'HG-PROP-404: property not found' using errcode = 'P0001';
  end if;
  -- availability re-check
  select greatest(0, rt.quantity - (
      select count(*) from public.bookings b
      where b.property_id = p_property and b.room_type_id = rt.id
        and b.status <> 'cancelled' and b.check_in < p_check_out and b.check_out > p_check_in))
    into v_avail
  from public.room_types rt where rt.id = p_room_type and rt.property_id = p_property;
  if v_avail is null then
    raise exception 'HG-BOOK-404: room type not found' using errcode = 'P0001';
  end if;
  if v_avail <= 0 then
    raise exception 'HG-BOOK-409: no availability for those dates' using errcode = 'P0001';
  end if;

  v_total := public.public_quote(p_property, p_room_type, p_check_in, p_check_out);
  v_notes := 'Web booking' ||
    case when coalesce(p_email,'') <> '' then ' · email: ' || p_email else '' end;

  insert into public.bookings
    (tenant_id, property_id, room_type_id, guest_name, phone, check_in, check_out,
     status, source, adults, children, total_amount, notes)
  values
    (v_tenant, p_property, p_room_type, coalesce(nullif(trim(p_guest_name),''),'Guest'),
     nullif(trim(p_phone),''), p_check_in, p_check_out, 'pending', 'web',
     greatest(1, coalesce(p_adults,1)), greatest(0, coalesce(p_children,0)), v_total, v_notes)
  returning id, code into v_id, v_code;

  return jsonb_build_object('id', v_id, 'code', v_code, 'total', v_total);
end $$;

-- ── grants: anon (+ authenticated/service_role) may call these four only ──────
do $$ declare sig text;
begin
  foreach sig in array array[
    'public.public_property_by_code(text)',
    'public.public_availability(uuid, date, date)',
    'public.public_quote(uuid, uuid, date, date)',
    'public.public_create_booking(uuid, uuid, date, date, text, text, text, int, int)'
  ] loop
    execute format('revoke all on function %s from public', sig);
    execute format('grant execute on function %s to anon, authenticated, service_role', sig);
  end loop;
end $$;

-- =====================================================================
-- End of migration 14
-- =====================================================================
