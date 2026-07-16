"use client";

// Wraps the marketing chrome (animated mesh + Navbar + Footer) and hides it on
// the authenticated PMS routes (`/app/*`), which render their own shell. Keeps
// the root layout free of pathname logic (server layouts can't read it).

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function MarketingChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  // The PMS app (/app/*), the no-chrome print routes (/print/*), and the
  // guest-facing public booking engine (/book/*) render their own shell —
  // no marketing navbar/footer/mesh.
  const isApp =
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname.startsWith("/print/") ||
    pathname === "/book" ||
    pathname.startsWith("/book/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    // design-lab sample landings render their own chrome per version
    pathname === "/labs" ||
    pathname.startsWith("/labs/");

  const isAuth =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/verify-email" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/");

  if (isApp) return <>{children}</>;

  const mesh = (
    <div className="mesh-bg" aria-hidden>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="blob b4" />
      <div className="blob b5" />
    </div>
  );

  // Auth routes provide their own compact brand header. Keep the atmospheric
  // marketing background, but do not duplicate the marketing navbar/footer.
  if (isAuth) {
    return (
      <>
        {mesh}
        <div className="relative">{children}</div>
      </>
    );
  }

  return (
    <>
      {mesh}
      <div className="relative">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </div>
    </>
  );
}
