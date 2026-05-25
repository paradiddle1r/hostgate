"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n, pick } from "@/lib/i18n";
import Logo from "./Logo";
import LanguageToggle from "./LanguageToggle";

export default function Navbar() {
  const { locale, t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // rAF-throttled to avoid setState on every wheel/touch frame on mobile.
    let rafId: number | null = null;
    let lastScrolled = window.scrollY > 12;
    setScrolled(lastScrolled);

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const next = window.scrollY > 12;
        if (next !== lastScrolled) {
          lastScrolled = next;
          setScrolled(next);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const links = [
    { href: "/#features", label: pick(t.nav.features, locale) },
    { href: "/#screenshots", label: pick(t.nav.screenshots, locale) },
    { href: "/#pricing", label: pick(t.nav.pricing, locale) },
    { href: "/#testimonials", label: pick(t.nav.testimonials, locale) },
    { href: "/#faq", label: pick(t.nav.faq, locale) },
    { href: "/blog", label: pick(t.nav.blog, locale) },
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-zinc-200/70 bg-white/80 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Logo className="h-8 w-8 transition-transform group-hover:scale-105" />
          <span className="text-lg font-semibold tracking-tight text-zinc-900">HostGate</span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="rounded-full px-3.5 py-2 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageToggle />
          <Link
            href="#"
            className="text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
          >
            {pick(t.nav.login, locale)}
          </Link>
          <Link
            href="#pricing"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            {pick(t.nav.start, locale)}
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-md p-2 text-zinc-700 lg:hidden"
          aria-label="Menu"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {menuOpen && (
        <div className="border-t border-zinc-200 bg-white/95 px-5 pb-5 backdrop-blur-xl lg:hidden">
          <ul className="flex flex-col gap-1 pt-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3">
            <LanguageToggle />
            <Link
              href="#pricing"
              onClick={() => setMenuOpen(false)}
              className="flex-1 rounded-full bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              {pick(t.nav.start, locale)}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
