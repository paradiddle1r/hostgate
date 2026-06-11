-- =====================================================================
-- HostGate · Migration 04 — PMS foundation
-- =====================================================================
-- Tenant-scope helper, property codes, plan limits, per-user theme.
-- Applied to project xwikaqpdulkscdysgxri via Supabase MCP (apply_migration
-- name="pms_foundation"). Keep this file in sync with the live DB.
--
-- auth_tenant_ids() is the single chokepoint for RLS isolation: every PMS
-- table's policy is `tenant_id in (select auth_tenant_ids())`.
-- =====================================================================

-- Set of tenant_ids the caller belongs to. SECURITY DEFINER so RLS policies
-- can call it without recursive RLS on tenant_members.
create or replace function public.auth_tenant_ids()
returns setof uuid language sql stable security definer
set search_path = public, pg_temp as $$
  select tenant_id from public.tenant_members where user_id = auth.uid()
$$;
revoke execute on function public.auth_tenant_ids() from public, anon;
grant execute on function public.auth_tenant_ids() to authenticated, service_role;

-- Property code: UPPER(left(slug,4)) || '-' || NN, per-tenant sequence.
alter table public.properties add column if not exists code text;

create or replace function public.gen_property_code()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_prefix text; v_n int;
begin
  if new.code is not null then return new; end if;
  select upper(left(regexp_replace(t.slug,'[^a-z0-9]','','g'),4))
    into v_prefix from public.tenants t where t.id = new.tenant_id;
  v_prefix := coalesce(nullif(v_prefix,''), 'PROP');
  select count(*)+1 into v_n from public.properties where tenant_id = new.tenant_id;
  new.code := v_prefix || '-' || lpad(v_n::text, 2, '0');
  return new;
end $$;
drop trigger if exists trg_property_code on public.properties;
create trigger trg_property_code before insert on public.properties
  for each row execute function public.gen_property_code();

-- Plan limit: non-pro tenants get 1 property; pro gets 25.
create or replace function public.enforce_property_limit()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_plan text; v_count int; v_max int;
begin
  select plan into v_plan from public.tenants where id = new.tenant_id;
  v_max := case when v_plan = 'pro' then 25 else 1 end;
  select count(*) into v_count from public.properties where tenant_id = new.tenant_id;
  if v_count >= v_max then
    raise exception 'HG-PROP-403: property limit reached for plan %', v_plan
      using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_property_limit on public.properties;
create trigger trg_property_limit before insert on public.properties
  for each row execute function public.enforce_property_limit();

-- Per-user theme preference (glass variants are pro-gated in the UI).
alter table public.user_profiles add column if not exists theme text
  not null default 'light'
  check (theme in ('light','dark','light-glass','dark-glass'));

-- Backfill codes for any existing properties.
update public.properties p set code = sub.code from (
  select p2.id, upper(left(regexp_replace(t.slug,'[^a-z0-9]','','g'),4)) || '-' ||
         lpad(row_number() over (partition by p2.tenant_id order by p2.created_at)::text,2,'0') as code
  from public.properties p2 join public.tenants t on t.id = p2.tenant_id
) sub where p.id = sub.id and p.code is null;
alter table public.properties alter column code set not null;
create unique index if not exists properties_tenant_code_uniq on public.properties(tenant_id, code);
