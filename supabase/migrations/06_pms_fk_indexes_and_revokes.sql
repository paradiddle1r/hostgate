-- =====================================================================
-- HostGate · Migration 06 — FK covering indexes + trigger-fn lockdown
-- =====================================================================
-- Follow-up to migration 05 from the Supabase advisor: cover the foreign
-- keys it flagged (tenant_id especially — RLS filters on it every query),
-- and revoke client EXECUTE on the trigger-only helper functions (they fire
-- inside triggers; nothing should call them via PostgREST RPC).
-- auth_tenant_ids() deliberately KEEPS authenticated EXECUTE — RLS policies
-- call it as the user. Applied via MCP name="pms_fk_indexes_and_revokes".
-- =====================================================================

create index if not exists bookings_guest_idx       on public.bookings(guest_id);
create index if not exists bookings_room_type_idx   on public.bookings(room_type_id);
create index if not exists bookings_tenant_idx      on public.bookings(tenant_id);
create index if not exists daily_rates_property_idx on public.daily_rates(property_id);
create index if not exists daily_rates_tenant_idx   on public.daily_rates(tenant_id);
create index if not exists guests_tenant_idx        on public.guests(tenant_id);
create index if not exists rooms_tenant_idx         on public.rooms(tenant_id);

revoke execute on function public.gen_property_code()         from anon, authenticated, public;
revoke execute on function public.enforce_property_limit()    from anon, authenticated, public;
revoke execute on function public.assert_property_in_tenant() from anon, authenticated, public;
revoke execute on function public.assert_no_room_conflict()   from anon, authenticated, public;
revoke execute on function public.gen_booking_code()          from anon, authenticated, public;
