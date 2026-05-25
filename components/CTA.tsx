"use client";

import Link from "next/link";
import { useI18n, pick } from "@/lib/i18n";
import Reveal from "./Reveal";

export default function CTA() {
  const { locale, t } = useI18n();

  return (
    <section className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal variant="scale">
          <div className="relative overflow-hidden rounded-3xl bg-zinc-900 px-6 py-20 text-center sm:px-12 lg:px-16 lg:py-28">
            <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

            <div className="relative">
              <h2 className="text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl">
                {pick(t.cta.title, locale)}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-300">
                {pick(t.cta.subtitle, locale)}
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="#pricing"
                  className="group inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 sm:w-auto"
                >
                  {pick(t.cta.primary, locale)}
                  <svg viewBox="0 0 16 16" className="h-3 w-3 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <Link
                  href="/contact"
                  className="group inline-flex w-full items-center justify-center gap-1.5 text-sm font-medium text-indigo-300 transition hover:text-indigo-200 sm:w-auto"
                >
                  {pick(t.cta.secondary, locale)}
                  <svg viewBox="0 0 16 16" className="h-3 w-3 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
