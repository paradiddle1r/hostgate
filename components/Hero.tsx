"use client";

import Link from "next/link";
import { useI18n, pick } from "@/lib/i18n";
import MacBookFrame from "./MacBookFrame";
import IPhoneFrame from "./IPhoneFrame";
import DashboardMock from "./DashboardMock";
import MobileMock from "./MobileMock";

export default function Hero() {
  const { locale, t } = useI18n();

  return (
    <section className="relative isolate overflow-hidden pt-32 pb-16 lg:pt-44 lg:pb-24">
      {/* Soft background wash */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[1100px] -translate-x-1/2 spotlight" />
      </div>

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Eyebrow */}
          <p
            className="hero-anim text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600"
            style={{ animationDelay: "0.05s" }}
          >
            {pick(t.hero.badge, locale)}
          </p>

          {/* Headline — Apple-scale typography */}
          <h1
            className="hero-anim mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-zinc-900 sm:text-6xl lg:text-[5.5rem]"
            style={{ animationDelay: "0.15s" }}
          >
            {pick(t.hero.title1, locale)}
            <br />
            <span className="text-zinc-400">{pick(t.hero.title2, locale)}</span>
          </h1>

          {/* Subtitle */}
          <p
            className="hero-anim mx-auto mt-6 max-w-xl text-lg text-zinc-600 sm:text-xl"
            style={{ animationDelay: "0.25s" }}
          >
            {pick(t.hero.subtitle, locale)}
          </p>

          {/* CTAs */}
          <div
            className="hero-anim mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "0.35s" }}
          >
            <Link
              href="#pricing"
              className="group inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 sm:w-auto"
            >
              {pick(t.hero.ctaPrimary, locale)}
              <svg viewBox="0 0 16 16" className="h-3 w-3 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="#screenshots"
              className="group inline-flex w-full items-center justify-center gap-1.5 text-sm font-medium text-indigo-600 transition hover:text-indigo-700 sm:w-auto"
            >
              {pick(t.hero.ctaSecondary, locale)}
              <svg viewBox="0 0 16 16" className="h-3 w-3 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          <p className="hero-anim mt-5 text-xs text-zinc-500" style={{ animationDelay: "0.45s" }}>
            {pick(t.hero.note, locale)}
          </p>
        </div>

        {/* Device composition — MacBook + iPhone */}
        <div
          className="hero-anim relative mx-auto mt-16 max-w-5xl"
          style={{ animationDelay: "0.55s" }}
        >
          {/* MacBook */}
          <div className="tilt mx-auto">
            <MacBookFrame>
              <DashboardMock />
            </MacBookFrame>
          </div>

          {/* iPhone — floating bottom-right on desktop, hidden on mobile */}
          <div className="absolute -right-2 -bottom-4 hidden w-[180px] sm:right-4 sm:-bottom-8 sm:block md:right-12 md:-bottom-10 md:w-[220px] lg:right-20 lg:-bottom-16 lg:w-[260px]">
            <div className="tilt">
              <IPhoneFrame>
                <MobileMock />
              </IPhoneFrame>
            </div>
          </div>

          {/* Mobile-only iPhone (centered, below MacBook) */}
          <div className="mt-8 flex justify-center sm:hidden">
            <div className="w-[200px]">
              <IPhoneFrame>
                <MobileMock />
              </IPhoneFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
