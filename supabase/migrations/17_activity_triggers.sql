-- =====================================================================
-- HostGate · Migration 17 — automatic activity logging
-- =====================================================================
-- Populates activity_log via DB triggers (mirrors hotel-pms). A single
-- tenant-aware SECURITY DEFINER trigger function logs create/delete on the key
-- transactional tables, plus status-change updates (guarded by WHEN clauses so
-- routine recompute/stock writes don't spam the trail). actor_id = auth.uid()
-- (null for service-role/anon writes). Idempotent.
-- =====================================================================

create or replace function public.app_log_activity()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  r record;
  v_summary text;
begin
  if TG_OP = 'DELETE' then r := OLD; else r := NEW; end if;

  v_summary := case TG_TABLE_NAME
    when 'bookings'           then coalesce(r.guest_name,'') || ' · ' || coalesce(r.status,'')
    when 'invoices'           then coalesce(r.number,'draft') || ' · ' || coalesce(r.total::text,'') || ' · ' || coalesce(r.status,'')
    when 'payments'           then 'Payment ' || coalesce(r.amount::text,'')
    when 'pos_sales'          then coalesce(r.code,'') || ' · ' || coalesce(r.total::text,'') || (case when r.voided then ' · VOID' else '' end)
    when 'maintenance_orders' then coalesce(r.title,'') || ' · ' || coalesce(r.status,'')
    when 'rental_bills'       then 'Bill ' || coalesce(r.number,'draft') || ' · ' || coalesce(r.total::text,'')
    when 'notes'              then left(coalesce(r.body,''), 48)
    when 'announcements'      then coalesce(r.title,'')
    when 'rooms'              then 'Room ' || coalesce(r.number,'')
    else null
  end;

  insert into public.activity_log (tenant_id, property_id, actor_id, action, entity, entity_id, summary)
  values (r.tenant_id, r.property_id, auth.uid(),
          TG_TABLE_NAME || '.' || lower(TG_OP), TG_TABLE_NAME, r.id::text, v_summary);

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end $$;
revoke all on function public.app_log_activity() from public, anon, authenticated;

-- create/delete logging on the key tables
do $$ declare t text;
begin
  foreach t in array array['bookings','invoices','payments','pos_sales','maintenance_orders','rental_bills','notes','announcements','rooms'] loop
    execute format('drop trigger if exists trg_log_%1$s_ins on public.%1$I', t);
    execute format('create trigger trg_log_%1$s_ins after insert on public.%1$I for each row execute function public.app_log_activity()', t);
    execute format('drop trigger if exists trg_log_%1$s_del on public.%1$I', t);
    execute format('create trigger trg_log_%1$s_del after delete on public.%1$I for each row execute function public.app_log_activity()', t);
  end loop;
end $$;

-- status-change updates only (WHEN-guarded — no spam from routine writes)
drop trigger if exists trg_log_bookings_upd on public.bookings;
create trigger trg_log_bookings_upd after update on public.bookings
  for each row when (old.status is distinct from new.status) execute function public.app_log_activity();

drop trigger if exists trg_log_invoices_upd on public.invoices;
create trigger trg_log_invoices_upd after update on public.invoices
  for each row when (old.status is distinct from new.status) execute function public.app_log_activity();

drop trigger if exists trg_log_pos_sales_upd on public.pos_sales;
create trigger trg_log_pos_sales_upd after update on public.pos_sales
  for each row when (old.voided is distinct from new.voided) execute function public.app_log_activity();

drop trigger if exists trg_log_maint_upd on public.maintenance_orders;
create trigger trg_log_maint_upd after update on public.maintenance_orders
  for each row when (old.status is distinct from new.status) execute function public.app_log_activity();

-- =====================================================================
-- End of migration 17
-- =====================================================================
