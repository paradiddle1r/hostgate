-- =====================================================================
-- HostGate · Migration 15 — Parity foundation (additive schema)
-- =====================================================================
-- Adds every column + table the hotel-pms feature parity needs. STRICTLY
-- ADDITIVE: new nullable columns + new tables with RLS — nothing dropped or
-- altered, so existing functionality is unaffected. Idempotent. Applied via
-- MCP apply_migration name="parity_foundation".
-- =====================================================================

-- ── bookings: front-desk depth (booking types, OTA, payments, identity) ──────
alter table public.bookings
  add column if not exists booking_type text not null default 'standard'
    check (booking_type in ('standard','monthly','blocked','oos')),
  add column if not exists issue_type text,
  add column if not exists issue_detail text,
  add column if not exists reservation_no text,
  add column if not exists ota text,
  add column if not exists booked_date date,
  add column if not exists payment_method text,
  add column if not exists amount_paid numeric(12,2) not null default 0,
  add column if not exists deposit_date date,
  add column if not exists deposit_method text,
  add column if not exists reservation_deposit numeric(12,2),
  add column if not exists extra_bed boolean not null default false,
  add column if not exists extra_bed_charge numeric(12,2),
  add column if not exists booking_group_id uuid,
  add column if not exists guest_first_name text,
  add column if not exists guest_last_name text,
  add column if not exists thai_name text,
  add column if not exists car_plate text,
  add column if not exists is_open_ended boolean not null default false,
  add column if not exists checkin_time timestamptz,
  add column if not exists checkout_time timestamptz,
  add column if not exists citizen_id text,
  add column if not exists id_dob date,
  add column if not exists id_gender text,
  add column if not exists id_issued_date date,
  add column if not exists id_expires_date date,
  add column if not exists id_address text,
  add column if not exists id_photo_path text;
create index if not exists bookings_group_idx on public.bookings(booking_group_id);
create index if not exists bookings_type_idx  on public.bookings(property_id, booking_type);

-- ── guests: CRM depth (Thai name, car plate, prefs, tags, Thai-ID block) ─────
alter table public.guests
  add column if not exists thai_name text,
  add column if not exists car_plate text,
  add column if not exists preferences text,
  add column if not exists blacklist_reason text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists citizen_id text,
  add column if not exists id_dob date,
  add column if not exists id_gender text,
  add column if not exists id_issued_date date,
  add column if not exists id_expires_date date,
  add column if not exists id_address text,
  add column if not exists id_photo_path text,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists guests_carplate_idx on public.guests(property_id, car_plate);

-- ── invoices: full Thai B2B tax-invoice bill-to + void/discount ──────────────
alter table public.invoices
  add column if not exists guest_company_name text,
  add column if not exists guest_company_name_th text,
  add column if not exists guest_branch text,
  add column if not exists guest_address_th text,
  add column if not exists guest_phone text,
  add column if not exists guest_email text,
  add column if not exists due_date date,
  add column if not exists footer text,
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists vat_inclusive boolean,
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz;
alter table public.payments
  add column if not exists reference text;

-- ── properties: company identity, Thai mirror, structured address, landlord ──
alter table public.properties
  add column if not exists logo_url text,
  add column if not exists legal_name_th text,
  add column if not exists trading_name text,
  add column if not exists trading_name_th text,
  add column if not exists branch text,
  add column if not exists branch_th text,
  add column if not exists registration_no text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists subdistrict text,
  add column if not exists district text,
  add column if not exists province text,
  add column if not exists postal_code text,
  add column if not exists address_line1_th text,
  add column if not exists address_line2_th text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists bank_branch text,
  add column if not exists bank_account_name text,
  add column if not exists default_paper_size text not null default 'A4',
  add column if not exists default_print_mode text not null default 'invoice',
  add column if not exists landlord_name text,
  add column if not exists landlord_name_th text,
  add column if not exists landlord_company text,
  add column if not exists landlord_company_th text,
  add column if not exists landlord_tax_id text,
  add column if not exists landlord_address text,
  add column if not exists landlord_address_th text,
  add column if not exists landlord_phone text;

-- ── rooms: monthly-available flag ────────────────────────────────────────────
alter table public.rooms
  add column if not exists monthly_available boolean not null default false;

-- ── rate_plans: description + per-room-type rates child table ─────────────────
alter table public.rate_plans
  add column if not exists description text;

create table if not exists public.rate_plan_rates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  rate_plan_id  uuid not null references public.rate_plans(id) on delete cascade,
  room_type_id  uuid not null references public.room_types(id) on delete cascade,
  price         numeric(12,2) not null default 0,
  created_at    timestamptz not null default now(),
  unique (rate_plan_id, room_type_id)
);

-- ── housekeeping: due_date + created_by + realtime publication ───────────────
alter table public.housekeeping_tasks
  add column if not exists due_date date not null default current_date,
  add column if not exists created_by uuid references public.user_profiles(id) on delete set null;
create index if not exists housekeeping_due_idx on public.housekeeping_tasks(property_id, due_date);
-- publish for realtime (idempotent guard)
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='housekeeping_tasks'
  ) then
    alter publication supabase_realtime add table public.housekeeping_tasks;
  end if;
end $$;

-- ── maintenance: issue-type taxonomy ─────────────────────────────────────────
alter table public.maintenance_orders
  add column if not exists issue_type text
    check (issue_type is null or issue_type in ('water','electricity','air-conditioner','furniture','toilet','other'));

-- ── rental_tenants: full fee model ───────────────────────────────────────────
alter table public.rental_tenants
  add column if not exists water_minimum_charge numeric(12,2) not null default 0,
  add column if not exists internet_fee numeric(12,2) not null default 0,
  add column if not exists parking_fee numeric(12,2) not null default 0,
  add column if not exists billing_day int not null default 1,
  add column if not exists start_meter_electric numeric(12,2),
  add column if not exists start_meter_water numeric(12,2),
  add column if not exists other_charges jsonb not null default '[]';

-- ── rental_bills: period range + meter snapshots + structured charges ────────
alter table public.rental_bills
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists electric_prev numeric(12,2),
  add column if not exists electric_curr numeric(12,2),
  add column if not exists electric_rate numeric(10,2) not null default 0,
  add column if not exists water_prev numeric(12,2),
  add column if not exists water_curr numeric(12,2),
  add column if not exists water_rate numeric(10,2) not null default 0,
  add column if not exists internet_amount numeric(12,2) not null default 0,
  add column if not exists parking_amount numeric(12,2) not null default 0,
  add column if not exists other_charges jsonb not null default '[]',
  add column if not exists subtotal numeric(12,2) not null default 0;

-- ── rental_contracts: structured legal fields ────────────────────────────────
alter table public.rental_contracts
  add column if not exists landlord_address text,
  add column if not exists landlord_tax_id text,
  add column if not exists tenant_address text,
  add column if not exists tenant_citizen_id text,
  add column if not exists furniture_rent numeric(12,2) not null default 0,
  add column if not exists common_area_fee numeric(12,2) not null default 0,
  add column if not exists internet_fee numeric(12,2) not null default 0,
  add column if not exists parking_fee numeric(12,2) not null default 0,
  add column if not exists payment_due_day int not null default 1,
  add column if not exists notice_period_days int not null default 30,
  add column if not exists language text not null default 'th',
  add column if not exists witnesses jsonb not null default '[]',
  add column if not exists terminated_at date,
  add column if not exists terminated_reason text;

-- ── pos: stock levels, images, void, movements ───────────────────────────────
alter table public.pos_products
  add column if not exists low_stock_threshold int not null default 0,
  add column if not exists image_url text;
alter table public.pos_sales
  add column if not exists voided boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists subtotal numeric(12,2),
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists cash_received numeric(12,2),
  add column if not exists change_given numeric(12,2);

create table if not exists public.pos_stock_movements (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  product_id  uuid references public.pos_products(id) on delete set null,
  type        text not null check (type in ('in','sale','adjustment','void')),
  qty         numeric(12,2) not null default 0,
  reason      text,
  created_by  uuid references public.user_profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── tenant_members: staff position + active/disable ──────────────────────────
alter table public.tenant_members
  add column if not exists position text,
  add column if not exists is_active boolean not null default true;

-- ── activity_log: human summary + actor role ─────────────────────────────────
alter table public.activity_log
  add column if not exists summary text,
  add column if not exists actor_role text;

-- ── user_profiles: per-user prefs (font size, time format) ───────────────────
alter table public.user_profiles
  add column if not exists font_size text not null default 'normal',
  add column if not exists time_format text not null default '24h';

-- ── NEW: notes (team sticky notes) ───────────────────────────────────────────
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  author_id   uuid references public.user_profiles(id) on delete set null,
  body        text not null default '',
  color       text not null default 'yellow',
  pinned      boolean not null default false,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── NEW: announcements (pinned banner) ───────────────────────────────────────
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  author_id   uuid references public.user_profiles(id) on delete set null,
  title       text not null default '',
  body        text not null default '',
  severity    text not null default 'info' check (severity in ('info','warning','critical')),
  is_pinned   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── NEW: monthly_room_types (per-type monthly config + photos) ───────────────
create table if not exists public.monthly_room_types (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  property_id     uuid not null references public.properties(id) on delete cascade,
  room_type_id    uuid not null references public.room_types(id) on delete cascade,
  display_name_th text,
  display_name_en text,
  monthly_rent    numeric(12,2) not null default 0,
  deposit         numeric(12,2) not null default 0,
  advance_rent    numeric(12,2) not null default 0,
  electric_rate   numeric(10,2) not null default 0,
  water_rate      numeric(10,2) not null default 0,
  internet_fee    numeric(12,2) not null default 0,
  parking_fee     numeric(12,2) not null default 0,
  photos          jsonb not null default '[]',
  amenities       text[] not null default '{}',
  created_at      timestamptz not null default now(),
  unique (room_type_id)
);

-- ── guards + RLS + indexes for the new property-scoped tables ────────────────
do $$ declare t text;
begin
  foreach t in array array['rate_plan_rates','pos_stock_movements','notes','announcements','monthly_room_types'] loop
    execute format('drop trigger if exists trg_%1$s_prop on public.%1$I', t);
    execute format('create trigger trg_%1$s_prop before insert or update on public.%1$I
      for each row execute function public.assert_property_in_tenant()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_tenant_rw" on public.%1$I', t);
    execute format($p$create policy "%1$s_tenant_rw" on public.%1$I for all to authenticated
      using (tenant_id in (select auth_tenant_ids())) with check (tenant_id in (select auth_tenant_ids()))$p$, t);
  end loop;
end $$;

create index if not exists rate_plan_rates_plan_idx     on public.rate_plan_rates(rate_plan_id);
create index if not exists pos_stock_movements_prod_idx on public.pos_stock_movements(product_id, created_at desc);
create index if not exists pos_stock_movements_prop_idx on public.pos_stock_movements(property_id, created_at desc);
create index if not exists notes_property_idx           on public.notes(property_id, pinned, created_at desc);
create index if not exists announcements_property_idx   on public.announcements(property_id, is_pinned, created_at desc);
create index if not exists monthly_room_types_prop_idx  on public.monthly_room_types(property_id);

-- =====================================================================
-- End of migration 15
-- =====================================================================
