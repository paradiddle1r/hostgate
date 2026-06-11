-- =====================================================================
-- HostGate · Migration 05 — Core PMS tables
-- =====================================================================
-- rooms / guests / bookings / daily_rates / error_log. Every table carries
-- tenant_id + property_id and is RLS-locked to `tenant_id in
-- (select auth_tenant_ids())`. Property↔tenant integrity, booking-conflict,
-- and booking-code generation are enforced by triggers (HG-* error codes).
-- Applied via MCP apply_migration name="pms_tables".
-- =====================================================================

-- Guard: the row's property_id must belong to the row's tenant_id.
create or replace function public.assert_property_in_tenant()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.properties
                 where id = new.property_id and tenant_id = new.tenant_id) then
    raise exception 'HG-PROP-404: property % not in tenant %', new.property_id, new.tenant_id
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  room_type_id uuid references public.room_types(id) on delete set null,
  number text not null,
  floor int not null default 1,
  status text not null default 'active' check (status in ('active','inactive')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (property_id, number)
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 200),
  phone text, email text, id_number text, nationality text, notes text,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  code text not null,
  room_id uuid references public.rooms(id) on delete set null,
  room_type_id uuid references public.room_types(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  guest_name text not null default 'Guest',
  phone text,
  check_in date not null,
  check_out date not null,
  status text not null default 'confirmed'
    check (status in ('pending','confirmed','checked_in','checked_out','cancelled')),
  source text not null default 'direct'
    check (source in ('direct','walk_in','ota','web')),
  adults int not null default 1, children int not null default 0,
  total_amount numeric, notes text,
  created_at timestamptz not null default now(),
  check (check_out > check_in)
);

create table public.daily_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  date date not null,
  price numeric not null,
  created_at timestamptz not null default now(),
  unique (room_type_id, date)
);

create table public.error_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid,
  code text not null, message text, context jsonb,
  created_at timestamptz not null default now()
);

-- property_id↔tenant_id guard on the property-scoped writable tables
create trigger trg_rooms_prop before insert or update on public.rooms
  for each row execute function public.assert_property_in_tenant();
create trigger trg_guests_prop before insert or update on public.guests
  for each row execute function public.assert_property_in_tenant();
create trigger trg_bookings_prop before insert or update on public.bookings
  for each row execute function public.assert_property_in_tenant();

-- Booking conflict guard: same room, overlapping [check_in,check_out), not cancelled.
create or replace function public.assert_no_room_conflict()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.room_id is null or new.status = 'cancelled' then return new; end if;
  if exists (
    select 1 from public.bookings b
    where b.room_id = new.room_id and b.id <> new.id
      and b.status <> 'cancelled'
      and b.check_in < new.check_out and b.check_out > new.check_in
  ) then
    raise exception 'HG-BOOK-409: room already booked for these dates'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_booking_conflict before insert or update on public.bookings
  for each row execute function public.assert_no_room_conflict();

-- Booking code: BK-<property code>-<NNNN> per property.
create or replace function public.gen_booking_code()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_prop text; v_n int;
begin
  if new.code is not null and new.code <> '' then return new; end if;
  select code into v_prop from public.properties where id = new.property_id;
  select count(*)+1 into v_n from public.bookings where property_id = new.property_id;
  new.code := 'BK-' || coalesce(v_prop,'PROP') || '-' || lpad(v_n::text,4,'0');
  return new;
end $$;
create trigger trg_booking_code before insert on public.bookings
  for each row execute function public.gen_booking_code();

-- RLS — every table scoped to the caller's tenants.
do $$ declare t text;
begin
  foreach t in array array['rooms','guests','bookings','daily_rates','error_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "%1$s_tenant_rw" on public.%1$I for all to authenticated
      using (tenant_id in (select auth_tenant_ids()))
      with check (tenant_id in (select auth_tenant_ids()))$p$, t);
  end loop;
end $$;

create index rooms_property_idx        on public.rooms(property_id);
create index rooms_type_idx            on public.rooms(room_type_id);
create index guests_property_idx       on public.guests(property_id);
create index guests_name_lc_idx        on public.guests(property_id, lower(full_name));
create index guests_phone_idx          on public.guests(property_id, phone);
create index bookings_property_idx     on public.bookings(property_id);
create index bookings_window_idx       on public.bookings(property_id, check_in, check_out);
create index bookings_room_idx         on public.bookings(room_id);
create unique index bookings_code_uniq on public.bookings(property_id, code);
create index daily_rates_lookup_idx    on public.daily_rates(room_type_id, date);
create index error_log_tenant_idx      on public.error_log(tenant_id, created_at desc);
