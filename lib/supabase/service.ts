import "server-only";

import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS. ONLY for platform-level code
 * paths that have no user session (Channex webhook receiver, cron) or that
 * operate across tenants (the admin console at admin.hostgate.app).
 *
 * NEVER import this from tenant-facing code; tenant code goes through
 * lib/supabase/server.ts + RLS.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — set it in the environment " +
      "(Vercel → hostgate → Settings → Environment Variables)."
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
