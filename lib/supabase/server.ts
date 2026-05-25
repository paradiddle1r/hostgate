import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-component / Server-action Supabase client.
 * Uses the newer `getAll` / `setAll` cookie API which correctly handles
 * chunked auth cookies (Supabase splits large OAuth JWTs into multiple
 * `sb-…-auth-token.0`, `.1` cookies — the legacy `get/set/remove` API
 * doesn't reassemble them, which silently breaks `auth.uid()` in RLS).
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components can't set cookies — middleware refreshes them.
          }
        },
      },
    }
  );
}
