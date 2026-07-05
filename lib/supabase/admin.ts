import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS entirely. Use ONLY in trusted
 * server code that legitimately runs without an authenticated session.
 *
 * Why this exists: the public booking checkout is anonymous (like everything in
 * lib/book.ts, which reaches the DB through anon-granted SECURITY DEFINER RPCs).
 * But invoices / invoice_items are RLS-locked to `authenticated`
 * (`tenant_id in (select auth_tenant_ids())`, migration 08), so the anon client
 * cannot insert them and the staff helper createInvoiceFromBooking() would fail
 * RLS for a public guest. Rather than loosen that RLS or add a new public RPC
 * (a migration — out of scope), we write the guest's invoice through the
 * service role from server-only code. tenant_id / property_id are always taken
 * from the just-created booking row, never from client input, so this can only
 * ever write an invoice for a booking that already exists.
 *
 * NEVER import this into a client component or expose the key to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase service-role client is not configured (missing SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
