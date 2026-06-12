-- =====================================================================
-- HostGate · Migration 09 — Phase C: Operations
-- =====================================================================
-- Housekeeping task queue, staff shifts, and maintenance / out-of-service
-- orders. Every table carries tenant_id + property_id, is RLS-locked to
-- `tenant_id in (select auth_tenant_ids())`, and passes the
-- assert_property_in_tenant guard. A checkout → cleaning-task trigger mirrors
-- hotel-pms. Plus a shared SECURITY DEFINER member-directory function (reused
-- by Phase G) since user_profiles is self-select-only under RLS.
-- Applied via MCP apply_migration name="phase_c_operations".
-- =====================================================================

-- ---------------------------------------------------------------------
-- Shared: list a tenant's members with their display name + email.
-- user_profiles RLS is self-only, so staff dropdowns need this definer fn.
-- Guarded: the caller must belong to the tenant they ask about.
-- ---------------------------------------------------------------------
create or replace function public.app_tenant_members(p_tenant uuid)
returns table (user_id uuid, display_name text, email text, role text)
language sql security definer set search_path = public, auth, pg_temp stable as $$
  select tm.user_id, up.display_name, u.email::text, tm.role
  from public.tenant_members tm
  join public.user_profiles up on up.id = tm.user_id
  left join auth.users u on u.id = tm.user_id
  where tm.tenant_id = p_tenant
    and p_tenant in (select public.auth_tenant_ids())
  order by case tm.role when 'owner' then 0 when 'admin' then 1 else 2 end, up.display_name;
$$;
revoke all on function public.app_tenant_members(uuid) from public, anon;
grant execute on function public.app_tenant_members(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- housekeeping_tasks
-- ---------------------------------------------------------------------
create table public.housekeeping_tasks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  booking_id  uuid references public.bookings(id) on delete set null,
  task_type   text not null default 'checkout-clean'
    check (task_type in ('checkout-clean','daily-clean','deep-clean','inspection',
                         'linen','turndown','maintenance-prep','other')),
  status      text not null default 'dirty'
    check (status in ('dirty','in-progress','clean','inspected','skipped')),
  priority    text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  notes       text,
  assigned_to  uuid references public.user_profiles(id) on delete set null,
  started_at   timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.user_profiles(id) on delete set null,
  inspected_at timestamptz,
  inspected_by uuid references public.user_profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
-- one open checkout-clean per booking (idempotent auto-create)
create unique index housekeeping_booking_type_uniq
  on public.housekeeping_tasks(booking_id, task_type)
  where booking_id is not null;

create trigger trg_housekeeping_prop before insert or update on public.housekeeping_tasks
  for each row execute function public.assert_property_in_tenant();

-- ---------------------------------------------------------------------
-- shift_assignments
-- ---------------------------------------------------------------------
create table public.shift_assignments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  member_id   uuid not null references public.user_profiles(id) on delete cascade,
  work_date   date not null,
  shift_type  text not null default 'day' check (shift_type in ('day','night','custom')),
  start_time  time,
  end_time    time,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (property_id, member_id, work_date, shift_type)
);
create trigger trg_shift_prop before insert or update on public.shift_assignments
  for each row execute function public.assert_property_in_tenant();

-- ---------------------------------------------------------------------
-- maintenance_orders  (OOS + repair tracking)
-- ---------------------------------------------------------------------
create table public.maintenance_orders (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  room_id      uuid references public.rooms(id) on delete set null,
  title        text not null check (char_length(title) between 1 and 200),
  description  text,
  status       text not null default 'open' check (status in ('open','in-progress','resolved')),
  priority     text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  cost          numeric(12,2),
  revenue_lost  numeric(12,2),
  oos_from      date,
  oos_to        date,
  reported_at  timestamptz not null default now(),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create trigger trg_maint_prop before insert or update on public.maintenance_orders
  for each row execute function public.assert_property_in_tenant();

-- ---------------------------------------------------------------------
-- Auto-create a checkout-clean task when a booking flips to checked_out.
-- Idempotent via the (booking_id, task_type) unique index.
-- ---------------------------------------------------------------------
create or replace function public.housekeeping_on_checkout()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.status = 'checked_out' and coalesce(old.status,'') <> 'checked_out'
     and new.room_id is not null then
    insert into public.housekeeping_tasks
      (tenant_id, property_id, room_id, booking_id, task_type, status, priority)
    values (new.tenant_id, new.property_id, new.room_id, new.id,
            'checkout-clean', 'dirty', 'high')
    on conflict (booking_id, task_type) where booking_id is not null do nothing;
  end if;
  return new;
end $$;
create trigger trg_housekeeping_on_checkout after update on public.bookings
  for each row execute function public.housekeeping_on_checkout();

-- ---------------------------------------------------------------------
-- RLS — tenant-scoped read/write on all three.
-- ---------------------------------------------------------------------
do $$ declare t text;
begin
  foreach t in array array['housekeeping_tasks','shift_assignments','maintenance_orders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "%1$s_tenant_rw" on public.%1$I for all to authenticated
      using (tenant_id in (select auth_tenant_ids()))
      with check (tenant_id in (select auth_tenant_ids()))$p$, t);
  end loop;
end $$;

create index housekeeping_property_idx on public.housekeeping_tasks(property_id, status);
create index housekeeping_room_idx     on public.housekeeping_tasks(room_id);
create index housekeeping_assigned_idx on public.housekeeping_tasks(assigned_to);
create index shift_property_date_idx   on public.shift_assignments(property_id, work_date);
create index shift_member_idx          on public.shift_assignments(member_id);
create index maint_property_idx        on public.maintenance_orders(property_id, status);
create index maint_room_idx            on public.maintenance_orders(room_id);

-- =====================================================================
-- End of migration 09
-- =====================================================================
