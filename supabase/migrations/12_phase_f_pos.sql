-- =====================================================================
-- HostGate · Migration 12 — Phase F: Mini-bar POS
-- =====================================================================
-- Point-of-sale: categories, products (with stock), sales + line items.
-- Sales are created atomically through pos_create_sale() (SECURITY DEFINER):
-- it validates the caller's tenant, snapshots product name/price, decrements
-- stock, assigns a POS-<year>-NNNN code, and returns the sale. Every table is
-- tenant_id+property_id scoped, guarded, RLS-locked. Idempotent. Applied via
-- MCP apply_migration name="phase_f_pos".
-- =====================================================================

create table if not exists public.pos_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.pos_products (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  category_id uuid references public.pos_categories(id) on delete set null,
  name        text not null check (char_length(name) between 1 and 120),
  price       numeric(12,2) not null default 0,
  cost        numeric(12,2) not null default 0,
  sku         text,
  stock       int not null default 0,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.pos_sales (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  code          text,
  total         numeric(12,2) not null default 0,
  payment_method text not null default 'cash' check (payment_method in ('cash','transfer','card','room')),
  booking_id    uuid references public.bookings(id) on delete set null, -- charge to room
  sold_by       uuid references public.user_profiles(id) on delete set null,
  note          text,
  created_at    timestamptz not null default now()
);

create table if not exists public.pos_sale_items (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  sale_id     uuid not null references public.pos_sales(id) on delete cascade,
  product_id  uuid references public.pos_products(id) on delete set null,
  name        text not null,
  qty         numeric(12,2) not null default 1,
  unit_price  numeric(12,2) not null default 0,
  line_total  numeric(12,2) not null default 0
);

create table if not exists public.pos_counters (
  property_id uuid not null references public.properties(id) on delete cascade,
  year        int not null,
  seq         int not null default 0,
  primary key (property_id, year)
);
alter table public.pos_counters enable row level security;

-- property↔tenant guards
do $$ declare t text;
begin
  foreach t in array array['pos_categories','pos_products','pos_sales','pos_sale_items'] loop
    execute format('drop trigger if exists trg_%1$s_prop on public.%1$I', t);
    execute format('create trigger trg_%1$s_prop before insert or update on public.%1$I
      for each row execute function public.assert_property_in_tenant()', t);
  end loop;
end $$;

-- RLS — tenant-scoped read/write
do $$ declare t text;
begin
  foreach t in array array['pos_categories','pos_products','pos_sales','pos_sale_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_tenant_rw" on public.%1$I', t);
    execute format($p$create policy "%1$s_tenant_rw" on public.%1$I for all to authenticated
      using (tenant_id in (select auth_tenant_ids()))
      with check (tenant_id in (select auth_tenant_ids()))$p$, t);
  end loop;
end $$;

-- ── pos_create_sale: atomic sale + items + stock + code ──────────────────────
create or replace function public.pos_create_sale(
  p_property uuid,
  p_payment text,
  p_booking uuid,
  p_items jsonb,        -- [{ "product_id": uuid, "qty": number }]
  p_note text default null
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_tenant uuid;
  v_year int := extract(year from (now() at time zone 'Asia/Bangkok'))::int;
  v_seq int;
  v_code text;
  v_sale uuid;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_pid uuid; v_qty numeric; v_name text; v_price numeric; v_line numeric;
begin
  -- caller must belong to the property's tenant
  if p_property not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your property' using errcode = 'P0001';
  end if;
  select tenant_id into v_tenant from public.properties where id = p_property;
  if v_tenant is null then
    raise exception 'HG-PROP-404: property not found' using errcode = 'P0001';
  end if;
  if p_payment not in ('cash','transfer','card','room') then p_payment := 'cash'; end if;

  insert into public.pos_counters (property_id, year, seq)
  values (p_property, v_year, 1)
  on conflict (property_id, year) do update set seq = public.pos_counters.seq + 1
  returning seq into v_seq;
  v_code := 'POS-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  insert into public.pos_sales (tenant_id, property_id, code, total, payment_method, booking_id, sold_by, note)
  values (v_tenant, p_property, v_code, 0, p_payment, p_booking, auth.uid(), p_note)
  returning id into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := coalesce((v_item->>'qty')::numeric, 1);
    select name, price into v_name, v_price from public.pos_products
      where id = v_pid and property_id = p_property;
    if v_name is null then continue; end if;
    v_line := round(v_qty * v_price, 2);
    v_total := v_total + v_line;
    insert into public.pos_sale_items (tenant_id, property_id, sale_id, product_id, name, qty, unit_price, line_total)
    values (v_tenant, p_property, v_sale, v_pid, v_name, v_qty, v_price, v_line);
    update public.pos_products set stock = stock - v_qty::int where id = v_pid;
  end loop;

  update public.pos_sales set total = v_total where id = v_sale;
  return jsonb_build_object('id', v_sale, 'code', v_code, 'total', v_total);
end $$;
revoke all on function public.pos_create_sale(uuid, text, uuid, jsonb, text) from public, anon;
grant execute on function public.pos_create_sale(uuid, text, uuid, jsonb, text) to authenticated, service_role;

create index if not exists pos_categories_property_idx on public.pos_categories(property_id);
create index if not exists pos_products_property_idx   on public.pos_products(property_id, active);
create index if not exists pos_products_category_idx   on public.pos_products(category_id);
create index if not exists pos_sales_property_idx       on public.pos_sales(property_id, created_at desc);
create index if not exists pos_sale_items_sale_idx      on public.pos_sale_items(sale_id);

-- =====================================================================
-- End of migration 12
-- =====================================================================
