-- =====================================================================
-- HostGate · Migration 24 — Accounting: VAT reports (Phase 4 / HG-P2)
-- =====================================================================
-- Multi-tenant port of hotel-pms schema_update_73. Two read-only, SECURITY
-- DEFINER report functions the /app accounting VAT tab + print route drive:
--   vat_sales_report(tenant, property, year, month)    — รายงานภาษีขาย
--   vat_purchase_report(tenant, property, year, month) — รายงานภาษีซื้อ
--
-- Adaptation from the single-tenant source:
--   • (p_tenant, p_property) added; every source is filtered by BOTH, so the
--     report is per legal entity — a property carries its own tax id.
--   • Membership check = the HG-P1 pattern (gl_trial_balance / issue_*):
--     skipped when auth.uid() is null (service_role / a definer-chain caller),
--     else HG-AUTH-403 for a cross-tenant caller. This REPLACES the hotel-pms
--     profiles/role_permissions `pms:accounting` READ gate — that model was
--     dropped in the HG port; role gating lives in the app layer (mig 21 note).
--   • The invoices status filter is ('issued','partial','paid'): HG adds the
--     'partial' (part-paid) status the single-tenant source lacked. A part-paid
--     tax invoice is still issued, so its output VAT belongs in the report —
--     and this matches gl_post_invoice()'s posting condition (migration 22),
--     keeping the VAT report and the GL sales book consistent.
--   • Sales side = issued/part-paid/paid invoices (positive) UNION approved
--     credit-notes (NEGATIVE) + debit-notes (positive) from sales_documents.
--     Purchase side = expenses with vat_amount > 0 and status pending|paid.
--     net = total − vat_amount (the pre-VAT taxable base). Void is excluded.
--   • Column names verified against the LIVE schema: invoices carry the
--     guest_company_name[_th] / guest_branch parity columns (migration 15).
--
-- Additive only: two functions, no tables / columns / policies. Reuses the
-- membership chokepoint auth_tenant_ids() (migration 04). Idempotent.
-- Applied to project xwikaqpdulkscdysgxri via MCP apply_migration.
-- =====================================================================

-- ── 1. SALES VAT REPORT (รายงานภาษีขาย) ──────────────────────────────
-- Blank tax_id / branch is legal in the RD report for B2C (walk-in guest) rows.
create or replace function public.vat_sales_report(
  p_tenant uuid, p_property uuid, p_year int, p_month int
)
returns table (
  seq            int,
  doc_date       date,
  doc_number     text,
  customer_name  text,
  tax_id         text,
  branch         text,
  net_amount     numeric,
  vat_amount     numeric,
  doc_kind       text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_from date := make_date(p_year, p_month, 1);
  v_to   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
begin
  -- Membership gate (mirror gl_trial_balance / issue_*). Skipped for the
  -- service-role / definer context where auth.uid() is null.
  if (select auth.uid()) is not null and p_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your tenant' using errcode = 'P0001';
  end if;

  return query
  with src as (
    -- Tax invoices (positive) — issued, part-paid, or fully paid.
    select
      i.issue_date as doc_date,
      i.number     as doc_number,
      coalesce(nullif(i.guest_company_name_th, ''), nullif(i.guest_company_name, ''),
               nullif(i.guest_name, ''), c.name, '') as customer_name,
      coalesce(nullif(i.guest_tax_id, ''), c.tax_id) as tax_id,
      coalesce(nullif(i.guest_branch, ''), c.branch) as branch,
      round(i.total - i.vat_amount, 2) as net_amount,
      round(i.vat_amount, 2)           as vat_amount,
      'invoice'::text                  as doc_kind
    from public.invoices i
    left join public.contacts c on c.id = i.contact_id
    where i.tenant_id = p_tenant and i.property_id = p_property
      and i.status in ('issued', 'partial', 'paid')
      and i.issue_date >= v_from and i.issue_date < v_to

    union all

    -- Credit notes (NEGATIVE) + debit notes (positive), approved only.
    select
      d.issue_date,
      d.number,
      coalesce(nullif(d.customer_company_name_th, ''), nullif(d.customer_company_name, ''),
               nullif(d.customer_name, ''), c.name, ''),
      coalesce(nullif(d.customer_tax_id, ''), c.tax_id),
      coalesce(nullif(d.customer_branch, ''), c.branch),
      case when d.doc_type = 'credit-note' then -round(d.total - d.vat_amount, 2)
           else round(d.total - d.vat_amount, 2) end,
      case when d.doc_type = 'credit-note' then -round(d.vat_amount, 2)
           else round(d.vat_amount, 2) end,
      d.doc_type
    from public.sales_documents d
    left join public.contacts c on c.id = d.contact_id
    where d.tenant_id = p_tenant and d.property_id = p_property
      and d.doc_type in ('credit-note', 'debit-note')
      and d.status = 'approved'
      and d.issue_date >= v_from and d.issue_date < v_to
  )
  select
    (row_number() over (order by s.doc_date, s.doc_number nulls last))::int,
    s.doc_date, s.doc_number, s.customer_name, s.tax_id, s.branch,
    s.net_amount, s.vat_amount, s.doc_kind
  from src s
  order by s.doc_date, s.doc_number nulls last;
end;
$$;
revoke all on function public.vat_sales_report(uuid, uuid, int, int) from anon, public;
grant execute on function public.vat_sales_report(uuid, uuid, int, int) to authenticated, service_role;

-- ── 2. PURCHASE VAT REPORT (รายงานภาษีซื้อ) ──────────────────────────
create or replace function public.vat_purchase_report(
  p_tenant uuid, p_property uuid, p_year int, p_month int
)
returns table (
  seq          int,
  doc_date     date,
  doc_ref      text,
  vendor_name  text,
  tax_id       text,
  branch       text,
  net_amount   numeric,
  vat_amount   numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_from date := make_date(p_year, p_month, 1);
  v_to   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
begin
  if (select auth.uid()) is not null and p_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your tenant' using errcode = 'P0001';
  end if;

  return query
  select
    (row_number() over (order by e.expense_date, e.id))::int as seq,
    e.expense_date as doc_date,
    e.doc_ref      as doc_ref,
    coalesce(c.name, nullif(e.description, ''), '') as vendor_name,
    c.tax_id  as tax_id,
    c.branch  as branch,
    round(e.total - e.vat_amount, 2) as net_amount,
    round(e.vat_amount, 2)           as vat_amount
  from public.expenses e
  left join public.contacts c on c.id = e.contact_id
  where e.tenant_id = p_tenant and e.property_id = p_property
    and e.vat_amount > 0
    and e.status in ('pending', 'paid')
    and e.expense_date >= v_from and e.expense_date < v_to
  order by e.expense_date, e.id;
end;
$$;
revoke all on function public.vat_purchase_report(uuid, uuid, int, int) from anon, public;
grant execute on function public.vat_purchase_report(uuid, uuid, int, int) to authenticated, service_role;

-- =====================================================================
-- End of migration 24
-- =====================================================================
