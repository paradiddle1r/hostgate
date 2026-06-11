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
  const isApp = pathname === "/app" || pathname.startsWith("/app/");

  if (isApp) return <>{children}</>;

  return (
    <>
      <div className="mesh-bg" aria-hidden>
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="blob b4" />
        <div className="blob b5" />
      </div>
      <div className="relative">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </div>
    </>
  );
}
