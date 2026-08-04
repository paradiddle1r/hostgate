-- 26_booking_guests_and_inventory.sql
--
-- Two follow-ups to the 2026-08-04 end-to-end booking walk (migration 25).
--
--   1. Web bookings never created a guest. public_create_booking() wrote the
--      name into bookings.guest_name and left bookings.guest_id null, so the
--      PMS Guests module stayed empty (0 guests against 13 bookings) and the
--      property had no CRM record, no repeat-guest history, and no stored
--      email — the address only ever survived as free text inside notes.
--   2. The website and the OTA channel advertised different inventory.
--      public_availability() counted room_types.quantity, a number typed by
--      hand during onboarding, while lib/channex/ari.ts counts active physical
--      rooms and only falls back to quantity when a type has none. Chotana Inn
--      has 36 rooms but its quantities total 14, so the direct booking engine
--      was underselling by more than half against what Channex published.
--      public_availability now uses the same rule as the channel manager.

-- 1 ----------------------------------------------------------- inventory ---

-- Same rule as lib/channex/ari.ts computeAvailability(): active physical rooms
-- of the type, falling back to the hand-typed quantity only when the owner has
-- not created rooms for it yet. Defined first — both functions below call it.
create or replace function public.public_room_type_inventory(
  p_property uuid, p_room_type uuid
)
returns integer
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select greatest(0, coalesce(
    nullif((
      select count(*)::int from public.rooms r
       where r.property_id = p_property
         and r.room_type_id = p_room_type
         and r.status = 'active'
    ), 0),
    (select rt.quantity from public.room_types rt where rt.id = p_room_type),
    0
  ));
$function$;

revoke execute on function public.public_room_type_inventory(uuid, uuid) from anon, authenticated;

create or replace function public.public_availability(
  p_property uuid, p_check_in date, p_check_out date
)
returns table(room_type_id uuid, name text, daily_rate numeric, quantity integer, available integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select rt.id, rt.name, rt.daily_rate,
    public.public_room_type_inventory(p_property, rt.id) as quantity,
    greatest(0, public.public_room_type_inventory(p_property, rt.id) - (
      select count(*) from public.bookings b
      where b.property_id = p_property and b.room_type_id = rt.id
        and b.status <> 'cancelled' and b.check_in < p_check_out and b.check_out > p_check_in
    ))::int as available
  from public.room_types rt
  where rt.property_id = p_property and rt.stay_kind = 'daily'
  order by rt.sort_order, rt.name;
$function$;

-- 2 -------------------------------------------------------------- guests ---

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
  v_name text; v_phone text; v_email text;
  v_guest uuid; v_id uuid; v_code text; v_notes text;
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

  v_today := (now() at time zone v_tz)::date;
  if p_check_in < v_today then
    raise exception 'HG-BOOK-423: check-in date is in the past' using errcode = 'P0001';
  end if;

  select rt.daily_rate,
         public.public_room_type_inventory(p_property, rt.id) - (
           select count(*) from public.bookings b
            where b.property_id = p_property and b.room_type_id = rt.id
              and b.status <> 'cancelled'
              and b.check_in < p_check_out and b.check_out > p_check_in)
    into v_rate, v_avail
    from public.room_types rt
   where rt.id = p_room_type and rt.property_id = p_property;

  if v_avail is null then
    raise exception 'HG-BOOK-404: room type not found' using errcode = 'P0001';
  end if;
  if v_avail <= 0 then
    raise exception 'HG-BOOK-409: no availability for those dates' using errcode = 'P0001';
  end if;
  if v_rate is null then
    raise exception 'HG-BOOK-425: room type has no published rate' using errcode = 'P0001';
  end if;

  v_total := public.public_quote(p_property, p_room_type, p_check_in, p_check_out);
  if coalesce(v_total, 0) <= 0 then
    raise exception 'HG-BOOK-425: room type has no published rate' using errcode = 'P0001';
  end if;

  v_name  := coalesce(nullif(trim(p_guest_name), ''), 'Guest');
  v_phone := nullif(trim(p_phone), '');
  v_email := lower(nullif(trim(p_email), ''));

  if coalesce(v_phone, v_email) is null then
    raise exception 'HG-BOOK-426: phone or email is required' using errcode = 'P0001';
  end if;

  -- Find-or-create the guest so the booking lands in the property's CRM
  -- instead of being a name on a row. Matching is per property, on either
  -- contact channel — a returning guest who books with the same phone or the
  -- same email is the same person, not a duplicate card.
  select g.id into v_guest
    from public.guests g
   where g.property_id = p_property
     and ((v_phone is not null and g.phone = v_phone)
       or (v_email is not null and lower(g.email) = v_email))
   order by g.created_at
   limit 1;

  if v_guest is null then
    insert into public.guests (tenant_id, property_id, full_name, phone, email)
    values (v_tenant, p_property, v_name, v_phone, v_email)
    returning id into v_guest;
  else
    -- Fill in whichever channel we did not have before; never overwrite.
    update public.guests
       set phone = coalesce(phone, v_phone),
           email = coalesce(email, v_email),
           updated_at = now()
     where id = v_guest;
  end if;

  v_notes := 'Web booking' ||
             case when v_email is not null then ' · email: ' || v_email else '' end;

  insert into public.bookings
    (tenant_id, property_id, room_type_id, guest_id, guest_name, phone,
     check_in, check_out, status, source, adults, children, total_amount, notes)
  values
    (v_tenant, p_property, p_room_type, v_guest, v_name, v_phone,
     p_check_in, p_check_out, 'pending', 'web',
     greatest(1, coalesce(p_adults, 1)), greatest(0, coalesce(p_children, 0)),
     v_total, v_notes)
  returning id, code into v_id, v_code;

  return jsonb_build_object('id', v_id, 'code', v_code, 'total', v_total);
end
$function$;

