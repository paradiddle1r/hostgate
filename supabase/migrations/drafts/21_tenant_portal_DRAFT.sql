-- =====================================================================
-- HostGate · Migration 21 — Tenant portal foundation          ★ DRAFT ★
-- =====================================================================
-- STATUS: NOT APPLIED. Loop task 03a reviews this, applies it via MCP/CLI,
-- then moves the file to supabase/migrations/21_tenant_portal.sql.
--
-- Adds the tenant-facing identity + payment surface for the Tenant app:
--  • rental_tenants.portal_user_id / portal_invite_code — invite-code linking
--  • properties.promptpay_id — renders the PromptPay QR on bills
--  • rental_payments — tenant slip submissions (pending → verified/rejected)
--  • maintenance_orders.source — 'staff' | 'tenant' repair requests
--  • private storage bucket tenant-slips
--  • "portal" RLS: a linked tenant reads ONLY their own rows; they have no
--    tenant_members row and must never gain staff-level access.
-- All statements idempotent + additive.
-- =====================================================================

-- ── columns ──────────────────────────────────────────────────────────
alter table public.rental_tenants
  add column if not exists portal_user_id uuid references auth.users(id) on delete set null,
  add column if not exists portal_invite_code text unique,
  add column if not exists portal_linked_at timestamptz;
create index if not exists rental_tenants_portal_user_idx on public.rental_tenants(portal_user_id);

alter table public.properties
  add column if not exists promptpay_id text;          -- phone / national-id / e-wallet id

alter table public.maintenance_orders
  add column if not exists source text not null default 'staff'
    check (source in ('staff','tenant'));

-- ── rental_payments (slip submissions) ───────────────────────────────
create table if not exists public.rental_payments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  bill_id     uuid not null references public.rental_bills(id) on delete cascade,
  rental_tenant_id uuid not null references public.rental_tenants(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  slip_path   text,                                    -- storage object in tenant-slips
  status      text not null default 'pending' check (status in ('pending','verified','rejected')),
  note        text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists rental_payments_bill_idx   on public.rental_payments(bill_id);
create index if not exists rental_payments_status_idx on public.rental_payments(property_id, status);
alter table public.rental_payments enable row level security;

-- staff side: same tenant-scope pattern as every other per-tenant table
drop policy if exists rental_payments_tenant_rw on public.rental_payments;
create policy rental_payments_tenant_rw on public.rental_payments
  for all to authenticated
  using (tenant_id in (select public.auth_tenant_ids()))
  with check (tenant_id in (select public.auth_tenant_ids()));

-- ── portal read policies (tenant sees only their own rows) ───────────
-- NOTE deny-by-default: these ADD access for linked portal users; staff
-- policies above stay untouched. auth.uid() wrapped in (select …) (initplan).
drop policy if exists portal_read_own_rental_tenant on public.rental_tenants;
create policy portal_read_own_rental_tenant on public.rental_tenants
  for select to authenticated
  using (portal_user_id = (select auth.uid()));

drop policy if exists portal_read_own_bills on public.rental_bills;
create policy portal_read_own_bills on public.rental_bills
  for select to authenticated
  using (exists (select 1 from public.rental_tenants rt
                 where rt.booking_id = rental_bills.booking_id
                   and rt.portal_user_id = (select auth.uid())));

drop policy if exists portal_read_own_contracts on public.rental_contracts;
create policy portal_read_own_contracts on public.rental_contracts
  for select to authenticated
  using (exists (select 1 from public.rental_tenants rt
                 where rt.booking_id = rental_contracts.booking_id
                   and rt.portal_user_id = (select auth.uid())));

drop policy if exists portal_read_own_meters on public.meter_readings;
create policy portal_read_own_meters on public.meter_readings
  for select to authenticated
  using (exists (select 1 from public.rental_tenants rt
                 where rt.booking_id = meter_readings.booking_id
                   and rt.portal_user_id = (select auth.uid())));

drop policy if exists portal_read_announcements on public.announcements;
create policy portal_read_announcements on public.announcements
  for select to authenticated
  using (exists (select 1 from public.rental_tenants rt
                 where rt.property_id = announcements.property_id
                   and rt.portal_user_id = (select auth.uid())));

drop policy if exists portal_rw_own_payments on public.rental_payments;
create policy portal_rw_own_payments on public.rental_payments
  for select to authenticated
  using (exists (select 1 from public.rental_tenants rt
                 where rt.id = rental_payments.rental_tenant_id
                   and rt.portal_user_id = (select auth.uid())));
-- inserts go through the RPC below (validates bill/amount), not direct insert.

drop policy if exists portal_read_own_repairs on public.maintenance_orders;
create policy portal_read_own_repairs on public.maintenance_orders
  for select to authenticated
  using (source = 'tenant' and created_by = (select auth.uid()));

-- ── RPCs (SECURITY DEFINER, self-authorizing — posture like mig 20) ──
create or replace function public.tenant_portal_link(p_code text)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'HG-AUTH-401: sign in first' using errcode='P0001'; end if;
  update public.rental_tenants
     set portal_user_id = auth.uid(), portal_linked_at = now()
   where portal_invite_code = upper(trim(p_code)) and portal_user_id is null
   returning id into v_id;
  if v_id is null then
    raise exception 'HG-VALIDATION-422: invalid or already-used invite code' using errcode='P0001';
  end if;
  return v_id;
end $$;
revoke all on function public.tenant_portal_link(text) from anon, public;
grant execute on function public.tenant_portal_link(text) to authenticated;

create or replace function public.tenant_submit_payment(p_bill uuid, p_amount numeric, p_slip_path text, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_rt public.rental_tenants%rowtype; v_bill public.rental_bills%rowtype; v_id uuid;
begin
  select b.* into v_bill from public.rental_bills b where b.id = p_bill;
  if v_bill.id is null then raise exception 'HG-BILL-404: bill not found' using errcode='P0001'; end if;
  select rt.* into v_rt from public.rental_tenants rt
   where rt.booking_id = v_bill.booking_id and rt.portal_user_id = auth.uid();
  if v_rt.id is null then raise exception 'HG-AUTH-403: not your bill' using errcode='P0001'; end if;
  if v_bill.status <> 'issued' then raise exception 'HG-VALIDATION-422: bill is not awaiting payment' using errcode='P0001'; end if;
  if p_amount <= 0 then raise exception 'HG-VALIDATION-422: bad amount' using errcode='P0001'; end if;
  insert into public.rental_payments (tenant_id, property_id, bill_id, rental_tenant_id, amount, slip_path, note)
  values (v_bill.tenant_id, v_bill.property_id, v_bill.id, v_rt.id, p_amount, p_slip_path, p_note)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.tenant_submit_payment(uuid, numeric, text, text) from anon, public;
grant execute on function public.tenant_submit_payment(uuid, numeric, text, text) to authenticated;

-- ── storage: private slips bucket ─────────────────────────────────────
insert into storage.buckets (id, name, public) values ('tenant-slips','tenant-slips', false)
on conflict (id) do nothing;
-- path convention: <rental_tenant_id>/<uuid>.jpg — tenant writes own folder,
-- staff of the owning tenant org read via their org membership.
drop policy if exists tenant_slips_write on storage.objects;
create policy tenant_slips_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'tenant-slips'
  and exists (select 1 from public.rental_tenants rt
              where rt.id::text = split_part(name,'/',1)
                and rt.portal_user_id = (select auth.uid()))
);
drop policy if exists tenant_slips_read on storage.objects;
create policy tenant_slips_read on storage.objects for select to authenticated
using (
  bucket_id = 'tenant-slips'
  and (
    exists (select 1 from public.rental_tenants rt
            where rt.id::text = split_part(name,'/',1)
              and rt.portal_user_id = (select auth.uid()))
    or exists (select 1 from public.rental_tenants rt
               where rt.id::text = split_part(name,'/',1)
                 and rt.tenant_id in (select public.auth_tenant_ids()))
  )
);
