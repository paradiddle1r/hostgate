-- =====================================================================
-- HostGate · Migration 22 — Device tokens + push queue         ★ DRAFT ★
-- =====================================================================
-- STATUS: NOT APPLIED. Loop task 02a reviews, applies, then moves this to
-- supabase/migrations/22_device_tokens_push.sql.
--
-- Foundation for FCM push (both apps, both platforms — APNs rides through
-- Firebase). DB side only; the `push-fanout` edge function (task 02b) drains
-- the queue and talks to FCM v1.
--
--   device_tokens — one row per (user, device). audience 'owner' | 'tenant'
--                   tells fanout which app the token belongs to.
--   push_queue    — outbox. Triggers enqueue; fanout resolves recipients,
--                   sends, stamps sent_at/error. pg_cron drains every minute.
-- =====================================================================

create table if not exists public.device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null unique,
  platform   text not null check (platform in ('android','ios','web')),
  audience   text not null check (audience in ('owner','tenant')),
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on public.device_tokens(user_id);
alter table public.device_tokens enable row level security;
drop policy if exists device_tokens_self on public.device_tokens;
create policy device_tokens_self on public.device_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.register_device_token(p_token text, p_platform text, p_audience text)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if auth.uid() is null then raise exception 'HG-AUTH-401' using errcode='P0001'; end if;
  if p_platform not in ('android','ios','web') or p_audience not in ('owner','tenant') then
    raise exception 'HG-VALIDATION-422' using errcode='P0001'; end if;
  insert into public.device_tokens (user_id, token, platform, audience)
  values (auth.uid(), p_token, p_platform, p_audience)
  on conflict (token) do update set user_id = excluded.user_id, last_seen = now();
end $$;
revoke all on function public.register_device_token(text, text, text) from anon, public;
grant execute on function public.register_device_token(text, text, text) to authenticated;

create or replace function public.unregister_device_token(p_token text)
returns void language sql security definer set search_path to 'public','pg_temp' as $$
  delete from public.device_tokens where token = p_token and user_id = auth.uid();
$$;
revoke all on function public.unregister_device_token(text) from anon, public;
grant execute on function public.unregister_device_token(text) to authenticated;

-- ── outbox ────────────────────────────────────────────────────────────
create table if not exists public.push_queue (
  id          bigserial primary key,
  event       text not null,           -- booking_created | payment_submitted | bill_issued | payment_verified | repair_updated
  tenant_id   uuid not null,
  property_id uuid,
  -- audience + optional single recipient. user_id null → fanout resolves all
  -- members of tenant_id (owner audience) from tenant_members.
  audience    text not null check (audience in ('owner','tenant')),
  user_id     uuid,
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}'::jsonb,   -- deep-link payload
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  error       text
);
create index if not exists push_queue_unsent_idx on public.push_queue(created_at) where sent_at is null;
alter table public.push_queue enable row level security;   -- no client policies: service-role only

-- ── enqueue triggers ─────────────────────────────────────────────────
create or replace function public.push_on_booking_insert()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  insert into public.push_queue (event, tenant_id, property_id, audience, title, body, data)
  values ('booking_created', new.tenant_id, new.property_id, 'owner',
          'New booking', coalesce(new.guest_name,'Guest') || ' · ' || new.check_in || ' → ' || new.check_out,
          jsonb_build_object('type','booking','id',new.id));
  return new;
end $$;
drop trigger if exists push_booking_insert on public.bookings;
create trigger push_booking_insert after insert on public.bookings
  for each row execute function public.push_on_booking_insert();

create or replace function public.push_on_payment_insert()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  insert into public.push_queue (event, tenant_id, property_id, audience, title, body, data)
  values ('payment_submitted', new.tenant_id, new.property_id, 'owner',
          'Payment slip submitted', '฿' || new.amount || ' awaiting review',
          jsonb_build_object('type','payment','id',new.id,'bill_id',new.bill_id));
  return new;
end $$;
drop trigger if exists push_payment_insert on public.rental_payments;
create trigger push_payment_insert after insert on public.rental_payments
  for each row execute function public.push_on_payment_insert();

create or replace function public.push_on_bill_issued()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_user uuid;
begin
  if new.status = 'issued' and coalesce(old.status,'') <> 'issued' then
    select rt.portal_user_id into v_user from public.rental_tenants rt
      where rt.booking_id = new.booking_id and rt.portal_user_id is not null limit 1;
    if v_user is not null then
      insert into public.push_queue (event, tenant_id, property_id, audience, user_id, title, body, data)
      values ('bill_issued', new.tenant_id, new.property_id, 'tenant', v_user,
              'New bill', 'Your ' || coalesce(new.period_month,'monthly') || ' bill: ฿' || new.total,
              jsonb_build_object('type','bill','id',new.id));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists push_bill_issued on public.rental_bills;
create trigger push_bill_issued after update on public.rental_bills
  for each row execute function public.push_on_bill_issued();

create or replace function public.push_on_payment_reviewed()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_user uuid;
begin
  if new.status in ('verified','rejected') and old.status = 'pending' then
    select rt.portal_user_id into v_user from public.rental_tenants rt where rt.id = new.rental_tenant_id;
    if v_user is not null then
      insert into public.push_queue (event, tenant_id, property_id, audience, user_id, title, body, data)
      values ('payment_verified', new.tenant_id, new.property_id, 'tenant', v_user,
              case when new.status='verified' then 'Payment confirmed ✓' else 'Payment needs attention' end,
              '฿' || new.amount || case when new.status='verified' then ' received — thank you!' else ' was rejected, please contact the office' end,
              jsonb_build_object('type','payment','id',new.id));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists push_payment_reviewed on public.rental_payments;
create trigger push_payment_reviewed after update on public.rental_payments
  for each row execute function public.push_on_payment_reviewed();

-- keep trigger fns out of the client RPC surface (mig-20 posture)
revoke all on function public.push_on_booking_insert()    from anon, authenticated, public;
revoke all on function public.push_on_payment_insert()    from anon, authenticated, public;
revoke all on function public.push_on_bill_issued()       from anon, authenticated, public;
revoke all on function public.push_on_payment_reviewed()  from anon, authenticated, public;

-- ── drain schedule (task 02b — after push-fanout is deployed) ────────
-- select cron.schedule('push-fanout-drain','* * * * *',
--   $$select net.http_post(
--       url:='https://xwikaqpdulkscdysgxri.supabase.co/functions/v1/push-fanout',
--       headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='service_role_key'),'Content-Type','application/json'),
--       body:='{}'::jsonb)$$);
