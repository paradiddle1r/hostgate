-- =====================================================================
-- HostGate · Migration 10 — Phase D: Monthly rentals
-- =====================================================================
-- Monthly tenants layered on top of bookings: a rental_tenants rate-config
-- row per booking, meter_readings (electric/water), per-month rental_bills,
-- and rental_contracts. Open-ended leases use the check_out sentinel
-- 2099-12-31. Numbering via next_rental_number() (BILL-/CT- per property/year).
-- Every table is tenant_id+property_id scoped, RLS-locked, guarded by
-- assert_property_in_tenant. Idempotent. Applied via MCP apply_migration
-- name="phase_d_rentals".
-- =====================================================================

-- ── rental_tenants (rate config, one per booking) ────────────────────────────
create table if not exists public.rental_tenants (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  booking_id    uuid not null unique references public.bookings(id) on delete cascade,
  monthly_rent  numeric(12,2) not null default 0,
  deposit       numeric(12,2) not null default 0,
  advance_rent  numeric(12,2) not null default 0,
  electric_rate numeric(10,2) not null default 0,   -- per unit
  water_rate    numeric(10,2) not null default 0,   -- per unit
  other_fees    numeric(12,2) not null default 0,
  occupants     int not null default 1,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ── meter_readings (cumulative electric/water per date) ──────────────────────
create table if not exists public.meter_readings (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  reading_date date not null,
  electric     numeric(12,2),
  water        numeric(12,2),
  note         text,
  created_at   timestamptz not null default now()
);

-- ── rental_bills (per-month statement) ───────────────────────────────────────
create table if not exists public.rental_bills (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  property_id     uuid not null references public.properties(id) on delete cascade,
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  number          text,
  period_month    date not null,                    -- first day of the month
  rent            numeric(12,2) not null default 0,
  electric_units  numeric(12,2) not null default 0,
  electric_amount numeric(12,2) not null default 0,
  water_units     numeric(12,2) not null default 0,
  water_amount    numeric(12,2) not null default 0,
  other           numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  status          text not null default 'draft' check (status in ('draft','issued','paid')),
  invoice_id      uuid references public.invoices(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (booking_id, period_month)
);

-- ── rental_contracts ─────────────────────────────────────────────────────────
create table if not exists public.rental_contracts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  number        text,
  status        text not null default 'draft' check (status in ('draft','issued')),
  start_date    date,
  end_date      date,
  monthly_rent  numeric(12,2) not null default 0,
  deposit       numeric(12,2) not null default 0,
  landlord_name text,
  tenant_name   text,
  body_th       text,
  body_en       text,
  created_at    timestamptz not null default now()
);

-- ── numbering: BILL-<year>-NNNN / CT-<year>-NNNN per property ─────────────────
create table if not exists public.rental_counters (
  property_id uuid not null references public.properties(id) on delete cascade,
  year        int not null,
  kind        text not null,
  seq         int not null default 0,
  primary key (property_id, year, kind)
);
alter table public.rental_counters enable row level security;
-- no policy: service-role / SECURITY DEFINER only

create or replace function public.next_rental_number(p_property uuid, p_kind text)
returns text language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_year int := extract(year from (now() at time zone 'Asia/Bangkok'))::int;
  v_seq  int;
  v_prefix text := case p_kind when 'contract' then 'CT' else 'BILL' end;
begin
  insert into public.rental_counters (property_id, year, kind, seq)
  values (p_property, v_year, p_kind, 1)
  on conflict (property_id, year, kind)
    do update set seq = public.rental_counters.seq + 1
  returning seq into v_seq;
  return v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end $$;
revoke all on function public.next_rental_number(uuid, text) from public, anon;
grant execute on function public.next_rental_number(uuid, text) to authenticated, service_role;

-- ── property↔tenant guards ───────────────────────────────────────────────────
do $$ declare t text;
begin
  foreach t in array array['rental_tenants','meter_readings','rental_bills','rental_contracts'] loop
    execute format('drop trigger if exists trg_%1$s_prop on public.%1$I', t);
    execute format('create trigger trg_%1$s_prop before insert or update on public.%1$I
      for each row execute function public.assert_property_in_tenant()', t);
  end loop;
end $$;

-- ── RLS — tenant-scoped read/write ───────────────────────────────────────────
do $$ declare t text;
begin
  foreach t in array array['rental_tenants','meter_readings','rental_bills','rental_contracts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_tenant_rw" on public.%1$I', t);
    execute format($p$create policy "%1$s_tenant_rw" on public.%1$I for all to authenticated
      using (tenant_id in (select auth_tenant_ids()))
      with check (tenant_id in (select auth_tenant_ids()))$p$, t);
  end loop;
end $$;

create index if not exists rental_tenants_property_idx on public.rental_tenants(property_id);
create index if not exists meter_readings_booking_idx   on public.meter_readings(booking_id, reading_date desc);
create index if not exists rental_bills_booking_idx     on public.rental_bills(booking_id, period_month desc);
create index if not exists rental_bills_property_idx     on public.rental_bills(property_id, status);
create index if not exists rental_contracts_booking_idx  on public.rental_contracts(booking_id);

-- =====================================================================
-- End of migration 10
-- =====================================================================
