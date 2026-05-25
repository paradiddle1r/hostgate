-- =====================================================================
-- HostGate · Migration 01 — Auth profiles, tenants, properties, rooms
-- =====================================================================
-- Adds the multi-tenant foundation:
--   user_profiles    — one row per auth.users, auto-populated
--   tenants          — customer organisation / account
--   tenant_members   — who belongs to which tenant + role
--   properties       — physical hotel / apartment / resort
--   room_types       — categories of rooms within a property, with qty
--
-- Onboarding flow check: a logged-in user with zero tenant_members rows
-- is a fresh signup → send to wizard. Otherwise send to their tenant.
--
-- All tables RLS-locked. Reads/writes flow through tenant_members.
-- =====================================================================

-- ---------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  avatar_url        text,
  locale            text not null default 'th' check (locale in ('th','en')),
  marketing_optin   boolean not null default false,
  created_at        timestamptz not null default now(),
  last_active_at    timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "profile self select"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "profile self upsert"
  on public.user_profiles for insert
  with check (auth.uid() = id);

create policy "profile self update"
  on public.user_profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth.users row is inserted.
-- Pulls display_name/avatar from the OAuth metadata when available.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------
create table if not exists public.tenants (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 200),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  plan         text not null default 'trial' check (plan in ('trial','standard','pro')),
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index if not exists tenants_created_by_idx on public.tenants(created_by);


-- ---------------------------------------------------------------------
-- tenant_members
-- ---------------------------------------------------------------------
create table if not exists public.tenant_members (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner','admin','staff')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index if not exists tenant_members_user_idx on public.tenant_members(user_id);


-- ---------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------
create table if not exists public.properties (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 200),
  property_type   text not null check (property_type in ('daily','monthly','both')),
  address         text,
  city            text,
  country         text not null default 'TH',
  currency        text not null default 'THB' check (char_length(currency) = 3),
  timezone        text not null default 'Asia/Bangkok',
  created_at      timestamptz not null default now()
);

create index if not exists properties_tenant_idx on public.properties(tenant_id);


-- ---------------------------------------------------------------------
-- room_types
-- ---------------------------------------------------------------------
create table if not exists public.room_types (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  quantity      int  not null check (quantity between 0 and 1000),
  stay_kind     text not null check (stay_kind in ('daily','monthly')),
  daily_rate    numeric(10,2),
  monthly_rate  numeric(12,2),
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists room_types_property_idx on public.room_types(property_id);


-- ---------------------------------------------------------------------
-- RLS: tenants visible only via tenant_members
-- ---------------------------------------------------------------------
alter table public.tenants        enable row level security;
alter table public.tenant_members enable row level security;
alter table public.properties     enable row level security;
alter table public.room_types     enable row level security;

-- Helper: is `auth.uid()` a member of `t`?
create or replace function public.is_tenant_member(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = t and user_id = auth.uid()
  );
$$;

-- tenants
create policy "tenant member can read"
  on public.tenants for select
  using (public.is_tenant_member(id));

create policy "any auth user can create tenant"
  on public.tenants for insert
  with check (auth.uid() = created_by);

create policy "owner can update tenant"
  on public.tenants for update
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_id = tenants.id and user_id = auth.uid() and role = 'owner'
    )
  );

-- tenant_members
create policy "see my memberships"
  on public.tenant_members for select
  using (user_id = auth.uid() or public.is_tenant_member(tenant_id));

create policy "creator inserts first owner"
  on public.tenant_members for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = tenant_members.tenant_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner','admin')
    )
  );

create policy "owner can remove members"
  on public.tenant_members for delete
  using (
    exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = tenant_members.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- properties
create policy "tenant member reads properties"
  on public.properties for select
  using (public.is_tenant_member(tenant_id));

create policy "tenant member writes properties"
  on public.properties for insert
  with check (public.is_tenant_member(tenant_id));

create policy "tenant member updates properties"
  on public.properties for update
  using (public.is_tenant_member(tenant_id));

create policy "tenant owner deletes properties"
  on public.properties for delete
  using (
    exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = properties.tenant_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner','admin')
    )
  );

-- room_types — gated through the property's tenant
create policy "room_types read"
  on public.room_types for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = room_types.property_id
        and public.is_tenant_member(p.tenant_id)
    )
  );

create policy "room_types write"
  on public.room_types for insert
  with check (
    exists (
      select 1 from public.properties p
      where p.id = room_types.property_id
        and public.is_tenant_member(p.tenant_id)
    )
  );

create policy "room_types update"
  on public.room_types for update
  using (
    exists (
      select 1 from public.properties p
      where p.id = room_types.property_id
        and public.is_tenant_member(p.tenant_id)
    )
  );

create policy "room_types delete"
  on public.room_types for delete
  using (
    exists (
      select 1 from public.properties p
      where p.id = room_types.property_id
        and public.is_tenant_member(p.tenant_id)
    )
  );

-- =====================================================================
-- End of migration 01
-- =====================================================================
