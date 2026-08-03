-- 25_booking_engine_integrity.sql
--
-- Fixes three defects found by an end-to-end walk of the public booking engine
-- (2026-08-04). All three are reachable by an anonymous stranger on
-- hostgate.app, so they are fixed at the database seam rather than only in the
-- UI — the RPCs below are the actual trust boundary.
--
--   1. Property codes collided. gen_property_code() derived its prefix from
--      tenants.slug stripped to [a-z0-9]. A Thai property name slugifies to
--      nothing, so EVERY Thai-named tenant fell back to prefix 'PROP', and the
--      suffix counted properties *within* the tenant, so every one of them was
--      also '-01'. Two live properties already share PROP-01. Because
--      /book/<code> is the public booking URL and public_property_by_code()
--      resolves with `order by created_at limit 1`, the newer hotel's booking
--      link silently served the OLDER hotel's rooms.
--   2. Unpriced rooms were bookable. room_types.daily_rate is nullable and the
--      onboarding wizard leaves it null when the owner skips the rate field;
--      public_quote() then returns 0 and public_create_booking() happily wrote
--      a THB 0 booking. Verified end to end against a live property.
--   3. Check-in could be in the past. Nothing rejected a past date, and the
--      booking form's own default was a past date for 7 hours a day (the
--      landing page computed "today" in UTC while the property lives in +07).

-- 1 ---------------------------------------------------------------- codes ---

create or replace function public.gen_property_code()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_prefix text; v_n int; v_code text;
begin
  if new.code is not null then return new; end if;

  select upper(left(regexp_replace(lower(coalesce(t.slug, '')), '[^a-z0-9]', '', 'g'), 4))
    into v_prefix
    from public.tenants t
   where t.id = new.tenant_id;

  -- Non-Latin names strip to nothing; 'PROP' stays the readable fallback.
  if v_prefix is null or length(v_prefix) < 2 then
    v_prefix := 'PROP';
  end if;

  -- Uniqueness must be GLOBAL, not per-tenant: this value is the public
  -- /book/<code> key, so two tenants sharing it is a cross-tenant leak.
  v_n := 1;
  loop
    v_code := v_prefix || '-' || lpad(v_n::text, 2, '0');
    exit when not exists (
      select 1 from public.properties p where upper(p.code) = v_code
    );
    v_n := v_n + 1;
    -- Pathological contention: fall back to a random suffix rather than spin.
    if v_n > 9999 then
      v_code := v_prefix || '-' ||
                upper(substr(md5(new.id::text || clock_timestamp()::text), 1, 6));
      exit;
    end if;
  end loop;

  new.code := v_code;
  return new;
end
$function$;

-- Re-code the existing collisions, keeping the oldest holder of each code so
-- booking links that already work keep working.
do $$
declare r record; v_prefix text; v_n int; v_code text;
begin
  for r in
    select id, code
      from (
        select id, code,
               row_number() over (partition by upper(code) order by created_at, id) as rn
          from public.properties
      ) ranked
     where rn > 1
  loop
    v_prefix := split_part(r.code, '-', 1);
    v_n := 1;
    loop
      v_code := v_prefix || '-' || lpad(v_n::text, 2, '0');
      exit when not exists (
        select 1 from public.properties p where upper(p.code) = v_code
      );
      v_n := v_n + 1;
    end loop;
    update public.properties set code = v_code where id = r.id;
    raise notice 'property % re-coded % -> %', r.id, r.code, v_code;
  end loop;
end $$;

create unique index if not exists properties_code_unique
  on public.properties (upper(code));

-- 2/3 ------------------------------------------------------------ booking ---

create or replace function public.public_create_booking(
  p_property uuid, p_room_type uuid, p_check_in date, p_check_out date,
  p_guest_name text, p_phone text, p_email text, p_adults integer, p_children integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_tenant uuid; v_tz text; v_today date;
  v_avail int; v_rate numeric; v_total numeric;
  v_id uuid; v_code text; v_notes text;
begin
  if p_check_out <= p_check_in then
    raise exception 'HG-BOOK-422: check-out must be after check-in' using errcode = 'P0001';
  end if;

  select tenant_id, coalesce(nullif(timezone, ''), 'Asia/Bangkok')
    into v_tenant, v_tz
    from public.properties
   where id = p_property;
  if v_tenant is null then
    raise exception 'HG-PROP-404: property not found' using errcode = 'P0001';
  end if;

  -- "Today" is the property's local today, not the server's UTC today.
  v_today := (now() at time zone v_tz)::date;
  if p_check_in < v_today then
    raise exception 'HG-BOOK-423: check-in date is in the past' using errcode = 'P0001';
  end if;

  select rt.daily_rate,
         greatest(0, rt.quantity - (
           select count(*) from public.bookings b
            where b.property_id = p_property and b.room_type_id = rt.id
              and b.status <> 'cancelled'
              and b.check_in < p_check_out and b.check_out > p_check_in))
    into v_rate, v_avail
    from public.room_types rt
   where rt.id = p_room_type and rt.property_id = p_property;

  if v_avail is null then
    raise exception 'HG-BOOK-404: room type not found' using errcode = 'P0001';
  end if;
  if v_avail <= 0 then
    raise exception 'HG-BOOK-409: no availability for those dates' using errcode = 'P0001';
  end if;

  -- An unpriced room type must not be sellable. Without this the public engine
  -- writes THB 0 bookings that then flow into invoices and the GL as zero.
  if v_rate is null then
    raise exception 'HG-BOOK-425: room type has no published rate' using errcode = 'P0001';
  end if;

  v_total := public.public_quote(p_property, p_room_type, p_check_in, p_check_out);
  if coalesce(v_total, 0) <= 0 then
    raise exception 'HG-BOOK-425: room type has no published rate' using errcode = 'P0001';
  end if;

  -- The property is told to "contact you to confirm", so at least one channel
  -- to contact the guest on is mandatory.
  if coalesce(nullif(trim(p_phone), ''), nullif(trim(p_email), '')) is null then
    raise exception 'HG-BOOK-426: phone or email is required' using errcode = 'P0001';
  end if;

  v_notes := 'Web booking' ||
             case when coalesce(p_email, '') <> '' then ' · email: ' || p_email else '' end;

  insert into public.bookings
    (tenant_id, property_id, room_type_id, guest_name, phone, check_in, check_out,
     status, source, adults, children, total_amount, notes)
  values
    (v_tenant, p_property, p_room_type,
     coalesce(nullif(trim(p_guest_name), ''), 'Guest'), nullif(trim(p_phone), ''),
     p_check_in, p_check_out, 'pending', 'web',
     greatest(1, coalesce(p_adults, 1)), greatest(0, coalesce(p_children, 0)),
     v_total, v_notes)
  returning id, code into v_id, v_code;

  return jsonb_build_object('id', v_id, 'code', v_code, 'total', v_total);
end
$function$;
