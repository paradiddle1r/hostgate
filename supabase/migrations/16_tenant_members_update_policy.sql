-- =====================================================================
-- HostGate · Migration 16 — tenant_members UPDATE policy
-- =====================================================================
-- Migration 01 gave tenant_members SELECT/INSERT/DELETE policies but no
-- UPDATE — so the parity features that write is_active (disable member) and
-- position (staff roster) affected 0 rows under RLS. This adds an owner/admin
-- UPDATE policy. Role changes still go through app_set_member_role()
-- (last-owner protected). Idempotent.
-- =====================================================================
drop policy if exists "members owner admin update" on public.tenant_members;
create policy "members owner admin update" on public.tenant_members
  for update to authenticated
  using (exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = tenant_members.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner','admin')
  ));
