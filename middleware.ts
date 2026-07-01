import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// 1. Refresh the Supabase session (existing behaviour).
// 2. admin.hostgate.app → serve the platform admin console: any path that
//    isn't already /admin, an API route, or an auth page is rewritten into
//    /admin/* so the subdomain root shows the console. Auth cookies are
//    host-scoped, so /login is served (unrewritten) on the subdomain too.
export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  const host = (request.headers.get("host") ?? "").split(":")[0];
  const { pathname } = request.nextUrl;
  const isAdminHost = host === "admin.hostgate.app" || host.startsWith("admin.localhost");

  if (
    isAdminHost &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/signup") &&
    !pathname.startsWith("/verify-email")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
    const rewrite = NextResponse.rewrite(url, { request });
    // Preserve any refreshed auth cookies from updateSession.
    for (const cookie of response.cookies.getAll()) rewrite.cookies.set(cookie);
    return rewrite;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every request EXCEPT:
     * - Next.js internals (_next/static, _next/image)
     * - Static assets (favicon, images, fonts)
     * - The OAuth callback route handles cookies itself
     */
    "/((?!_next/static|_next/image|favicon.svg|opengraph-image|images|fonts|.*\\..*).*)",
  ],
};
