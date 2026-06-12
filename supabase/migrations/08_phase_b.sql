-- =====================================================================
-- HostGate · Migration 08 — Phase B (accounting). NO FlowAccount.
-- =====================================================================
-- Billing settings on properties + invoices / invoice_items / payments /
-- receipts + per-(property,year) counters with SECURITY DEFINER numbering.
-- Applied via MCP name="phase_b_invoices". (Full DDL — see the migration that
-- was applied; this file is the version-controlled copy.)
-- =====================================================================

alter table public.properties add column if not exists legal_name text;
alter table public.properties add column if not exists tax_id text;
alter table public.properties add column if not exists billing_address text;
alter table public.properties add column if not exists vat_rate numeric not null default 7;
alter table public.properties add column if not exists vat_inclusive boolean not null default true;
alter table public.properties add column if not exists bank_name text;
alter table public.properties add column if not exists bank_account text;
alter table public.properties add column if not exists invoice_prefix text not null default 'INV';
alter table public.properties add column if not exists invoice_footer text;

create table public.invoice_counters (
  property_id uuid not null references public.properties(id) on delete cascade,
  year int not null, seq int not null default 0,
  primary key (property_id, year)
);
create table public.receipt_counters (
  property_id uuid not null references public.properties(id) on delete cascade,
  year int not null, seq int not null default 0,
  primary key (property_id, year)
);
alter table public.invoice_counters enable row level security;
alter table public.receipt_counters enable row level security;

create or replace function public.next_doc_number(p_property uuid, p_kind text)
returns text language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_year int; v_seq int; v_prefix text;
begin
  v_year := extract(year from (now() at time zone 'Asia/Bangkok'))::int;
  if p_kind = 'receipt' then
    insert into receipt_counters(property_id, year, seq) values (p_property, v_year, 1)
      on conflict (property_id, year) do update set seq = receipt_counters.seq + 1
      returning seq into v_seq;
    v_prefix := 'RC';
  else
    insert into invoice_counters(property_id, year, seq) values (p_property, v_year, 1)
      on conflict (property_id, year) do update set seq = invoice_counters.seq + 1
      returning seq into v_seq;
    select coalesce(nullif(invoice_prefix,''),'INV') into v_prefix from properties where id = p_property;
  end if;
  return v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end $$;
revoke execute on function public.next_doc_number(uuid, text) from anon, public;
grant execute on function public.next_doc_number(uuid, text) to authenticated, service_role;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  number text,
  booking_id uuid references public.bookings(id) on delete set null,
  guest_name text not null default 'Guest',
  guest_tax_id text, guest_address text,
  issue_date date,
  service_period_start date, service_period_end date,
  currency text not null default 'THB',
  subtotal numeric not null default 0,
  vat_rate numeric not null default 7,
  vat_amount numeric not null default 0,
  total numeric not null default 0,
  amount_paid numeric not null default 0,
  balance numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','issued','partial','paid','void')),
  notes text,
  created_at timestamptz not null default now()
);
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null default '',
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  line_total numeric not null default 0,
  is_discount boolean not null default false,
  sort_order int not null default 0
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric not null,
  method text not null default 'cash',
  paid_at timestamptz not null default now(),
  note text
);
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  number text not null,
  snapshot jsonb,
  created_at timestamptz not null default now()
);

do $$ declare t text;
begin
  foreach t in array array['invoices','invoice_items','payments','receipts'] loop
    execute format('create trigger trg_%1$s_prop before insert or update on public.%1$I for each row execute function public.assert_property_in_tenant()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "%1$s_tenant_rw" on public.%1$I for all to authenticated
      using (tenant_id in (select auth_tenant_ids())) with check (tenant_id in (select auth_tenant_ids()))$p$, t);
  end loop;
end $$;

create index invoices_property_idx   on public.invoices(property_id);
create index invoices_tenant_idx     on public.invoices(tenant_id);
create index invoices_booking_idx    on public.invoices(booking_id);
create index invoices_status_idx     on public.invoices(property_id, status);
create index invoice_items_inv_idx   on public.invoice_items(invoice_id);
create index invoice_items_tenant_idx on public.invoice_items(tenant_id);
create index invoice_items_prop_idx  on public.invoice_items(property_id);
create index payments_invoice_idx    on public.payments(invoice_id);
create index payments_tenant_idx     on public.payments(tenant_id);
create index payments_prop_idx       on public.payments(property_id);
create index receipts_invoice_idx    on public.receipts(invoice_id);
create index receipts_payment_idx    on public.receipts(payment_id);
create index receipts_tenant_idx     on public.receipts(tenant_id);
create index receipts_prop_idx       on public.receipts(property_id);
