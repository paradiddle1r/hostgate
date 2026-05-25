-- Without this policy, INSERT ... RETURNING * on tenants fails because the
-- creator isn't yet a tenant_member at the moment the row comes back — and
-- PostgREST surfaces the SELECT-after-INSERT failure with the same generic
-- "new row violates row-level security policy" message, which made the bug
-- look like a WITH CHECK violation.
create policy "creator can read own tenants"
  on public.tenants for select
  using (auth.uid() = created_by);
