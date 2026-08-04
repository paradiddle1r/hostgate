-- 27_booking_rate_limit.sql
--
-- `public_create_booking` is granted to `anon` and reachable directly at
-- /rest/v1/rpc/public_create_booking, so the Next.js form is not a gate: anyone
-- can script it and flood a property's calendar with junk pending bookings,
-- which also poisons the availability the OTA channel publishes. This adds the
-- first throttle.
--
-- The counter reads the `bookings` table rather than a separate attempts log,
-- and that is deliberate. The whole RPC runs in one transaction, so any row
-- written to an attempts table would be rolled back by the very `raise` that
-- rejects the request — the log could never accumulate. Counting committed
-- bookings inverts the problem correctly: a *rejected* request writes nothing
-- and therefore costs the property nothing, while a *successful* one is
-- exactly what we want to cap.
--
-- Known limit: this bounds the damage, it does not stop a determined attacker
-- from burning CPU on rejected calls. Per-IP throttling belongs at the edge
-- (Vercel WAF / middleware) and is still outstanding.

-- Supports both throttle queries below without touching the hot booking path.
create index if not exists bookings_source_recent_idx
  on public.bookings (property_id, source, created_at desc);

create index if not exists bookings_phone_recent_idx
  on public.bookings (phone, created_at desc)
  where phone is not null;

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
  v_recent_property int; v_recent_contact int;
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

  v_name  := coalesce(nullif(trim(p_guest_name), ''), 'Guest');
  v_phone := nullif(trim(p_phone), '');
  v_email := lower(nullif(trim(p_email), ''));

  if coalesce(v_phone, v_email) is null then
    raise exception 'HG-BOOK-426: phone or email is required' using errcode = 'P0001';
  end if;

  -- Throttle: one property should not receive a flood of web bookings in an
  -- hour, and one phone number should not book the same property repeatedly.
  select count(*) into v_recent_property
    from public.bookings b
   where b.property_id = p_property
     and b.source = 'web'
     and b.created_at > now() - interval '1 hour';
  if v_recent_property >= 20 then
    raise exception 'HG-BOOK-429: too many bookings for this property right now, please try again later'
      using errcode = 'P0001';
  end if;

  if v_phone is not null then
    select count(*) into v_recent_contact
      from public.bookings b
     where b.property_id = p_property
       and b.source = 'web'
       and b.phone = v_phone
       and b.created_at > now() - interval '1 hour';
    if v_recent_contact >= 3 then
      raise exception 'HG-BOOK-429: too many bookings from this contact, please try again later'
        using errcode = 'P0001';
    end if;
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
