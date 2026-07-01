import "server-only";

// Platform-admin gate for the admin console (admin.hostgate.app → /admin/*).
//
// A user is a platform admin when EITHER:
//   – their auth user id has a row in platform_admins (RLS lets a user select
//     only their own row, so this check runs on the normal session client), OR
//   – their email is listed in PLATFORM_ADMIN_EMAILS (comma-separated env) —
//     the bootstrap path before the DB row exists.
//
// This is about PLATFORM staff (us), not tenant owner/admin roles.

import { createClient } from "@/lib/supabase/server";

export interface PlatformAdmin {
  userId: string;
  email: string;
}

export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const envList = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (user.email && envList.includes(user.email.toLowerCase())) {
    return { userId: user.id, email: user.email };
  }

  const { data } = await supabase
    .from("platform_admins")
    .select("user_id, email")
    .eq("user_id", user.id)
    .maybeSingle();
  if (data) return { userId: data.user_id, email: data.email };
  return null;
}
