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
    <section className="relative isolate overflow-hidden pt-32 pb-16 lg:pt-48 lg:pb-28">
      {/* Animated mesh gradient background */}
      <div className="mesh-bg">
        <div className="blob" />
      </div>

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Eyebrow */}
          <p
            className="hero-anim text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600"
            style={{ animationDelay: "0.05s" }}
          >
            {pick(t.hero.badge, locale)}
          </p>

          {/* Headline — Apple-scale */}
          <h1
            className="hero-anim mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-zinc-900 sm:text-7xl lg:text-[6.5rem]"
            style={{ animationDelay: "0.15s" }}
          >
            {pick(t.hero.title1, locale)}
            <br />
            <span className="italic text-zinc-400">{pick(t.hero.title2, locale)}</span>
          </h1>

          {/* Subtitle */}
          <p
            className="hero-anim mx-auto mt-7 max-w-xl text-lg text-zinc-600 sm:text-xl"
            style={{ animationDelay: "0.25s" }}
          >
            {pick(t.hero.subtitle, locale)}
          </p>

          {/* CTAs */}
          <div
            className="hero-anim mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "0.35s" }}
          >
            <Link
              href="#pricing"
              className="group inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white shadow-[0_8px_30px_-10px_rgba(0,0,0,0.3)] transition hover:bg-zinc-800 hover:shadow-[0_12px_36px_-10px_rgba(0,0,0,0.4)] sm:w-auto"
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
              <span className="link-underline">{pick(t.hero.ctaSecondary, locale)}</span>
              <svg viewBox="0 0 16 16" className="h-3 w-3 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          <p className="hero-anim mt-5 text-xs text-zinc-500" style={{ animationDelay: "0.45s" }}>
            {pick(t.hero.note, locale)}
          </p>
        </div>

        {/* Device composition */}
        <div
          className="hero-anim relative mx-auto mt-20 max-w-5xl lg:mt-24"
          style={{ animationDelay: "0.6s" }}
        >
          <div className="tilt mx-auto">
            <MacBookFrame>
              <DashboardMock />
            </MacBookFrame>
          </div>

          {/* iPhone — floating bottom-right, hidden on mobile */}
          <div className="absolute right-2 -bottom-6 hidden w-[160px] float sm:right-4 sm:-bottom-10 sm:block md:right-12 md:-bottom-12 md:w-[200px] lg:right-20 lg:-bottom-16 lg:w-[240px]">
            <div className="tilt">
              <IPhoneFrame>
                <MobileMock />
              </IPhoneFrame>
            </div>
          </div>

          {/* Mobile-only iPhone */}
          <div className="mt-12 flex justify-center sm:hidden">
            <div className="w-[220px]">
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
