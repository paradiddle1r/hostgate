-- =====================================================================
-- HostGate · Migration 13 — Phase G: Admin (members, roles, activity)
-- =====================================================================
-- An activity_log (tenant-scoped audit trail) and SECURITY DEFINER member-
-- management functions (add by email / set role / remove) with owner/admin
-- authorisation and last-owner protection. Idempotent. Applied via MCP
-- apply_migration name="phase_g_admin".
-- =====================================================================

-- ── activity_log ─────────────────────────────────────────────────────────────
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  actor_id    uuid references public.user_profiles(id) on delete set null,
  action      text not null,                 -- e.g. 'member.add', 'sale.create'
  entity      text,                          -- e.g. 'booking', 'invoice'
  entity_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
alter table public.activity_log enable row level security;
drop policy if exists "activity_log_tenant_rw" on public.activity_log;
create policy "activity_log_tenant_rw" on public.activity_log for all to authenticated
  using (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));
create index if not exists activity_log_tenant_idx on public.activity_log(tenant_id, created_at desc);

-- ── member management (owner/admin only, last-owner protected) ────────────────
create or replace function public.app_add_member_by_email(p_tenant uuid, p_email text, p_role text)
returns uuid language plpgsql security definer
set search_path = public, auth, pg_temp as $$
declare v_uid uuid;
begin
  if not exists (select 1 from public.tenant_members
                 where tenant_id = p_tenant and user_id = auth.uid() and role in ('owner','admin')) then
    raise exception 'HG-AUTH-403: only an owner or admin can add members' using errcode = 'P0001';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'HG-VALIDATION-422: no account with that email — ask them to sign up first' using errcode = 'P0001';
  end if;
  if p_role not in ('owner','admin','staff') then p_role := 'staff'; end if;
  insert into public.tenant_members (tenant_id, user_id, role)
  values (p_tenant, v_uid, p_role)
  on conflict (tenant_id, user_id) do update set role = excluded.role;
  return v_uid;
end $$;
revoke all on function public.app_add_member_by_email(uuid, text, text) from public, anon;
grant execute on function public.app_add_member_by_email(uuid, text, text) to authenticated, service_role;

create or replace function public.app_set_member_role(p_tenant uuid, p_user uuid, p_role text)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_owner_count int;
begin
  if not exists (select 1 from public.tenant_members
                 where tenant_id = p_tenant and user_id = auth.uid() and role in ('owner','admin')) then
    raise exception 'HG-AUTH-403: only an owner or admin can change roles' using errcode = 'P0001';
  end if;
  if p_role not in ('owner','admin','staff') then
    raise exception 'HG-VALIDATION-422: invalid role' using errcode = 'P0001';
  end if;
  if p_role <> 'owner' then
    select count(*) into v_owner_count from public.tenant_members where tenant_id = p_tenant and role = 'owner';
    if v_owner_count <= 1 and exists (select 1 from public.tenant_members
        where tenant_id = p_tenant and user_id = p_user and role = 'owner') then
      raise exception 'HG-VALIDATION-422: cannot demote the last owner' using errcode = 'P0001';
    end if;
  end if;
  update public.tenant_members set role = p_role where tenant_id = p_tenant and user_id = p_user;
end $$;
revoke all on function public.app_set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.app_set_member_role(uuid, uuid, text) to authenticated, service_role;

create or replace function public.app_remove_member(p_tenant uuid, p_user uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_owner_count int;
begin
  if not exists (select 1 from public.tenant_members
                 where tenant_id = p_tenant and user_id = auth.uid() and role in ('owner','admin')) then
    raise exception 'HG-AUTH-403: only an owner or admin can remove members' using errcode = 'P0001';
  end if;
  select count(*) into v_owner_count from public.tenant_members where tenant_id = p_tenant and role = 'owner';
  if v_owner_count <= 1 and exists (select 1 from public.tenant_members
      where tenant_id = p_tenant and user_id = p_user and role = 'owner') then
    raise exception 'HG-VALIDATION-422: cannot remove the last owner' using errcode = 'P0001';
  end if;
  delete from public.tenant_members where tenant_id = p_tenant and user_id = p_user;
end $$;
revoke all on function public.app_remove_member(uuid, uuid) from public, anon;
grant execute on function public.app_remove_member(uuid, uuid) to authenticated, service_role;

-- =====================================================================
-- End of migration 13
-- =====================================================================
