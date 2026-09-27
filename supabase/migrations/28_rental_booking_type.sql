-- Save rental configuration and convert its booking in the same transaction.
-- No backfill: historical/cancelled bookings are not modified by this migration.
-- SECURITY INVOKER retains the caller's booking and rental RLS policies.
create or replace function public.sync_rental_booking_type()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  booking public.bookings%rowtype;
begin
  select * into booking from public.bookings
    where id = new.booking_id
      and tenant_id = new.tenant_id
      and property_id = new.property_id
    for update;
  if not found then
    raise exception 'HG-BOOK-404: Booking not found in this property';
  end if;
  if booking.booking_type not in ('standard', 'monthly') then
    raise exception 'HG-BOOK-422: Blocked and out-of-service rooms cannot become rentals';
  end if;
  -- Existing monthly contracts may still need bookkeeping after checkout.
  if booking.status in ('cancelled', 'checked_out') and
    (booking.booking_type <> 'monthly' or not exists (
      select 1 from public.rental_tenants where booking_id = new.booking_id
        and tenant_id = new.tenant_id and property_id = new.property_id
    )) then
    raise exception 'HG-BOOK-422: Only active bookings can become rentals';
  end if;
  if booking.booking_type <> 'monthly' then
    update public.bookings set booking_type = 'monthly'
      where id = booking.id and tenant_id = new.tenant_id and property_id = new.property_id;
    if not found then
      raise exception 'HG-AUTH-403: Cannot update this booking';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rental_tenants_booking_type on public.rental_tenants;
create trigger rental_tenants_booking_type
before insert or update on public.rental_tenants
for each row execute function public.sync_rental_booking_type();
