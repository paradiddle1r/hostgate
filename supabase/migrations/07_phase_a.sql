-- =====================================================================
-- HostGate · Migration 07 — Phase A (front-desk depth)
-- =====================================================================
-- Guest VIP/blacklist flags + rate plans (named pricing presets) + the
-- daily_rates → rate_plan link with a cascade-on-edit trigger.
-- Applied via MCP name="phase_a_guest_flags_rate_plans".
-- =====================================================================

alter table public.guests add column if not exists is_vip boolean not null default false;
alter table public.guests add column if not exists is_blacklisted boolean not null default false;

create table public.rate_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  daily_rate numeric,
  color text not null default '#0a84ff',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create trigger trg_rate_plans_prop before insert or update on public.rate_plans
  for each row execute function public.assert_property_in_tenant();
alter table public.rate_plans enable row level security;
create policy "rate_plans_tenant_rw" on public.rate_plans for all to authenticated
  using (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));
create index rate_plans_property_idx on public.rate_plans(property_id);
create index rate_plans_tenant_idx   on public.rate_plans(tenant_id);

alter table public.daily_rates add column if not exists plan_id uuid
  references public.rate_plans(id) on delete set null;
create index if not exists daily_rates_plan_idx on public.daily_rates(plan_id);

create or replace function public.sync_daily_rates_from_plan()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.daily_rate is distinct from old.daily_rate then
    update public.daily_rates set price = new.daily_rate
    where plan_id = new.id and new.daily_rate is not null;
  end if;
  return new;
end $$;
revoke execute on function public.sync_daily_rates_from_plan() from anon, authenticated, public;
create trigger trg_sync_daily_rates after update on public.rate_plans
  for each row execute function public.sync_daily_rates_from_plan();
