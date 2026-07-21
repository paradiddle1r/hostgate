-- =====================================================================
-- HostGate · Migration 22 — Accounting: general ledger + auto-posting
-- =====================================================================
-- Multi-tenant port of hotel-pms schema_update_71 (GL core), 72 (auto-posting +
-- backfill) and the POS→GL half of 74. Additive only.
--
-- Per-(tenant, property) BOOKS:
--   • chart_of_accounts / posting_account_map are seeded PER (tenant, property)
--     by seed_tenant_accounting() so each customer can edit their own chart.
--     COA is keyed (tenant_id, property_id, code); posting map and journal
--     lines reference it with composite FKs — a posted account_code is always a
--     real account in that property's chart.
--   • journal_entries / journal_lines carry tenant_id + property_id and the
--     house RLS. source_id is TEXT (a uuid for invoice/payment/expense/pos-sale,
--     a 'YYYY-MM' for depreciation) so one unique index covers every source.
--   • Running numbers (JV/SV/PUV/PV/RV) are PER TENANT (document_counters,
--     migration 21), minted only on approval, exactly like the sales docs.
--   • accounting_periods lock is per (tenant, property, month).
--
-- AUTO-POSTING: AFTER triggers on invoices/payments/expenses/pos_sales write
-- DRAFT entries only (an accountant approves each). Account codes are always
-- resolved from posting_account_map — never hard-coded. The posting functions
-- are SECURITY DEFINER (so RLS is bypassed for the ledger write) and each AFTER
-- trigger wraps the call in a PL/pgSQL exception block (an implicit savepoint)
-- so a GL hiccup can NEVER abort the underlying PMS operation. Idempotent via
-- the UNIQUE(tenant_id, source_type, source_id) partial index + NOT EXISTS.
--
-- Applied to project xwikaqpdulkscdysgxri via MCP apply_migration.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. CHART OF ACCOUNTS (per tenant+property)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.chart_of_accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id)    on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  code        text not null,
  name_th     text not null,
  name_en     text,
  category    text not null check (category in ('asset','liability','equity','revenue','expense')),
  parent_code text,                              -- plain pointer within (tenant,property); no FK on purpose
  is_system   boolean not null default false,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, property_id, code)
);
create index if not exists coa_property_idx  on public.chart_of_accounts(property_id);
create index if not exists coa_tenant_idx    on public.chart_of_accounts(tenant_id);
create index if not exists coa_category_idx  on public.chart_of_accounts(property_id, category);
create index if not exists coa_active_idx    on public.chart_of_accounts(property_id, active);

-- ─────────────────────────────────────────────────────────────────────
-- 2. POSTING ACCOUNT MAP (per tenant+property) — resolver for auto-posting
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.posting_account_map (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id)    on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  source_key   text not null,
  account_code text not null,
  description  text,
  unique (tenant_id, property_id, source_key),
  foreign key (tenant_id, property_id, account_code)
    references public.chart_of_accounts(tenant_id, property_id, code) on update cascade
);
create index if not exists posting_map_property_idx on public.posting_account_map(property_id);

-- ─────────────────────────────────────────────────────────────────────
-- 3. JOURNAL ENTRIES + LINES
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id)    on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  book         text not null check (book in ('general','sales','purchase','payment','receipt')),
  number       text,                                          -- minted on approval
  entry_date   date not null default (now() at time zone 'Asia/Bangkok')::date,
  description  text,
  source_type  text check (source_type is null or source_type ~ '^(invoice|payment|receipt|expense|pos-sale|rental-bill|depreciation|manual)(:reversal)?$'),
  source_id    text,                                          -- uuid::text | 'YYYY-MM' (depreciation)
  reversal_of  uuid references public.journal_entries(id) on delete set null,
  status       text not null default 'draft' check (status in ('draft','approved','void')),
  period       text generated always as (
                 lpad(extract(year  from entry_date)::int::text, 4, '0') || '-' ||
                 lpad(extract(month from entry_date)::int::text, 2, '0')
               ) stored,
  notes        text,
  created_by   uuid,
  approved_by  uuid,
  approved_at  timestamptz,
  voided_at    timestamptz,
  void_reason  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists je_property_idx on public.journal_entries(property_id);
create index if not exists je_tenant_idx   on public.journal_entries(tenant_id);
create index if not exists je_book_idx      on public.journal_entries(property_id, book);
create index if not exists je_status_idx    on public.journal_entries(property_id, status);
create index if not exists je_period_idx     on public.journal_entries(property_id, period);
create index if not exists je_date_idx       on public.journal_entries(property_id, entry_date);
create index if not exists je_source_idx     on public.journal_entries(source_type, source_id);
-- Numbers unique per tenant; at most one live (non-void) entry per source per tenant.
create unique index if not exists je_number_uk
  on public.journal_entries(tenant_id, number) where number is not null;
create unique index if not exists je_source_uk
  on public.journal_entries(tenant_id, source_type, source_id)
  where source_type is not null and status <> 'void';

create table if not exists public.journal_lines (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id)    on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  entry_id     uuid not null references public.journal_entries(id) on delete cascade,
  account_code text not null,
  debit        numeric(12,2) not null default 0 check (debit  >= 0),
  credit       numeric(12,2) not null default 0 check (credit >= 0),
  memo         text,
  sort_order   int not null default 0,
  check (debit = 0 or credit = 0),
  foreign key (tenant_id, property_id, account_code)
    references public.chart_of_accounts(tenant_id, property_id, code) on update cascade
);
create index if not exists jl_entry_idx    on public.journal_lines(entry_id, sort_order);
create index if not exists jl_account_idx   on public.journal_lines(property_id, account_code);
create index if not exists jl_tenant_idx    on public.journal_lines(tenant_id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. ACCOUNTING PERIODS (month open/closed lock, per tenant+property)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.accounting_periods (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id)    on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  period       text not null check (period ~ '^\d{4}-\d{2}$'),
  status       text not null default 'open' check (status in ('open','closed')),
  closed_by    uuid,
  closed_at    timestamptz,
  reopened_by  uuid,
  reopened_at  timestamptz,
  note         text,
  updated_at   timestamptz not null default now(),
  unique (tenant_id, property_id, period)
);
create index if not exists periods_property_idx on public.accounting_periods(property_id);

-- A (tenant,property,period) with no row is OPEN. Only status='closed' locks it.
create or replace function public.gl_period_is_closed(p_tenant uuid, p_property uuid, p_period text)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select exists (select 1 from public.accounting_periods
                 where tenant_id = p_tenant and property_id = p_property
                   and period = p_period and status = 'closed');
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. NUMBERING — journal books (per tenant, shares document_counters)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.journal_book_prefix(p_book text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case p_book
    when 'general'  then 'JV'
    when 'sales'    then 'SV'
    when 'purchase' then 'PUV'
    when 'payment'  then 'PV'
    when 'receipt'  then 'RV'
    else null
  end;
$$;

create or replace function public.issue_journal_number(p_tenant uuid, p_book text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_prefix text := public.journal_book_prefix(p_book);
  v_year   int  := extract(year from (now() at time zone 'Asia/Bangkok'))::int;
  v_seq    bigint;
begin
  if v_prefix is null then raise exception 'unknown journal book: %', p_book; end if;
  if (select auth.uid()) is not null and p_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your tenant' using errcode = 'P0001';
  end if;
  insert into public.document_counters (tenant_id, prefix, year, last_seq)
  values (p_tenant, v_prefix, v_year, 1)
  on conflict (tenant_id, prefix, year)
  do update set last_seq = public.document_counters.last_seq + 1
  returning last_seq into v_seq;
  return v_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');
end;
$$;
revoke all on function public.issue_journal_number(uuid, text) from anon, public;
grant execute on function public.issue_journal_number(uuid, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 6. GUARD TRIGGERS (balance, period lock, immutability, numbering)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.trg_journal_entry_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_dr numeric(12,2); v_cr numeric(12,2);
begin
  if tg_op = 'INSERT' then
    if public.gl_period_is_closed(new.tenant_id, new.property_id, to_char(new.entry_date,'YYYY-MM')) then
      raise exception 'accounting period % is closed', to_char(new.entry_date,'YYYY-MM');
    end if;
    if new.status <> 'draft' then raise exception 'a new journal entry must start as draft'; end if;
    return new;
  end if;

  -- UPDATE
  if old.status = 'void' then
    raise exception 'journal entry % is void and cannot be modified', old.id;
  end if;

  if old.status = 'approved' then
    if new.status = 'void' then
      new.voided_at := now(); new.updated_at := now(); return new;
    end if;
    raise exception 'approved journal entry % is immutable (void it instead)', old.id;
  end if;

  -- old.status = 'draft'
  if new.status = 'approved' then
    if public.gl_period_is_closed(new.tenant_id, new.property_id, to_char(new.entry_date,'YYYY-MM')) then
      raise exception 'accounting period % is closed', to_char(new.entry_date,'YYYY-MM');
    end if;
    select coalesce(sum(debit),0), coalesce(sum(credit),0) into v_dr, v_cr
      from public.journal_lines where entry_id = new.id;
    if v_dr <> v_cr then
      raise exception 'journal entry % is out of balance: debit % <> credit %', new.id, v_dr, v_cr;
    end if;
    if v_dr = 0 then raise exception 'journal entry % has no lines to approve', new.id; end if;
    if new.number is null then new.number := public.issue_journal_number(new.tenant_id, new.book); end if;
    new.approved_by := coalesce(new.approved_by, (select auth.uid()));
    new.approved_at := now();
  elsif new.status = 'void' then
    new.voided_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists journal_entry_guard on public.journal_entries;
create trigger journal_entry_guard before insert or update on public.journal_entries
  for each row execute function public.trg_journal_entry_guard();

create or replace function public.trg_journal_line_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_status text;
begin
  select status into v_status from public.journal_entries
   where id = coalesce(new.entry_id, old.entry_id);
  if v_status is null then return coalesce(new, old); end if;     -- parent gone (cascade) => allow
  if v_status <> 'draft' then raise exception 'cannot modify lines of a % journal entry', v_status; end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists journal_line_guard on public.journal_lines;
create trigger journal_line_guard before insert or update or delete on public.journal_lines
  for each row execute function public.trg_journal_line_guard();

drop trigger if exists accounting_periods_touch on public.accounting_periods;
create trigger accounting_periods_touch before update on public.accounting_periods
  for each row execute function public.trg_acct_touch();
drop trigger if exists chart_of_accounts_touch on public.chart_of_accounts;
create trigger chart_of_accounts_touch before update on public.chart_of_accounts
  for each row execute function public.trg_acct_touch();

-- ─────────────────────────────────────────────────────────────────────
-- 7. TRIAL BALANCE / STATEMENT AGGREGATION (per tenant+property)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.gl_trial_balance(
  p_tenant uuid, p_property uuid, p_from date, p_to date, p_include_drafts boolean default false
)
returns table (account_code text, opening numeric, period_debit numeric, period_credit numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if (select auth.uid()) is not null and p_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your tenant' using errcode = 'P0001';
  end if;
  return query
    select l.account_code,
      coalesce(sum(case when e.entry_date < p_from then l.debit - l.credit else 0 end),0) as opening,
      coalesce(sum(case when e.entry_date between p_from and p_to then l.debit  else 0 end),0) as period_debit,
      coalesce(sum(case when e.entry_date between p_from and p_to then l.credit else 0 end),0) as period_credit
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    where e.tenant_id = p_tenant and e.property_id = p_property
      and (e.status = 'approved' or (p_include_drafts and e.status = 'draft'))
    group by l.account_code;
end;
$$;
revoke all on function public.gl_trial_balance(uuid, uuid, date, date, boolean) from anon, public;
grant execute on function public.gl_trial_balance(uuid, uuid, date, date, boolean) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 8. GUARDS + RLS for the ledger tables (house pattern)
-- ─────────────────────────────────────────────────────────────────────
do $$ declare t text;
begin
  foreach t in array array[
    'chart_of_accounts','posting_account_map','journal_entries','journal_lines','accounting_periods'
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
-- 9. PER-TENANT SEED: Thai SME hotel chart of accounts + posting map
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.seed_tenant_accounting(p_tenant uuid, p_property uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select auth.uid()) is not null and p_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your tenant' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.properties where id = p_property and tenant_id = p_tenant) then
    raise exception 'HG-PROP-404: property % not in tenant %', p_property, p_tenant using errcode = 'P0001';
  end if;

  insert into public.chart_of_accounts (tenant_id, property_id, code, name_th, name_en, category, parent_code, is_system, sort_order)
  select p_tenant, p_property, v.code, v.name_th, v.name_en, v.category, v.parent_code::text, v.is_system::boolean, v.sort_order::int
  from (values
    ('10000','สินทรัพย์','Assets','asset',null,true,1000),
    ('11000','สินทรัพย์หมุนเวียน','Current assets','asset','10000',true,1100),
    ('11110','เงินสด','Cash on hand','asset','11000',true,1110),
    ('11120','เงินฝากธนาคาร','Bank deposits','asset','11000',true,1120),
    ('11130','เงินฝากธนาคาร - ออมทรัพย์','Bank - savings','asset','11000',false,1130),
    ('11140','เงินฝากธนาคาร - กระแสรายวัน','Bank - current','asset','11000',false,1140),
    ('11210','ลูกหนี้การค้า','Accounts receivable','asset','11000',true,1210),
    ('11220','ลูกหนี้อื่น','Other receivables','asset','11000',false,1220),
    ('11310','เงินทดรองจ่าย','Advances / petty cash','asset','11000',false,1310),
    ('11410','สินค้าคงเหลือ','Inventory','asset','11000',false,1410),
    ('11420','วัสดุสิ้นเปลืองคงเหลือ','Supplies on hand','asset','11000',false,1420),
    ('11510','ค่าใช้จ่ายจ่ายล่วงหน้า','Prepaid expenses','asset','11000',false,1510),
    ('11540','ภาษีซื้อ','VAT input (purchase tax)','asset','11000',true,1540),
    ('11550','ภาษีถูกหัก ณ ที่จ่าย','WHT credit (tax withheld on us)','asset','11000',false,1550),
    ('12000','สินทรัพย์ไม่หมุนเวียน','Non-current assets','asset','10000',true,1200),
    ('12110','ที่ดิน','Land','asset','12000',false,12110),
    ('12120','อาคาร','Buildings','asset','12000',false,12120),
    ('12125','ค่าเสื่อมราคาสะสม - อาคาร','Accum. depreciation - buildings','asset','12000',false,12125),
    ('12130','ส่วนปรับปรุงอาคาร','Building improvements','asset','12000',false,12130),
    ('12135','ค่าเสื่อมราคาสะสม - ส่วนปรับปรุงอาคาร','Accum. depreciation - improvements','asset','12000',false,12135),
    ('12140','เครื่องตกแต่งและอุปกรณ์','Furniture & fixtures','asset','12000',false,12140),
    ('12145','ค่าเสื่อมราคาสะสม - เครื่องตกแต่งและอุปกรณ์','Accum. depreciation - F&F','asset','12000',false,12145),
    ('12150','เครื่องใช้สำนักงาน','Office equipment','asset','12000',false,12150),
    ('12155','ค่าเสื่อมราคาสะสม - เครื่องใช้สำนักงาน','Accum. depreciation - office equip.','asset','12000',false,12155),
    ('12160','ยานพาหนะ','Vehicles','asset','12000',false,12160),
    ('12165','ค่าเสื่อมราคาสะสม - ยานพาหนะ','Accum. depreciation - vehicles','asset','12000',false,12165),
    ('12170','เครื่องปรับอากาศ','Air conditioners','asset','12000',false,12170),
    ('12175','ค่าเสื่อมราคาสะสม - เครื่องปรับอากาศ','Accum. depreciation - A/C','asset','12000',false,12175),
    ('20000','หนี้สิน','Liabilities','liability',null,true,2000),
    ('21000','หนี้สินหมุนเวียน','Current liabilities','liability','20000',true,2100),
    ('21110','เจ้าหนี้การค้า','Accounts payable','liability','21000',true,2110),
    ('21120','เจ้าหนี้อื่น','Other payables','liability','21000',false,2120),
    ('21130','ค่าใช้จ่ายค้างจ่าย','Accrued expenses','liability','21000',false,2130),
    ('21140','เงินเดือนค้างจ่าย','Accrued salaries','liability','21000',false,2140),
    ('21210','ภาษีเงินได้นิติบุคคลค้างจ่าย','Corporate income tax payable','liability','21000',false,2210),
    ('21230','ภาษีขาย','VAT output (sales tax)','liability','21000',true,2230),
    ('21240','ภาษีหัก ณ ที่จ่ายค้างนำส่ง','WHT payable','liability','21000',true,2240),
    ('21250','ประกันสังคมค้างจ่าย','Social security payable','liability','21000',false,2250),
    ('21310','เงินมัดจำ/เงินประกันผู้เช่า','Tenant deposits held','liability','21000',true,2310),
    ('21320','รายได้รับล่วงหน้า','Unearned / advance revenue','liability','21000',false,2320),
    ('22000','หนี้สินไม่หมุนเวียน','Non-current liabilities','liability','20000',true,2400),
    ('22110','เงินกู้ยืมระยะยาว','Long-term loans','liability','22000',false,2410),
    ('22120','เงินกู้ยืมกรรมการ','Director loans','liability','22000',false,2420),
    ('30000','ส่วนของเจ้าของ','Equity','equity',null,true,3000),
    ('31000','ทุน','Capital','equity','30000',true,3100),
    ('31110','ทุนจดทะเบียน','Registered capital','equity','31000',true,3110),
    ('31120','ทุนที่ชำระแล้ว','Paid-up capital','equity','31000',false,3120),
    ('32010','กำไรสะสม','Retained earnings','equity','30000',true,3200),
    ('33010','เงินถอนของเจ้าของ','Owner drawings','equity','30000',false,3300),
    ('40000','รายได้','Revenue','revenue',null,true,4000),
    ('41000','รายได้จากการดำเนินงาน','Operating revenue','revenue','40000',true,4100),
    ('41110','รายได้ค่าห้องพักรายวัน','Daily room revenue','revenue','41000',true,4110),
    ('41120','รายได้ค่าเช่ารายเดือน','Monthly rental revenue','revenue','41000',true,4120),
    ('41210','รายได้ค่าบริการ','Service revenue','revenue','41000',true,4210),
    ('41310','รายได้มินิบาร์/POS','Minibar / POS revenue','revenue','41000',true,4310),
    ('41410','รายได้ค่าน้ำ-ไฟ','Utilities (water & electricity) revenue','revenue','41000',true,4410),
    ('41510','รายได้ค่าซักรีด','Laundry revenue','revenue','41000',false,4510),
    ('41610','รายได้ค่าอาหารและเครื่องดื่ม','Food & beverage revenue','revenue','41000',false,4610),
    ('42000','รายได้อื่น','Other income','revenue','40000',true,4200),
    ('42110','รายได้อื่น','Other income','revenue','42000',true,42110),
    ('42120','ดอกเบี้ยรับ','Interest income','revenue','42000',false,42120),
    ('42130','กำไรจากการจำหน่ายสินทรัพย์','Gain on asset disposal','revenue','42000',false,42130),
    ('42140','ส่วนลดรับ','Discounts received','revenue','42000',false,42140),
    ('50000','ค่าใช้จ่าย','Expenses','expense',null,true,5000),
    ('51000','ต้นทุนบริการ','Cost of services','expense','50000',true,5100),
    ('51110','ต้นทุนค่าห้องพัก','Room cost','expense','51000',false,5110),
    ('51120','ค่าผ้า/เครื่องนอน','Linen & bedding','expense','51000',false,5120),
    ('51130','ค่าอุปกรณ์ห้องพัก','Room amenities','expense','51000',false,5130),
    ('51140','ต้นทุนอาหารและเครื่องดื่ม','F&B cost','expense','51000',false,5140),
    ('51150','ต้นทุนสินค้ามินิบาร์','Minibar goods cost','expense','51000',false,5150),
    ('52000','ค่าใช้จ่ายในการขายและบริหาร','Selling, general & admin','expense','50000',true,5200),
    ('52110','เงินเดือนและค่าจ้าง','Salaries & wages','expense','52000',false,5211),
    ('52120','ค่าล่วงเวลา','Overtime','expense','52000',false,5212),
    ('52130','สวัสดิการพนักงาน','Employee benefits','expense','52000',false,5213),
    ('52140','ประกันสังคม (นายจ้าง)','Social security (employer)','expense','52000',false,5214),
    ('52210','ค่าน้ำประปา','Water','expense','52000',false,5221),
    ('52220','ค่าไฟฟ้า','Electricity','expense','52000',false,5222),
    ('52230','ค่าโทรศัพท์และอินเทอร์เน็ต','Telephone & internet','expense','52000',false,5223),
    ('52310','ค่าเช่า','Rent','expense','52000',false,5231),
    ('52320','ค่าซ่อมแซมและบำรุงรักษา','Repairs & maintenance','expense','52000',false,5232),
    ('52330','ค่าวัสดุสิ้นเปลือง','Consumable supplies','expense','52000',false,5233),
    ('52340','ค่าทำความสะอาด','Cleaning','expense','52000',false,5234),
    ('52350','ค่าเครื่องเขียนและแบบพิมพ์','Stationery & printing','expense','52000',false,5235),
    ('52410','ค่าโฆษณาและการตลาด','Advertising & marketing','expense','52000',false,5241),
    ('52420','ค่าคอมมิชชั่น OTA','OTA commission','expense','52000',false,5242),
    ('52430','ค่าธรรมเนียมธนาคาร','Bank charges','expense','52000',false,5243),
    ('52440','ค่าธรรมเนียมบัตรเครดิต','Credit card fees','expense','52000',false,5244),
    ('52510','ค่าเสื่อมราคา','Depreciation','expense','52000',true,5251),
    ('52520','ค่าตัดจำหน่าย','Amortization','expense','52000',false,5252),
    ('52610','ค่าธรรมเนียมวิชาชีพ','Professional fees','expense','52000',false,5261),
    ('52620','ค่าประกันภัย','Insurance','expense','52000',false,5262),
    ('52630','ค่าภาษีและใบอนุญาต','Taxes & licenses','expense','52000',false,5263),
    ('52710','ค่ารับรอง','Entertainment','expense','52000',false,5271),
    ('52720','ค่าเดินทาง','Travel','expense','52000',false,5272),
    ('52810','หนี้สงสัยจะสูญ','Bad debt','expense','52000',false,5281),
    ('52990','ค่าใช้จ่ายเบ็ดเตล็ด','Miscellaneous expense','expense','52000',true,5299),
    ('53000','ต้นทุนทางการเงิน','Finance costs','expense','50000',true,5300),
    ('53110','ดอกเบี้ยจ่าย','Interest expense','expense','53000',false,5311),
    ('59000','ภาษีเงินได้','Income tax','expense','50000',true,5900),
    ('59110','ภาษีเงินได้นิติบุคคล','Corporate income tax','expense','59000',false,5911)
  ) as v(code, name_th, name_en, category, parent_code, is_system, sort_order)
  on conflict (tenant_id, property_id, code) do nothing;

  insert into public.posting_account_map (tenant_id, property_id, source_key, account_code, description)
  select p_tenant, p_property, v.source_key, v.account_code, v.description
  from (values
    ('cash',              '11110','Cash on hand'),
    ('bank',              '11120','Bank deposits'),
    ('ar',                '11210','Accounts receivable'),
    ('vat-input',         '11540','VAT input (purchases)'),
    ('vat-output',        '21230','VAT output (sales)'),
    ('ap',                '21110','Accounts payable'),
    ('wht-payable',       '21240','Withholding tax payable'),
    ('deposit-held',      '21310','Tenant deposits held'),
    ('revenue-daily',     '41110','Daily room revenue'),
    ('revenue-monthly',   '41120','Monthly rental revenue'),
    ('revenue-service',   '41210','Service revenue'),
    ('revenue-pos',       '41310','Minibar / POS revenue'),
    ('revenue-utilities', '41410','Utilities revenue'),
    ('revenue-other',     '42110','Other income'),
    ('expense-misc',      '52990','Miscellaneous expense (fallback)')
  ) as v(source_key, account_code, description)
  on conflict (tenant_id, property_id, source_key) do nothing;
end;
$$;
revoke all on function public.seed_tenant_accounting(uuid, uuid) from anon, public;
grant execute on function public.seed_tenant_accounting(uuid, uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 10. AUTO-POSTING ENGINE
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.gl_map(p_tenant uuid, p_property uuid, p_key text)
returns text language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_code text;
begin
  if (select auth.uid()) is not null and p_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your tenant' using errcode = 'P0001';
  end if;
  select account_code into v_code from public.posting_account_map
   where tenant_id = p_tenant and property_id = p_property and source_key = p_key;
  if v_code is null then
    raise exception 'posting_account_map has no key % for tenant %/property %', p_key, p_tenant, p_property;
  end if;
  return v_code;
end;
$$;
revoke all on function public.gl_map(uuid, uuid, text) from anon, public;
grant execute on function public.gl_map(uuid, uuid, text) to authenticated, service_role;

-- Post an invoice (sales book): DR ar total / CR revenue net + CR vat-output.
create or replace function public.gl_post_invoice(p_invoice_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_inv public.invoices; v_entry_id uuid; v_net numeric(12,2); v_vat numeric(12,2);
  v_util_gross numeric(12,2); v_grand numeric(12,2); v_util_net numeric(12,2); v_is_monthly boolean;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then return null; end if;
  if v_inv.status not in ('issued','partial','paid') then return null; end if;
  if coalesce(v_inv.total,0) = 0 then return null; end if;
  if exists (select 1 from public.journal_entries
             where tenant_id = v_inv.tenant_id and source_type = 'invoice'
               and source_id = p_invoice_id::text and status <> 'void') then
    return null;
  end if;

  v_vat := coalesce(v_inv.vat_amount,0);
  v_net := round(coalesce(v_inv.total,0) - v_vat, 2);

  insert into public.journal_entries(tenant_id, property_id, book, entry_date, description, source_type, source_id, status)
  values (v_inv.tenant_id, v_inv.property_id, 'sales', coalesce(v_inv.issue_date, current_date),
          'ใบกำกับภาษี ' || coalesce(v_inv.number, '#' || left(v_inv.id::text,8)) || ' — ' || coalesce(v_inv.guest_name,''),
          'invoice', p_invoice_id::text, 'draft')
  returning id into v_entry_id;

  insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
  values (v_inv.tenant_id, v_inv.property_id, v_entry_id, public.gl_map(v_inv.tenant_id, v_inv.property_id,'ar'), v_inv.total, 0, 'ลูกหนี้การค้า', 0);

  if v_vat > 0 then
    insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
    values (v_inv.tenant_id, v_inv.property_id, v_entry_id, public.gl_map(v_inv.tenant_id, v_inv.property_id,'vat-output'), 0, v_vat, 'ภาษีขาย', 1);
  end if;

  -- Revenue routing (CR lines summing to v_net). Utilities split for rental bills.
  select coalesce(sum(coalesce(electric_amount,0) + coalesce(water_amount,0)),0),
         coalesce(sum(coalesce(total,0)),0)
    into v_util_gross, v_grand
    from public.rental_bills where invoice_id = p_invoice_id;

  if v_grand > 0 then
    if v_util_gross > 0 and v_util_gross < v_grand then
      v_util_net := round(v_net * (v_util_gross / v_grand), 2);
      insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
      values (v_inv.tenant_id, v_inv.property_id, v_entry_id, public.gl_map(v_inv.tenant_id, v_inv.property_id,'revenue-utilities'), 0, v_util_net, 'รายได้ค่าน้ำ-ไฟ', 2);
      insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
      values (v_inv.tenant_id, v_inv.property_id, v_entry_id, public.gl_map(v_inv.tenant_id, v_inv.property_id,'revenue-monthly'), 0, round(v_net - v_util_net,2), 'รายได้ค่าเช่า', 3);
    else
      insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
      values (v_inv.tenant_id, v_inv.property_id, v_entry_id, public.gl_map(v_inv.tenant_id, v_inv.property_id,'revenue-monthly'), 0, v_net, 'รายได้ค่าเช่า', 2);
    end if;
  elsif v_inv.booking_id is not null then
    v_is_monthly := exists (select 1 from public.rental_tenants where booking_id = v_inv.booking_id);
    insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
    values (v_inv.tenant_id, v_inv.property_id, v_entry_id,
            case when v_is_monthly then public.gl_map(v_inv.tenant_id, v_inv.property_id,'revenue-monthly')
                 else public.gl_map(v_inv.tenant_id, v_inv.property_id,'revenue-daily') end,
            0, v_net,
            case when v_is_monthly then 'รายได้ค่าเช่า' else 'รายได้ค่าห้องพัก' end, 2);
  else
    insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
    values (v_inv.tenant_id, v_inv.property_id, v_entry_id, public.gl_map(v_inv.tenant_id, v_inv.property_id,'revenue-service'), 0, v_net, 'รายได้ค่าบริการ', 2);
  end if;

  return v_entry_id;
end;
$$;
revoke all on function public.gl_post_invoice(uuid) from anon, public;
grant execute on function public.gl_post_invoice(uuid) to authenticated, service_role;

-- Post a payment (receipt book): DR cash|bank / CR ar.
create or replace function public.gl_post_payment(p_payment_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pay public.payments; v_entry_id uuid; v_cashbank text;
begin
  select * into v_pay from public.payments where id = p_payment_id;
  if not found then return null; end if;
  if coalesce(v_pay.amount,0) = 0 then return null; end if;
  if exists (select 1 from public.journal_entries
             where tenant_id = v_pay.tenant_id and source_type = 'payment'
               and source_id = p_payment_id::text and status <> 'void') then
    return null;
  end if;

  v_cashbank := case when v_pay.method = 'cash' then public.gl_map(v_pay.tenant_id, v_pay.property_id,'cash')
                     else public.gl_map(v_pay.tenant_id, v_pay.property_id,'bank') end;

  insert into public.journal_entries(tenant_id, property_id, book, entry_date, description, source_type, source_id, status)
  values (v_pay.tenant_id, v_pay.property_id, 'receipt', (v_pay.paid_at at time zone 'Asia/Bangkok')::date,
          'รับชำระเงิน · ใบแจ้งหนี้ ' || left(v_pay.invoice_id::text,8), 'payment', p_payment_id::text, 'draft')
  returning id into v_entry_id;

  insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
  values (v_pay.tenant_id, v_pay.property_id, v_entry_id, v_cashbank, v_pay.amount, 0, 'รับเงิน', 0);
  insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
  values (v_pay.tenant_id, v_pay.property_id, v_entry_id, public.gl_map(v_pay.tenant_id, v_pay.property_id,'ar'), 0, v_pay.amount, 'ตัดลูกหนี้', 1);

  return v_entry_id;
end;
$$;
revoke all on function public.gl_post_payment(uuid) from anon, public;
grant execute on function public.gl_post_payment(uuid) to authenticated, service_role;

-- Post an expense (purchase book): DR expense + DR vat-input / CR cash|bank (net of wht) + CR wht-payable.
create or replace function public.gl_post_expense(p_expense_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_exp public.expenses; v_entry_id uuid; v_net numeric(12,2); v_vat numeric(12,2);
  v_wht numeric(12,2); v_exp_code text; v_cashbank text;
begin
  select * into v_exp from public.expenses where id = p_expense_id;
  if not found then return null; end if;
  if v_exp.status <> 'paid' then return null; end if;
  if coalesce(v_exp.total,0) = 0 then return null; end if;
  if exists (select 1 from public.journal_entries
             where tenant_id = v_exp.tenant_id and source_type = 'expense'
               and source_id = p_expense_id::text and status <> 'void') then
    return null;
  end if;

  v_vat := coalesce(v_exp.vat_amount,0);
  v_wht := coalesce(v_exp.wht_amount,0);
  v_net := round(coalesce(v_exp.total,0) - v_vat, 2);

  select code into v_exp_code from public.chart_of_accounts
   where tenant_id = v_exp.tenant_id and property_id = v_exp.property_id
     and code = v_exp.category_account_code and active;
  if v_exp_code is null then v_exp_code := public.gl_map(v_exp.tenant_id, v_exp.property_id,'expense-misc'); end if;

  v_cashbank := case when v_exp.payment_method = 'cash' then public.gl_map(v_exp.tenant_id, v_exp.property_id,'cash')
                     else public.gl_map(v_exp.tenant_id, v_exp.property_id,'bank') end;

  insert into public.journal_entries(tenant_id, property_id, book, entry_date, description, source_type, source_id, status)
  values (v_exp.tenant_id, v_exp.property_id, 'purchase',
          coalesce((v_exp.paid_at at time zone 'Asia/Bangkok')::date, v_exp.expense_date),
          'ค่าใช้จ่าย · ' || coalesce(v_exp.description, v_exp.doc_ref, '#' || left(v_exp.id::text,8)),
          'expense', p_expense_id::text, 'draft')
  returning id into v_entry_id;

  insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
  values (v_exp.tenant_id, v_exp.property_id, v_entry_id, v_exp_code, v_net, 0, 'ค่าใช้จ่าย', 0);
  if v_vat > 0 then
    insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
    values (v_exp.tenant_id, v_exp.property_id, v_entry_id, public.gl_map(v_exp.tenant_id, v_exp.property_id,'vat-input'), v_vat, 0, 'ภาษีซื้อ', 1);
  end if;
  insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
  values (v_exp.tenant_id, v_exp.property_id, v_entry_id, v_cashbank, 0, round(coalesce(v_exp.total,0) - v_wht, 2), 'จ่ายเงิน', 2);
  if v_wht > 0 then
    insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
    values (v_exp.tenant_id, v_exp.property_id, v_entry_id, public.gl_map(v_exp.tenant_id, v_exp.property_id,'wht-payable'), 0, v_wht, 'ภาษีหัก ณ ที่จ่ายค้างนำส่ง', 3);
  end if;

  return v_entry_id;
end;
$$;
revoke all on function public.gl_post_expense(uuid) from anon, public;
grant execute on function public.gl_post_expense(uuid) to authenticated, service_role;

-- Post a POS sale (receipt book): DR cash|bank total / CR revenue-pos net / CR vat-output vat.
-- VAT is derived from the property's vat settings (inclusive & rate>0 ⇒ extract; else no VAT line).
create or replace function public.gl_post_pos_sale(p_sale_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_sale public.pos_sales; v_entry_id uuid; v_net numeric(12,2); v_vat numeric(12,2);
  v_cashbank text; v_rate numeric(5,2); v_incl boolean;
begin
  select * into v_sale from public.pos_sales where id = p_sale_id;
  if not found then return null; end if;
  if v_sale.voided then return null; end if;
  if coalesce(v_sale.total,0) = 0 then return null; end if;
  if exists (select 1 from public.journal_entries
             where tenant_id = v_sale.tenant_id and source_type = 'pos-sale'
               and source_id = p_sale_id::text and status <> 'void') then
    return null;
  end if;

  select coalesce(vat_rate,0), coalesce(vat_inclusive,false) into v_rate, v_incl
    from public.properties where id = v_sale.property_id;
  if v_incl and v_rate > 0 then
    v_vat := round(coalesce(v_sale.total,0) * v_rate / (100 + v_rate), 2);
    v_net := round(coalesce(v_sale.total,0) - v_vat, 2);
  else
    v_vat := 0;
    v_net := coalesce(v_sale.total,0);
  end if;

  v_cashbank := case when v_sale.payment_method = 'cash' then public.gl_map(v_sale.tenant_id, v_sale.property_id,'cash')
                     else public.gl_map(v_sale.tenant_id, v_sale.property_id,'bank') end;

  insert into public.journal_entries(tenant_id, property_id, book, entry_date, description, source_type, source_id, status)
  values (v_sale.tenant_id, v_sale.property_id, 'receipt', (v_sale.created_at at time zone 'Asia/Bangkok')::date,
          'ขาย POS ' || coalesce(v_sale.code, '#' || left(v_sale.id::text,8)), 'pos-sale', p_sale_id::text, 'draft')
  returning id into v_entry_id;

  insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
  values (v_sale.tenant_id, v_sale.property_id, v_entry_id, v_cashbank, coalesce(v_sale.total,0), 0, 'รับเงินขาย POS', 0);
  insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
  values (v_sale.tenant_id, v_sale.property_id, v_entry_id, public.gl_map(v_sale.tenant_id, v_sale.property_id,'revenue-pos'), 0, v_net, 'รายได้มินิบาร์/POS', 1);
  if v_vat > 0 then
    insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
    values (v_sale.tenant_id, v_sale.property_id, v_entry_id, public.gl_map(v_sale.tenant_id, v_sale.property_id,'vat-output'), 0, v_vat, 'ภาษีขาย', 2);
  end if;

  return v_entry_id;
end;
$$;
revoke all on function public.gl_post_pos_sale(uuid) from anon, public;
grant execute on function public.gl_post_pos_sale(uuid) to authenticated, service_role;

-- Void/reverse a source's entry (tenant+property scoped). Draft => void it;
-- approved => post a reversing DRAFT (dr/cr swapped) with `:reversal` source_type.
create or replace function public.gl_void_source(
  p_tenant uuid, p_property uuid, p_source_type text, p_source_id text, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_e public.journal_entries; v_new uuid;
begin
  select * into v_e from public.journal_entries
   where tenant_id = p_tenant and property_id = p_property
     and source_type = p_source_type and source_id = p_source_id and status <> 'void'
   order by created_at limit 1;
  if not found then return null; end if;

  if v_e.status = 'draft' then
    update public.journal_entries
       set status = 'void', void_reason = coalesce(p_reason,'source voided')
     where id = v_e.id;
    return v_e.id;
  end if;

  insert into public.journal_entries(tenant_id, property_id, book, entry_date, description, source_type, source_id, reversal_of, status)
  values (v_e.tenant_id, v_e.property_id, v_e.book, (now() at time zone 'Asia/Bangkok')::date,
          'กลับรายการ ' || coalesce(v_e.number, '#' || left(v_e.id::text,8)),
          p_source_type || ':reversal', p_source_id, v_e.id, 'draft')
  returning id into v_new;

  insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
  select v_e.tenant_id, v_e.property_id, v_new, account_code, credit, debit, 'กลับรายการ: ' || coalesce(memo,''), sort_order
    from public.journal_lines where entry_id = v_e.id;

  return v_new;
end;
$$;
revoke all on function public.gl_void_source(uuid, uuid, text, text, text) from anon, public;
grant execute on function public.gl_void_source(uuid, uuid, text, text, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 11. AFTER TRIGGERS (resilient — never abort the business op)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.trg_invoices_gl()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  begin
    if tg_op = 'INSERT' then
      if new.status in ('issued','partial','paid') then perform public.gl_post_invoice(new.id); end if;
    elsif tg_op = 'UPDATE' then
      if new.status in ('issued','partial','paid') and old.status is distinct from new.status then
        perform public.gl_post_invoice(new.id);
      elsif new.status = 'void' and old.status <> 'void' then
        perform public.gl_void_source(new.tenant_id, new.property_id, 'invoice', new.id::text, 'invoice voided');
      end if;
    end if;
  exception when others then
    raise warning 'gl auto-post (invoice %) skipped: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;
drop trigger if exists invoices_gl on public.invoices;
create trigger invoices_gl after insert or update on public.invoices
  for each row execute function public.trg_invoices_gl();

create or replace function public.trg_payments_gl()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  begin
    if tg_op = 'INSERT' then
      perform public.gl_post_payment(new.id);
    elsif tg_op = 'DELETE' then
      perform public.gl_void_source(old.tenant_id, old.property_id, 'payment', old.id::text, 'payment deleted');
    end if;
  exception when others then
    raise warning 'gl auto-post (payment) skipped: %', sqlerrm;
  end;
  if tg_op = 'DELETE' then return old; end if;
  return null;
end;
$$;
drop trigger if exists payments_gl on public.payments;
create trigger payments_gl after insert or delete on public.payments
  for each row execute function public.trg_payments_gl();

create or replace function public.trg_expenses_gl()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  begin
    if tg_op = 'INSERT' then
      if new.status = 'paid' then perform public.gl_post_expense(new.id); end if;
    elsif tg_op = 'UPDATE' then
      if new.status = 'paid' and old.status <> 'paid' then
        perform public.gl_post_expense(new.id);
      elsif new.status = 'void' and old.status <> 'void' then
        perform public.gl_void_source(new.tenant_id, new.property_id, 'expense', new.id::text, new.void_reason);
      end if;
    end if;
  exception when others then
    raise warning 'gl auto-post (expense %) skipped: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;
drop trigger if exists expenses_gl on public.expenses;
create trigger expenses_gl after insert or update on public.expenses
  for each row execute function public.trg_expenses_gl();

create or replace function public.trg_pos_sales_gl()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  begin
    if tg_op = 'INSERT' then
      if not new.voided then perform public.gl_post_pos_sale(new.id); end if;
    elsif tg_op = 'UPDATE' then
      if new.voided and not old.voided then
        perform public.gl_void_source(new.tenant_id, new.property_id, 'pos-sale', new.id::text, coalesce(new.void_reason,'POS sale voided'));
      end if;
    end if;
  exception when others then
    raise warning 'gl auto-post (pos-sale %) skipped: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;
drop trigger if exists pos_sales_gl on public.pos_sales;
create trigger pos_sales_gl after insert or update on public.pos_sales
  for each row execute function public.trg_pos_sales_gl();

-- ─────────────────────────────────────────────────────────────────────
-- 12. BACKFILL (one-shot, idempotent, PER TENANT, with tie-out)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.backfill_journal_entries(p_tenant uuid, p_from date default date '2026-01-01')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record; v_res uuid;
  inv_ok int := 0; inv_skip int := 0; inv_err int := 0;
  pay_ok int := 0; pay_skip int := 0; pay_err int := 0;
  exp_ok int := 0; exp_skip int := 0; exp_err int := 0;
begin
  if (select auth.uid()) is not null and p_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your tenant' using errcode = 'P0001';
  end if;

  for r in select id from public.invoices
           where tenant_id = p_tenant and status in ('issued','partial','paid') and issue_date >= p_from order by id loop
    begin
      v_res := public.gl_post_invoice(r.id);
      if v_res is null then inv_skip := inv_skip + 1; else inv_ok := inv_ok + 1; end if;
    exception when others then inv_err := inv_err + 1; raise warning 'backfill invoice % failed: %', r.id, sqlerrm; end;
  end loop;

  for r in select id from public.payments
           where tenant_id = p_tenant and paid_at >= p_from order by id loop
    begin
      v_res := public.gl_post_payment(r.id);
      if v_res is null then pay_skip := pay_skip + 1; else pay_ok := pay_ok + 1; end if;
    exception when others then pay_err := pay_err + 1; raise warning 'backfill payment % failed: %', r.id, sqlerrm; end;
  end loop;

  for r in select id from public.expenses
           where tenant_id = p_tenant and status = 'paid' and expense_date >= p_from order by id loop
    begin
      v_res := public.gl_post_expense(r.id);
      if v_res is null then exp_skip := exp_skip + 1; else exp_ok := exp_ok + 1; end if;
    exception when others then exp_err := exp_err + 1; raise warning 'backfill expense % failed: %', r.id, sqlerrm; end;
  end loop;

  return jsonb_build_object(
    'tenant', p_tenant, 'from', p_from,
    'invoices', jsonb_build_object('posted', inv_ok, 'skipped', inv_skip, 'errors', inv_err),
    'payments', jsonb_build_object('posted', pay_ok, 'skipped', pay_skip, 'errors', pay_err),
    'expenses', jsonb_build_object('posted', exp_ok, 'skipped', exp_skip, 'errors', exp_err)
  );
end;
$$;
revoke all on function public.backfill_journal_entries(uuid, date) from anon, public;
grant execute on function public.backfill_journal_entries(uuid, date) to authenticated, service_role;

create or replace function public.backfill_pos_journal_entries(p_tenant uuid, p_from date default date '2026-01-01')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record; v_res uuid; v_ok int := 0; v_skip int := 0; v_err int := 0;
  v_gl_debit numeric(14,2); v_sales_sum numeric(14,2);
begin
  if (select auth.uid()) is not null and p_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your tenant' using errcode = 'P0001';
  end if;

  for r in select id from public.pos_sales
           where tenant_id = p_tenant and not voided
             and (created_at at time zone 'Asia/Bangkok')::date >= p_from order by created_at loop
    begin
      v_res := public.gl_post_pos_sale(r.id);
      if v_res is null then v_skip := v_skip + 1; else v_ok := v_ok + 1; end if;
    exception when others then v_err := v_err + 1; raise warning 'backfill pos-sale % failed: %', r.id, sqlerrm; end;
  end loop;

  select coalesce(sum(l.debit),0) into v_gl_debit
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
   where e.tenant_id = p_tenant and e.source_type = 'pos-sale' and e.status <> 'void';
  select coalesce(sum(total),0) into v_sales_sum
    from public.pos_sales
   where tenant_id = p_tenant and not voided and (created_at at time zone 'Asia/Bangkok')::date >= p_from;

  return jsonb_build_object(
    'tenant', p_tenant, 'from', p_from, 'posted', v_ok, 'skipped', v_skip, 'errors', v_err,
    'gl_debit_total', v_gl_debit, 'sales_total', v_sales_sum, 'tie_out', (v_gl_debit = v_sales_sum)
  );
end;
$$;
revoke all on function public.backfill_pos_journal_entries(uuid, date) from anon, public;
grant execute on function public.backfill_pos_journal_entries(uuid, date) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 13. SEED ACCOUNTING FOR EVERY EXISTING (tenant, property) PAIR
-- ─────────────────────────────────────────────────────────────────────
do $$ declare r record;
begin
  for r in select tenant_id, id as property_id from public.properties loop
    perform public.seed_tenant_accounting(r.tenant_id, r.property_id);
  end loop;
end $$;

-- =====================================================================
-- End of migration 22
-- =====================================================================
