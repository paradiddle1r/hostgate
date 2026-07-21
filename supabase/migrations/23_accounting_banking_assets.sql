-- =====================================================================
-- HostGate · Migration 23 — Accounting: banking + fixed assets
-- =====================================================================
-- Multi-tenant port of hotel-pms schema_update_74 (banking half) and 75
-- (fixed assets + straight-line depreciation). Additive only. Depends on
-- migration 22 (chart_of_accounts / journal_entries / gl_period_is_closed).
--
-- All tables carry tenant_id + property_id, the assert_property_in_tenant()
-- guard, and the house RLS. COA references use composite FKs into the
-- per-(tenant,property) chart_of_accounts. run_depreciation() is tenant+property
-- scoped, membership-checked, and posts ONE combined DRAFT general-journal entry
-- per (tenant, property, period), source_id = the 'YYYY-MM' period string.
--
-- Applied to project xwikaqpdulkscdysgxri via MCP apply_migration.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. BANKING — accounts / statements / reconciliation lines
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.bank_accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id)    on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name        text not null,
  bank        text,
  account_no  text,
  coa_code    text not null default '11120',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (tenant_id, property_id, coa_code)
    references public.chart_of_accounts(tenant_id, property_id, code) on update cascade
);
create index if not exists bank_accounts_property_idx on public.bank_accounts(property_id);

create table if not exists public.bank_statements (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id)    on delete cascade,
  property_id     uuid not null references public.properties(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  filename        text,
  period_from     date,
  period_to       date,
  imported_by     uuid,
  created_at      timestamptz not null default now()
);
create index if not exists bank_statements_acct_idx on public.bank_statements(bank_account_id, created_at desc);
create index if not exists bank_statements_property_idx on public.bank_statements(property_id);

create table if not exists public.bank_statement_lines (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id)    on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  statement_id uuid not null references public.bank_statements(id) on delete cascade,
  txn_date     date not null,
  description  text,
  amount       numeric(12,2) not null,                          -- signed: + money in, − money out
  balance      numeric(12,2),
  matched_type text check (matched_type is null or matched_type in ('payment','expense','journal')),
  matched_id   uuid,
  status       text not null default 'unmatched' check (status in ('unmatched','matched','ignored')),
  created_at   timestamptz not null default now()
);
create index if not exists bank_lines_stmt_idx   on public.bank_statement_lines(statement_id, txn_date);
create index if not exists bank_lines_status_idx  on public.bank_statement_lines(property_id, status);
create index if not exists bank_lines_match_idx   on public.bank_statement_lines(matched_type, matched_id);

drop trigger if exists bank_accounts_touch on public.bank_accounts;
create trigger bank_accounts_touch before update on public.bank_accounts
  for each row execute function public.trg_acct_touch();

-- ─────────────────────────────────────────────────────────────────────
-- 2. FIXED ASSETS + depreciation lines
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.fixed_assets (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id)    on delete cascade,
  property_id        uuid not null references public.properties(id) on delete cascade,
  code               text not null,                                 -- FA-0001 (app-minted), unique per tenant
  name               text not null,
  category           text,
  acquired_date      date not null,
  cost               numeric(12,2) not null check (cost >= 0),
  salvage            numeric(12,2) not null default 1.00 check (salvage >= 0),
  useful_life_months int  not null check (useful_life_months > 0),
  method             text not null default 'straight-line' check (method in ('straight-line')),
  accum_depreciation numeric(12,2) not null default 0 check (accum_depreciation >= 0),
  coa_asset_code     text not null,
  coa_accum_code     text not null,
  coa_expense_code   text not null default '52510',
  status             text not null default 'active' check (status in ('active','disposed','fully-depreciated')),
  disposed_at        date,
  notes              text,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, code),
  foreign key (tenant_id, property_id, coa_asset_code)   references public.chart_of_accounts(tenant_id, property_id, code) on update cascade,
  foreign key (tenant_id, property_id, coa_accum_code)   references public.chart_of_accounts(tenant_id, property_id, code) on update cascade,
  foreign key (tenant_id, property_id, coa_expense_code) references public.chart_of_accounts(tenant_id, property_id, code) on update cascade
);
create index if not exists fixed_assets_property_idx on public.fixed_assets(property_id);
create index if not exists fixed_assets_status_idx   on public.fixed_assets(property_id, status);
create index if not exists fixed_assets_category_idx  on public.fixed_assets(property_id, category);

create table if not exists public.asset_depreciation_lines (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id)    on delete cascade,
  property_id      uuid not null references public.properties(id) on delete cascade,
  asset_id         uuid not null references public.fixed_assets(id) on delete cascade,
  period           text not null check (period ~ '^\d{4}-\d{2}$'),
  amount           numeric(12,2) not null check (amount > 0),
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (asset_id, period)
);
create index if not exists asset_dep_lines_asset_idx  on public.asset_depreciation_lines(asset_id);
create index if not exists asset_dep_lines_period_idx  on public.asset_depreciation_lines(property_id, period);
create index if not exists asset_dep_lines_je_idx      on public.asset_depreciation_lines(journal_entry_id);

drop trigger if exists fixed_assets_touch on public.fixed_assets;
create trigger fixed_assets_touch before update on public.fixed_assets
  for each row execute function public.trg_acct_touch();

-- ─────────────────────────────────────────────────────────────────────
-- 3. DEPRECIATION RUNNER (per tenant+property, one calendar month)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.run_depreciation(p_tenant uuid, p_property uuid, p_period text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_period_end date; v_je_id uuid; v_je_status text; a record;
  v_base numeric(12,2); v_monthly numeric(12,2); v_amount numeric(12,2); v_remaining numeric(12,2);
  v_acq_month text; v_dim int; v_held int; v_new_accum numeric(12,2);
  v_processed int := 0; v_created int := 0; v_total numeric(14,2) := 0;
begin
  if (select auth.uid()) is not null and p_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your tenant' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.properties where id = p_property and tenant_id = p_tenant) then
    raise exception 'HG-PROP-404: property % not in tenant %', p_property, p_tenant using errcode = 'P0001';
  end if;
  if p_period !~ '^\d{4}-\d{2}$' then
    raise exception 'invalid period % (expected YYYY-MM)', p_period;
  end if;
  v_period_end := ((p_period || '-01')::date + interval '1 month' - interval '1 day')::date;

  if public.gl_period_is_closed(p_tenant, p_property, p_period) then
    raise exception 'accounting period % is closed', p_period;
  end if;

  select id, status into v_je_id, v_je_status
    from public.journal_entries
   where tenant_id = p_tenant and property_id = p_property
     and source_type = 'depreciation' and source_id = p_period and status <> 'void'
   order by created_at limit 1;

  if v_je_id is not null and v_je_status = 'approved' then
    return jsonb_build_object('period', p_period, 'status', 'already-approved',
                              'entry_id', v_je_id, 'assets_processed', 0, 'lines_created', 0);
  end if;

  -- 1. Post a line for every eligible asset that doesn't have one yet.
  for a in
    select fa.* from public.fixed_assets fa
     where fa.tenant_id = p_tenant and fa.property_id = p_property
       and fa.status = 'active' and fa.acquired_date <= v_period_end and fa.useful_life_months > 0
       and round(fa.cost - fa.salvage, 2) - coalesce(fa.accum_depreciation,0) > 0
       and not exists (select 1 from public.asset_depreciation_lines l
                       where l.asset_id = fa.id and l.period = p_period)
     order by fa.code
  loop
    v_processed := v_processed + 1;
    v_base    := round(a.cost - a.salvage, 2);
    v_monthly := round(v_base / a.useful_life_months, 2);

    v_acq_month := to_char(a.acquired_date, 'YYYY-MM');
    if p_period = v_acq_month then
      v_dim  := extract(day from (date_trunc('month', a.acquired_date) + interval '1 month' - interval '1 day'))::int;
      v_held := v_dim - extract(day from a.acquired_date)::int + 1;
      v_amount := round(v_monthly * v_held::numeric / v_dim::numeric, 2);
    else
      v_amount := v_monthly;
    end if;

    v_remaining := round(v_base - coalesce(a.accum_depreciation,0), 2);
    if v_amount > v_remaining then v_amount := v_remaining; end if;
    if v_amount <= 0 then continue; end if;

    insert into public.asset_depreciation_lines(tenant_id, property_id, asset_id, period, amount)
    values (p_tenant, p_property, a.id, p_period, v_amount);

    v_new_accum := round(coalesce(a.accum_depreciation,0) + v_amount, 2);
    update public.fixed_assets
       set accum_depreciation = v_new_accum,
           status = case when v_new_accum >= v_base then 'fully-depreciated' else status end
     where id = a.id;

    v_created := v_created + 1;
  end loop;

  -- 2. (Re)build ONE combined draft general-journal entry from ALL period lines.
  if v_je_id is not null then
    delete from public.journal_entries where id = v_je_id;   -- draft only (approved returned early)
    v_je_id := null;
  end if;

  if exists (select 1 from public.asset_depreciation_lines
             where tenant_id = p_tenant and property_id = p_property and period = p_period) then
    insert into public.journal_entries(tenant_id, property_id, book, entry_date, description, source_type, source_id, status)
    values (p_tenant, p_property, 'general', v_period_end, 'ค่าเสื่อมราคา ' || p_period, 'depreciation', p_period, 'draft')
    returning id into v_je_id;

    insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
    select p_tenant, p_property, v_je_id, fa.coa_expense_code, round(sum(l.amount),2), 0, 'ค่าเสื่อมราคา',
           (row_number() over (order by fa.coa_expense_code) - 1)::int
      from public.asset_depreciation_lines l
      join public.fixed_assets fa on fa.id = l.asset_id
     where l.tenant_id = p_tenant and l.property_id = p_property and l.period = p_period
     group by fa.coa_expense_code;

    insert into public.journal_lines(tenant_id, property_id, entry_id, account_code, debit, credit, memo, sort_order)
    select p_tenant, p_property, v_je_id, fa.coa_accum_code, 0, round(sum(l.amount),2), 'ค่าเสื่อมราคาสะสม',
           (1000 + row_number() over (order by fa.coa_accum_code))::int
      from public.asset_depreciation_lines l
      join public.fixed_assets fa on fa.id = l.asset_id
     where l.tenant_id = p_tenant and l.property_id = p_property and l.period = p_period
     group by fa.coa_accum_code;

    update public.asset_depreciation_lines set journal_entry_id = v_je_id
     where tenant_id = p_tenant and property_id = p_property and period = p_period;

    select coalesce(sum(amount),0) into v_total from public.asset_depreciation_lines
     where tenant_id = p_tenant and property_id = p_property and period = p_period;
  end if;

  return jsonb_build_object('period', p_period, 'status', 'ok', 'assets_processed', v_processed,
                            'lines_created', v_created, 'entry_id', v_je_id, 'total_amount', coalesce(v_total,0));
end;
$$;
revoke all on function public.run_depreciation(uuid, uuid, text) from anon, public;
grant execute on function public.run_depreciation(uuid, uuid, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 4. GUARDS + RLS (house pattern) for every new table
-- ─────────────────────────────────────────────────────────────────────
do $$ declare t text;
begin
  foreach t in array array[
    'bank_accounts','bank_statements','bank_statement_lines','fixed_assets','asset_depreciation_lines'
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
-- 5. SEED one bank account per property from its stored bank fields
-- ─────────────────────────────────────────────────────────────────────
insert into public.bank_accounts (tenant_id, property_id, name, bank, account_no, coa_code, active)
select p.tenant_id, p.id,
       coalesce(nullif(trim(p.bank_account_name),''), nullif(trim(p.bank_name),''), 'บัญชีหลัก'),
       nullif(trim(p.bank_name),''),
       nullif(trim(p.bank_account),''),
       '11120', true
from public.properties p
where not exists (select 1 from public.bank_accounts b where b.property_id = p.id);

-- =====================================================================
-- End of migration 23
-- =====================================================================
