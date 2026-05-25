import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
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
