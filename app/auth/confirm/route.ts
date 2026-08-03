import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth-errors";

/**
 * Email magic-link / OTP confirmation route.
 *
 * Supabase's default email template points to:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .EmailActionType }}&next=/
 *
 * We verify the token_hash via `verifyOtp` (which creates the session),
 * then decide where to send the user (onboarding for first-time, /app otherwise).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const explicitNext = url.searchParams.get("next");

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/login?error=missing_token", url.origin));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  const nextPath = safeNextPath(explicitNext, url.origin);
  if (nextPath && nextPath !== "/") {
    return NextResponse.redirect(new URL(nextPath, url.origin));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=no_session", url.origin));
  }

  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1);

  if (!memberships || memberships.length === 0) {
    return NextResponse.redirect(new URL("/onboarding", url.origin));
  }
  return NextResponse.redirect(new URL("/app", url.origin));
}
