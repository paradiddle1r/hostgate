-- =====================================================================
-- HostGate · Migration 21 — Accounting: sales documents + expenses + WHT
-- =====================================================================
-- Multi-tenant port of hotel-pms schema_update_69 (sales documents/contacts)
-- and schema_update_70 (expenses + withholding tax). Additive only.
--
-- Adaptation from the single-tenant source:
--   • Every table carries tenant_id + property_id (NOT NULL, FK, cascade),
--     the assert_property_in_tenant() guard, and the house RLS policy
--     `tenant_id in (select auth_tenant_ids())` (for-all, authenticated).
--     The hotel-pms profiles/role_permissions RLS is dropped entirely —
--     role gating lives in the app layer, exactly like invoices (mig 08).
--   • uuid primary keys + uuid FKs (bookings/invoices are uuid here).
--   • Gapless document numbers are PER TENANT: document_counters is keyed
--     (tenant_id, prefix, year) and shared by QT/BN/CS/CN/DN + WHT (and the
--     journal books JV/SV/PUV/PV/RV added in migration 22). RLS on, no
--     policy → deny-all to clients; only the SECURITY DEFINER issue_*()
--     functions touch it (same convention as invoice_counters, mig 08).
--   • Counter/issue functions take (tenant, property), re-verify tenant
--     membership internally (skipped for the service/definer context where
--     auth.uid() is null — needed for backfill + provisioning), and raise
--     HG-AUTH-403 on a cross-tenant attempt (matches mig 20 hardening).
--   • The VAT money math (recompute_*_totals) is byte-for-byte identical to
--     the source and to lib/accounting/money.js (inclusive strips VAT out of
--     the gross; exclusive adds it on top; WHT on the pre-VAT net).
--
-- Applied to project xwikaqpdulkscdysgxri via MCP apply_migration.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. CONTACTS (customers + vendors, unified corporate billing profile)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id)    on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  kind         text not null default 'customer' check (kind in ('customer','vendor','both')),
  is_company   boolean not null default false,
  name         text not null,
  name_en      text,
  tax_id       text,
  branch       text default 'สำนักงานใหญ่',
  address      text,
  zipcode      text,
  email        text,
  phone        text,
  credit_days  int not null default 0,
  notes        text,
  active       boolean not null default true,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists contacts_property_idx on public.contacts(property_id);
create index if not exists contacts_tenant_idx   on public.contacts(tenant_id);
create index if not exists contacts_kind_idx     on public.contacts(property_id, kind);
create index if not exists contacts_name_idx     on public.contacts(property_id, lower(name));

-- ─────────────────────────────────────────────────────────────────────
-- 2. DOCUMENT NUMBERING — gapless, PER TENANT, per prefix, per year
--    Shared by QT/BN/CS/CN/DN + WHT here, and JV/SV/PUV/PV/RV in mig 22.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.document_counters (
  tenant_id uuid   not null references public.tenants(id) on delete cascade,
  prefix    text   not null,
  year      int    not null,
  last_seq  bigint not null default 0,
  primary key (tenant_id, prefix, year)
);
alter table public.document_counters enable row level security;
-- no policy: SECURITY DEFINER issue_*() functions only (deny-all to clients).

-- Map a sales doc_type to its running-number prefix (single source of truth).
create or replace function public.sales_document_prefix(p_doc_type text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case p_doc_type
    when 'quotation'    then 'QT'
    when 'billing-note' then 'BN'
    when 'cash-sale'    then 'CS'
    when 'credit-note'  then 'CN'
    when 'debit-note'   then 'DN'
    else null
  end;
$$;

-- Internal: bump the per-tenant counter for a prefix/year and format the number.
-- SECURITY DEFINER, membership-checked (skipped when auth.uid() is null, i.e.
-- service_role / a definer-chain caller such as backfill or provisioning).
create or replace function public.issue_document_number(p_tenant uuid, p_property uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text := public.sales_document_prefix(p_doc_type);
  v_year   int  := extract(year from (now() at time zone 'Asia/Bangkok'))::int;
  v_seq    bigint;
begin
  if v_prefix is null then
    raise exception 'unknown sales document type: %', p_doc_type;
  end if;
  if (select auth.uid()) is not null and p_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your tenant' using errcode = 'P0001';
  end if;
  if p_property is not null and not exists (
       select 1 from public.properties where id = p_property and tenant_id = p_tenant) then
    raise exception 'HG-PROP-404: property % not in tenant %', p_property, p_tenant using errcode = 'P0001';
  end if;

  insert into public.document_counters (tenant_id, prefix, year, last_seq)
  values (p_tenant, v_prefix, v_year, 1)
  on conflict (tenant_id, prefix, year)
  do update set last_seq = public.document_counters.last_seq + 1
  returning last_seq into v_seq;

  return v_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');
end;
$$;
revoke all on function public.issue_document_number(uuid, uuid, text) from anon, public;
grant execute on function public.issue_document_number(uuid, uuid, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 3. SALES DOCUMENTS (header) + items
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.sales_documents (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id)    on delete cascade,
  property_id           uuid not null references public.properties(id) on delete cascade,
  doc_type              text not null
                          check (doc_type in ('quotation','billing-note','cash-sale','credit-note','debit-note')),
  number                text,                                         -- assigned when the doc leaves 'draft'
  status                text not null default 'draft'
                          check (status in ('draft','awaiting','approved','rejected','processed','void')),
  issue_date            date not null default (now() at time zone 'Asia/Bangkok')::date,
  due_date              date,
  credit_days           int  not null default 0,
  contact_id            uuid references public.contacts(id)         on delete set null,
  booking_id            uuid references public.bookings(id)         on delete set null,
  ref_invoice_id        uuid references public.invoices(id)         on delete set null,
  source_document_id    uuid references public.sales_documents(id)  on delete set null,
  converted_invoice_id  uuid references public.invoices(id)         on delete set null,
  customer_name            text,
  customer_company_name    text,
  customer_company_name_th text,
  customer_branch          text,
  customer_tax_id          text,
  customer_address         text,
  customer_address_th      text,
  customer_phone           text,
  customer_email           text,
  currency      text not null default 'THB',
  vat_rate      numeric(5,2)  not null default 7.00,
  vat_inclusive boolean       not null default true,
  subtotal      numeric(12,2) not null default 0,
  discount      numeric(12,2) not null default 0,
  vat_amount    numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  notes         text,
  reason        text,
  salesperson   text,
  created_by    uuid,
  approved_by   uuid,
  approved_at   timestamptz,
  voided_at     timestamptz,
  void_reason   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sales_documents_property_idx on public.sales_documents(property_id);
create index if not exists sales_documents_tenant_idx   on public.sales_documents(tenant_id);
create index if not exists sales_documents_type_idx     on public.sales_documents(property_id, doc_type);
create index if not exists sales_documents_status_idx   on public.sales_documents(property_id, status);
create index if not exists sales_documents_contact_idx  on public.sales_documents(contact_id);
create index if not exists sales_documents_booking_idx  on public.sales_documents(booking_id);
create index if not exists sales_documents_srcdoc_idx   on public.sales_documents(source_document_id);
create index if not exists sales_documents_issue_idx    on public.sales_documents(property_id, issue_date);
-- Document numbers are unique within a tenant.
create unique index if not exists sales_documents_number_uk
  on public.sales_documents(tenant_id, number) where number is not null;

create table if not exists public.sales_document_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id)          on delete cascade,
  property_id  uuid not null references public.properties(id)       on delete cascade,
  document_id  uuid not null references public.sales_documents(id)  on delete cascade,
  sort_order   int not null default 0,
  description  text not null default '',
  unit         text,
  qty          numeric(12,2) not null default 1 check (qty >= 0),
  unit_price   numeric(12,2) not null default 0,
  line_total   numeric(12,2) not null generated always as (round(qty * unit_price, 2)) stored,
  is_discount  boolean not null default false
);
create index if not exists sales_document_items_doc_idx on public.sales_document_items(document_id, sort_order);
create index if not exists sales_document_items_tenant_idx on public.sales_document_items(tenant_id);

-- Totals recompute (exact mirror of hotel-pms recompute_sales_document_totals /
-- lib/accounting/money.js). Inclusive strips VAT out of the gross; exclusive adds on top.
create or replace function public.recompute_sales_document_totals(p_document_id uuid)
returns void language plpgsql set search_path = public, pg_temp as $$
declare
  v_lines numeric(12,2); v_disc numeric(12,2); v_rate numeric(5,2);
  v_incl boolean; v_net numeric(12,2); v_vat numeric(12,2); v_total numeric(12,2);
begin
  select coalesce(sum(line_total), 0) into v_lines
    from public.sales_document_items where document_id = p_document_id;
  select coalesce(discount, 0), coalesce(vat_rate, 0), coalesce(vat_inclusive, false)
    into v_disc, v_rate, v_incl
    from public.sales_documents where id = p_document_id;

  if v_incl then
    v_total := round(v_lines - v_disc, 2);
    v_net   := round(v_total / (1 + (v_rate / 100.0)), 2);
    v_vat   := round(v_total - v_net, 2);
  else
    v_net   := round(v_lines - v_disc, 2);
    v_vat   := round(v_net * (v_rate / 100.0), 2);
    v_total := round(v_net + v_vat, 2);
  end if;

  update public.sales_documents
     set subtotal = v_lines, vat_amount = v_vat, total = v_total
   where id = p_document_id;
end;
$$;

create or replace function public.trg_sales_document_items_recompute()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  perform public.recompute_sales_document_totals(coalesce(new.document_id, old.document_id));
  return null;
end;
$$;
drop trigger if exists sales_document_items_recompute on public.sales_document_items;
create trigger sales_document_items_recompute
  after insert or update or delete on public.sales_document_items
  for each row execute function public.trg_sales_document_items_recompute();

create or replace function public.trg_sales_documents_recompute()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE'
     and (new.vat_rate is distinct from old.vat_rate
       or new.vat_inclusive is distinct from old.vat_inclusive
       or new.discount is distinct from old.discount)
  then
    perform public.recompute_sales_document_totals(new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists sales_documents_recompute on public.sales_documents;
create trigger sales_documents_recompute
  after update on public.sales_documents
  for each row execute function public.trg_sales_documents_recompute();

-- Shared updated_at touch used by several accounting tables.
create or replace function public.trg_acct_touch()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists sales_documents_touch on public.sales_documents;
create trigger sales_documents_touch before update on public.sales_documents
  for each row execute function public.trg_acct_touch();
drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch before update on public.contacts
  for each row execute function public.trg_acct_touch();

-- Status transition (mints the per-tenant running number on leaving draft).
-- SECURITY DEFINER + explicit membership check (RLS is bypassed under definer).
create or replace function public.issue_sales_document(p_document_id uuid, p_status text)
returns public.sales_documents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_doc public.sales_documents; v_num text;
begin
  if p_status not in ('awaiting','approved','processed','rejected') then
    raise exception 'invalid target status: %', p_status;
  end if;
  select * into v_doc from public.sales_documents where id = p_document_id;
  if not found then raise exception 'sales document % not found', p_document_id; end if;
  if (select auth.uid()) is not null and v_doc.tenant_id not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your document' using errcode = 'P0001';
  end if;
  if v_doc.status = 'void' then raise exception 'sales document % is void', p_document_id; end if;

  if v_doc.number is null and p_status <> 'rejected' then
    v_num := public.issue_document_number(v_doc.tenant_id, v_doc.property_id, v_doc.doc_type);
  else
    v_num := v_doc.number;
  end if;

  update public.sales_documents
     set number = v_num, status = p_status,
         approved_by = case when p_status in ('approved','processed') then (select auth.uid()) else approved_by end,
         approved_at = case when p_status in ('approved','processed') then now() else approved_at end
   where id = p_document_id
  returning * into v_doc;
  return v_doc;
end;
$$;
revoke all on function public.issue_sales_document(uuid, text) from anon, public;
grant execute on function public.issue_sales_document(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 4. invoices.contact_id — the one sanctioned additive column on an
--    existing table (nullable FK; NULL keeps every legacy flow unchanged).
-- ─────────────────────────────────────────────────────────────────────
alter table public.invoices add column if not exists contact_id uuid references public.contacts(id) on delete set null;
create index if not exists invoices_contact_idx on public.invoices(contact_id) where contact_id is not null;

-- ─────────────────────────────────────────────────────────────────────
-- 5. EXPENSES (AP) + items + withholding tax certificates
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id)    on delete cascade,
  property_id            uuid not null references public.properties(id) on delete cascade,
  expense_date           date not null default (now() at time zone 'Asia/Bangkok')::date,
  contact_id             uuid references public.contacts(id) on delete set null,
  category_account_code  text,                                          -- COA code (validated at post time)
  description            text,
  doc_ref                text,
  receipt_image_path     text,
  currency      text not null default 'THB',
  vat_rate      numeric(5,2)  not null default 7.00,
  vat_inclusive boolean       not null default true,
  wht_rate      numeric(5,2)  not null default 0 check (wht_rate >= 0 and wht_rate <= 100),
  subtotal      numeric(12,2) not null default 0,
  vat_amount    numeric(12,2) not null default 0,
  wht_amount    numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  status        text not null default 'draft' check (status in ('draft','pending','paid','void')),
  paid_at       timestamptz,
  payment_method text,
  payment_ref   text,
  notes         text,
  created_by    uuid,
  voided_at     timestamptz,
  void_reason   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists expenses_property_idx on public.expenses(property_id);
create index if not exists expenses_tenant_idx   on public.expenses(tenant_id);
create index if not exists expenses_status_idx   on public.expenses(property_id, status);
create index if not exists expenses_date_idx     on public.expenses(property_id, expense_date);
create index if not exists expenses_contact_idx  on public.expenses(contact_id);

create table if not exists public.expense_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id)    on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  expense_id   uuid not null references public.expenses(id)   on delete cascade,
  sort_order   int not null default 0,
  description  text not null default '',
  unit         text,
  qty          numeric(12,2) not null default 1 check (qty >= 0),
  unit_price   numeric(12,2) not null default 0,
  line_total   numeric(12,2) not null generated always as (round(qty * unit_price, 2)) stored
);
create index if not exists expense_items_expense_idx on public.expense_items(expense_id, sort_order);
create index if not exists expense_items_tenant_idx  on public.expense_items(tenant_id);

create table if not exists public.wht_certificates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id)    on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  number        text,                                          -- WHT-YYYY-NNNNN (minted on insert)
  expense_id    uuid references public.expenses(id) on delete set null,
  contact_id    uuid references public.contacts(id) on delete set null,
  pnd_type      text not null check (pnd_type in ('pnd3','pnd53')),
  income_type   text,
  income_desc   text,
  payee_name    text,
  payee_tax_id  text,
  payee_branch  text,
  payee_address text,
  payment_date  date,
  amount_paid   numeric(12,2) not null default 0,
  wht_rate      numeric(5,2)  not null default 0,
  wht_amount    numeric(12,2) not null default 0,
  tax_condition text not null default '1',
  status        text not null default 'issued' check (status in ('issued','void')),
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists wht_certificates_property_idx on public.wht_certificates(property_id);
create index if not exists wht_certificates_tenant_idx   on public.wht_certificates(tenant_id);
create index if not exists wht_certificates_pnd_idx      on public.wht_certificates(property_id, pnd_type);
create index if not exists wht_certificates_paydate_idx  on public.wht_certificates(property_id, payment_date);
create index if not exists wht_certificates_contact_idx  on public.wht_certificates(contact_id);
create index if not exists wht_certificates_expense_idx  on public.wht_certificates(expense_id);
create unique index if not exists wht_certificates_number_uk
  on public.wht_certificates(tenant_id, number) where number is not null;

-- Expense totals recompute (mirror; WHT on the pre-VAT net).
create or replace function public.recompute_expense_totals(p_expense_id uuid)
returns void language plpgsql set search_path = public, pg_temp as $$
declare
  v_lines numeric(12,2); v_rate numeric(5,2); v_incl boolean; v_wrate numeric(5,2);
  v_net numeric(12,2); v_vat numeric(12,2); v_total numeric(12,2); v_wht numeric(12,2);
begin
  select coalesce(sum(line_total), 0) into v_lines
    from public.expense_items where expense_id = p_expense_id;
  select coalesce(vat_rate, 0), coalesce(vat_inclusive, false), coalesce(wht_rate, 0)
    into v_rate, v_incl, v_wrate
    from public.expenses where id = p_expense_id;

  if v_incl then
    v_total := round(v_lines, 2);
    v_net   := round(v_total / (1 + (v_rate / 100.0)), 2);
    v_vat   := round(v_total - v_net, 2);
  else
    v_net   := round(v_lines, 2);
    v_vat   := round(v_net * (v_rate / 100.0), 2);
    v_total := round(v_net + v_vat, 2);
  end if;
  v_wht := round(v_net * (v_wrate / 100.0), 2);

  update public.expenses
     set subtotal = v_lines, vat_amount = v_vat, total = v_total, wht_amount = v_wht
   where id = p_expense_id;
end;
$$;

create or replace function public.trg_expense_items_recompute()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  perform public.recompute_expense_totals(coalesce(new.expense_id, old.expense_id));
  return null;
end;
$$;
drop trigger if exists expense_items_recompute on public.expense_items;
create trigger expense_items_recompute
  after insert or update or delete on public.expense_items
  for each row execute function public.trg_expense_items_recompute();

create or replace function public.trg_expenses_recompute()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE'
     and (new.vat_rate is distinct from old.vat_rate
       or new.vat_inclusive is distinct from old.vat_inclusive
       or new.wht_rate is distinct from old.wht_rate)
  then
    perform public.recompute_expense_totals(new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists expenses_recompute on public.expenses;
create trigger expenses_recompute after update on public.expenses
  for each row execute function public.trg_expenses_recompute();

drop trigger if exists expenses_touch on public.expenses;
create trigger expenses_touch before update on public.expenses
  for each row execute function public.trg_acct_touch();

-- WHT numbering (per-tenant, prefix 'WHT', shares document_counters).
create or replace function public.issue_wht_number(p_tenant uuid, p_property uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_year int := extract(year from (now() at time zone 'Asia/Bangkok'))::int; v_seq bigint;
begin
  if (select auth.uid()) is not null and p_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your tenant' using errcode = 'P0001';
  end if;
  insert into public.document_counters (tenant_id, prefix, year, last_seq)
  values (p_tenant, 'WHT', v_year, 1)
  on conflict (tenant_id, prefix, year)
  do update set last_seq = public.document_counters.last_seq + 1
  returning last_seq into v_seq;
  return 'WHT-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');
end;
$$;
revoke all on function public.issue_wht_number(uuid, uuid) from anon, public;
grant execute on function public.issue_wht_number(uuid, uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 6. PROPERTY↔TENANT GUARDS + RLS (house pattern) for every new table
-- ─────────────────────────────────────────────────────────────────────
do $$ declare t text;
begin
  foreach t in array array[
    'contacts','sales_documents','sales_document_items',
    'expenses','expense_items','wht_certificates'
  ] loop
    execute format('drop trigger if exists trg_%1$s_prop on public.%1$I', t);
    execute format('create trigger trg_%1$s_prop before insert or update on public.%1$I
      for each row execute function public.assert_property_in_tenant()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_tenant_rw" on public.%1$I', t);
    execute format($p$create policy "%1$s_tenant_rw" on public.%1$I for all to authenticated
      using (tenant_id in (select auth_tenant_ids()))
      with check (tenant_id in (select auth_tenant_ids()))$p$, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 7. PRIVATE STORAGE BUCKET for expense receipts (tenant-folder scoped).
--    Objects are stored under `<tenant_id>/…`; a member of that tenant may
--    read/write, nobody else can. Copies the anon-locked HG posture (mig 20).
-- ─────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

drop policy if exists "expense_receipts_tenant_rw" on storage.objects;
create policy "expense_receipts_tenant_rw" on storage.objects for all to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] in (select auth_tenant_ids()::text)
)
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] in (select auth_tenant_ids()::text)
);

-- =====================================================================
-- End of migration 21
-- =====================================================================
