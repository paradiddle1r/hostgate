-- =====================================================================
-- HostGate · Migration 20 — security hardening (applied live)
-- =====================================================================
-- Full-system security pass over the multi-tenant customer database. Tenant
-- isolation itself was already solid — every per-tenant table gates on
-- `tenant_id IN (SELECT auth_tenant_ids())` scoped to `authenticated`. This
-- migration closes the real gaps the Supabase advisor + a manual review found:
--
--   1. DROP echo_uid() — a debug function that returned the caller's full JWT
--      (auth.jwt()). No legitimate caller; pure attack-surface / info leak.
--
--   2. Tenant guard on next_doc_number() + next_rental_number(). Before, any
--      signed-in user could pass ANOTHER tenant's property_id and bump that
--      tenant's invoice / receipt / rental sequence counters (cross-tenant
--      integrity tamper — gaps or races in their document numbering). Now they
--      reject with HG-AUTH-403 unless the property's tenant is one of the
--      caller's, matching the guard pos_create_sale() already had.
--
--   3. Trigger-only functions handle_new_user() + touch_updated_at(): pin
--      search_path (clears the mutable-search-path warning) and REVOKE client
--      EXECUTE so they can't be invoked via /rest/v1/rpc. Triggers keep firing
--      regardless of EXECUTE grants.
--
--   4. Storage: the PUBLIC company-assets bucket had a broad {public} SELECT
--      policy that let anyone LIST every file across all tenants. Public
--      buckets serve objects by URL without it, so it's dropped to stop
--      cross-tenant filename enumeration. (Bucket was empty — zero breakage.)
--
-- Accepted / out-of-scope (intentional, not fixed here):
--   • public_availability / public_quote / public_create_booking /
--     public_property_by_code — anon-callable ON PURPOSE (the public booking
--     engine). They read/write only via their own property scope.
--   • app_* member RPCs, is_tenant_member, auth_tenant_ids, is_platform_admin,
--     next_doc_number, next_rental_number, pos_create_sale — the intended
--     authenticated RPC surface; each authorizes per call internally.
--   • *_counters tables: RLS on + no policy = deny-all to clients (correct);
--     written only through the SECURITY DEFINER counter RPCs.
--   • pg_net in public schema — Supabase-managed; moving it is risky.
--
-- STILL REQUIRES A DASHBOARD ACTION (cannot be set via SQL):
--   • Auth → Passwords → enable "Leaked password protection" (HaveIBeenPwned).
-- =====================================================================

drop function if exists public.echo_uid();

create or replace function public.next_doc_number(p_property uuid, p_kind text)
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_year int; v_seq int; v_prefix text; v_tenant uuid;
begin
  select tenant_id into v_tenant from public.properties where id = p_property;
  if v_tenant is null then raise exception 'HG-PROP-404: property not found' using errcode='P0001'; end if;
  if v_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your property' using errcode='P0001'; end if;
  v_year := extract(year from (now() at time zone 'Asia/Bangkok'))::int;
  if p_kind = 'receipt' then
    insert into public.receipt_counters(property_id, year, seq) values (p_property, v_year, 1)
      on conflict (property_id, year) do update set seq = public.receipt_counters.seq + 1 returning seq into v_seq;
    v_prefix := 'RC';
  else
    insert into public.invoice_counters(property_id, year, seq) values (p_property, v_year, 1)
      on conflict (property_id, year) do update set seq = public.invoice_counters.seq + 1 returning seq into v_seq;
    select coalesce(nullif(invoice_prefix,''),'INV') into v_prefix from public.properties where id = p_property;
  end if;
  return v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end $function$;

create or replace function public.next_rental_number(p_property uuid, p_kind text)
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_year int := extract(year from (now() at time zone 'Asia/Bangkok'))::int;
  v_seq int; v_prefix text := case p_kind when 'contract' then 'CT' else 'BILL' end; v_tenant uuid;
begin
  select tenant_id into v_tenant from public.properties where id = p_property;
  if v_tenant is null then raise exception 'HG-PROP-404: property not found' using errcode='P0001'; end if;
  if v_tenant not in (select public.auth_tenant_ids()) then
    raise exception 'HG-AUTH-403: not your property' using errcode='P0001'; end if;
  insert into public.rental_counters (property_id, year, kind, seq) values (p_property, v_year, p_kind, 1)
    on conflict (property_id, year, kind) do update set seq = public.rental_counters.seq + 1 returning seq into v_seq;
  return v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end $function$;
grant execute on function public.next_doc_number(uuid, text) to authenticated;
grant execute on function public.next_rental_number(uuid, text) to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $function$
begin new.updated_at := now(); return new; end $function$;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;

drop policy if exists "company_assets_read" on storage.objects;
