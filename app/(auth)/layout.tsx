import Link from "next/link";
import { BrandLockup } from "@/components/Logo";

/**
 * Auth route group layout.
 *   - No marketing Navbar / Footer (auth pages stand alone).
 *   - Keeps the mesh-bg from the root layout for visual continuity.
 *   - Simple logo header that links back to the marketing site.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="relative z-10 px-5 py-5 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <BrandLockup className="h-7 w-auto transition-transform group-hover:scale-[1.02]" />
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-12">
        {children}
      </main>
    </div>
  );
}
