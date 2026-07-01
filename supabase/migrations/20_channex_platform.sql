-- =====================================================================
-- HostGate · Migration 20 — Channex channel-manager foundation + platform admin
-- =====================================================================
-- Everything needed to plug HostGate into Channex.io (channel manager):
--   • platform_admins        — who may use the admin console (admin.hostgate.app)
--   • channex_connections    — one row per property connected to Channex
--   • channex_room_type_map  — local room_type ↔ Channex room type
--   • channex_rate_plan_map  — local rate plan (nullable) ↔ Channex rate plan
--   • channex_bookings       — Channex booking id ↔ local booking rows
--   • channex_booking_revisions — the ingest inbox (feed + ack pattern)
--   • channex_webhook_events — raw webhook log (webhooks are unsigned pings)
--   • channex_ari_queue      — outbound availability/restriction batches
--   • channex_sync_log       — audit of every push/pull
--
-- Design notes (from docs.channex.io):
--   – Bookings MUST be ingested via the booking-revisions feed and each
--     revision MUST be acknowledged; webhooks are triggers, not the source.
--   – ARI pushes must be batched (values[]) and throttled (~20 req/min per
--     property) — hence the queue.
--   – Webhooks carry no HMAC: we authenticate with our own shared-secret
--     header, and re-fetch data from the API before trusting it.
--
-- All channex_* tables are PLATFORM tables: written only by the service
-- role (webhook/cron/admin actions). Tenants get read-only visibility into
-- their own connection status; platform admins (is_platform_admin()) can
-- read everything from the authenticated client too.
-- Applied via MCP name="channex_platform".
-- =====================================================================

-- ── platform admins ─────────────────────────────────────────────────────────
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- A user may see only their own row (lets the app ask "am I an admin?").
-- No insert/update/delete policies: writes are service-role only.
create policy "platform_admins_self_select" on public.platform_admins
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
-- Callable by any signed-in user (returns true/false for themselves only).
revoke execute on function public.is_platform_admin() from anon, public;

-- Seed: the platform owner (no-op if that auth user doesn't exist yet).
insert into public.platform_admins (user_id, email)
select id, email from auth.users where email = 'pornchailin@gmail.com'
on conflict (user_id) do nothing;

-- ── connections ─────────────────────────────────────────────────────────────
create table public.channex_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  environment text not null default 'staging' check (environment in ('staging','production')),
  channex_property_id text,
  channex_group_id text,
  channex_webhook_id text,
  status text not null default 'draft'
    check (status in ('draft','provisioned','live','error','disabled')),
  last_synced_at timestamptz,
  last_error text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, environment)
);
create trigger trg_channex_conn_prop before insert or update on public.channex_connections
  for each row execute function public.assert_property_in_tenant();
alter table public.channex_connections enable row level security;
-- Tenants see (not edit) their own connections; platform admins see all.
create policy "channex_connections_read" on public.channex_connections
  for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) or public.is_platform_admin());
create index channex_connections_tenant_idx on public.channex_connections(tenant_id);
create index channex_connections_chx_idx on public.channex_connections(channex_property_id);

-- ── room type / rate plan mapping ───────────────────────────────────────────
create table public.channex_room_type_map (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.channex_connections(id) on delete cascade,
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  channex_room_type_id text not null,
  created_at timestamptz not null default now(),
  unique (connection_id, room_type_id)
);
alter table public.channex_room_type_map enable row level security;
create policy "channex_rtm_read" on public.channex_room_type_map
  for select to authenticated
  using (public.is_platform_admin()
         or connection_id in (select id from public.channex_connections
                              where tenant_id in (select auth_tenant_ids())));
create index channex_rtm_conn_idx on public.channex_room_type_map(connection_id);

create table public.channex_rate_plan_map (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.channex_connections(id) on delete cascade,
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  rate_plan_id uuid references public.rate_plans(id) on delete set null,
  channex_rate_plan_id text not null,
  title text not null default 'BAR',
  occupancy int,
  created_at timestamptz not null default now(),
  unique (connection_id, channex_rate_plan_id)
);
alter table public.channex_rate_plan_map enable row level security;
create policy "channex_rpm_read" on public.channex_rate_plan_map
  for select to authenticated
  using (public.is_platform_admin()
         or connection_id in (select id from public.channex_connections
                              where tenant_id in (select auth_tenant_ids())));
create index channex_rpm_conn_idx on public.channex_rate_plan_map(connection_id);

-- ── bookings link ───────────────────────────────────────────────────────────
create table public.channex_bookings (
  channex_booking_id text primary key,
  connection_id uuid not null references public.channex_connections(id) on delete cascade,
  unique_id text,                      -- OTA reservation code, e.g. BDC-123456789
  ota_name text,
  status text,                         -- latest applied revision status
  local_booking_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.channex_bookings enable row level security;
create policy "channex_bookings_read" on public.channex_bookings
  for select to authenticated
  using (public.is_platform_admin()
         or connection_id in (select id from public.channex_connections
                              where tenant_id in (select auth_tenant_ids())));
create index channex_bookings_conn_idx on public.channex_bookings(connection_id);

-- ── booking revisions inbox (feed + ack) ────────────────────────────────────
create table public.channex_booking_revisions (
  id text primary key,                 -- Channex revision id
  connection_id uuid references public.channex_connections(id) on delete set null,
  channex_booking_id text,
  channex_property_id text,
  status text,                         -- new | modified | cancelled
  ota_name text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  acked_at timestamptz,
  applied boolean not null default false,
  applied_at timestamptz,
  error text
);
alter table public.channex_booking_revisions enable row level security;
create policy "channex_revisions_read" on public.channex_booking_revisions
  for select to authenticated
  using (public.is_platform_admin()
         or connection_id in (select id from public.channex_connections
                              where tenant_id in (select auth_tenant_ids())));
create index channex_revisions_booking_idx on public.channex_booking_revisions(channex_booking_id);
create index channex_revisions_conn_idx on public.channex_booking_revisions(connection_id, received_at desc);
create index channex_revisions_pending_idx on public.channex_booking_revisions(applied) where not applied;

-- ── raw webhook events ──────────────────────────────────────────────────────
create table public.channex_webhook_events (
  id bigint generated always as identity primary key,
  event text not null,
  channex_property_id text,
  payload jsonb,
  processed boolean not null default false,
  error text,
  received_at timestamptz not null default now()
);
alter table public.channex_webhook_events enable row level security;
create policy "channex_events_admin_read" on public.channex_webhook_events
  for select to authenticated using (public.is_platform_admin());
create index channex_events_recent_idx on public.channex_webhook_events(received_at desc);

-- ── outbound ARI queue ──────────────────────────────────────────────────────
-- Each row = one pending batch item; the flusher groups pending rows per
-- connection into ONE availability call + ONE restrictions call (Channex
-- certification requires batching; ~20 req/min/property limit).
create table public.channex_ari_queue (
  id bigint generated always as identity primary key,
  connection_id uuid not null references public.channex_connections(id) on delete cascade,
  kind text not null check (kind in ('availability','restrictions')),
  payload jsonb not null,              -- one Channex "values" entry
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.channex_ari_queue enable row level security;
create policy "channex_ari_admin_read" on public.channex_ari_queue
  for select to authenticated using (public.is_platform_admin());
create index channex_ari_pending_idx on public.channex_ari_queue(connection_id, status)
  where status = 'pending';

-- ── sync audit log ──────────────────────────────────────────────────────────
create table public.channex_sync_log (
  id bigint generated always as identity primary key,
  connection_id uuid references public.channex_connections(id) on delete set null,
  direction text not null check (direction in ('push','pull')),
  operation text not null,             -- e.g. provision, availability, restrictions, revision_apply
  ok boolean not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table public.channex_sync_log enable row level security;
create policy "channex_sync_log_read" on public.channex_sync_log
  for select to authenticated
  using (public.is_platform_admin()
         or connection_id in (select id from public.channex_connections
                              where tenant_id in (select auth_tenant_ids())));
create index channex_sync_log_recent_idx on public.channex_sync_log(created_at desc);

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger trg_channex_conn_touch before update on public.channex_connections
  for each row execute function public.touch_updated_at();
create trigger trg_channex_bookings_touch before update on public.channex_bookings
  for each row execute function public.touch_updated_at();
