import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth + magic-link callback.
 *
 * Both flows redirect the browser here with a `?code=...` query param.
 * We exchange the code for a session, then decide where to send the
 * user next based on whether they already belong to a tenant:
 *   - 0 memberships → /onboarding (fresh signup)
 *   - 1+ memberships → /app (eventual SaaS shell; placeholder for now)
 *
 * Errors come back as `?error=...&error_description=...` — we render
 * those on a small fallback page.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  // Optional override — e.g. /auth/callback?next=/onboarding/step2
  const explicitNext = url.searchParams.get("next");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorParam)}`, url.origin)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  // Honor an explicit next param if it's a same-origin path.
  if (explicitNext && explicitNext.startsWith("/")) {
    return NextResponse.redirect(new URL(explicitNext, url.origin));
  }

  // Otherwise route based on whether they've completed onboarding.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=no_session", url.origin));
  }

  const { data: memberships, error: memberErr } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1);

  if (memberErr) {
    // RLS / network issue — fall through to onboarding so user can retry.
    return NextResponse.redirect(new URL("/onboarding", url.origin));
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.redirect(new URL("/onboarding", url.origin));
  }

  return NextResponse.redirect(new URL("/app", url.origin));
}
