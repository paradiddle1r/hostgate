"use client";

import Link from "next/link";
import { useI18n, pick } from "@/lib/i18n";

export default function CTA() {
  const { locale, t } = useI18n();

  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/[0.15] via-fuchsia-500/[0.10] to-cyan-500/[0.10] px-6 py-16 text-center sm:px-12 lg:px-16">
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {pick(t.cta.title, locale)}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-300">
              {pick(t.cta.subtitle, locale)}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="#pricing"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-lg shadow-white/10 transition hover:bg-zinc-100 hover:shadow-white/20 sm:w-auto"
              >
                {pick(t.cta.primary, locale)}
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                href="#"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/[0.08] sm:w-auto"
              >
                {pick(t.cta.secondary, locale)}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
