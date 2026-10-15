"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n, pick } from "@/lib/i18n";
import StudioDisplay from "./StudioDisplay";
import IPhoneFrame from "./IPhoneFrame";
import AnimatedDashboard from "./AnimatedDashboard";
import AnimatedMobile from "./AnimatedMobile";
import HeroBackdrop from "./HeroBackdrop";

export default function Hero() {
  const { locale, t } = useI18n();
  const [preview, setPreview] = useState(1);
  const views = [
    { phase: 1, th: "ปฏิทินการจอง", en: "Calendar" },
    { phase: 2, th: "รายละเอียดการจอง", en: "Bookings" },
    { phase: 0, th: "ภาพรวมที่พัก", en: "Overview" },
  ];

  return (
    <section className="relative overflow-x-clip pt-28 pb-12 sm:pt-32 sm:pb-16 lg:pt-36 lg:pb-24">
      <HeroBackdrop />
      <div className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p
            className="hero-anim inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/60 px-3.5 py-1.5 text-[11px] font-medium tracking-[0.08em] text-indigo-600 sm:text-xs"
            style={{ animationDelay: "0.05s" }}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            {pick(t.hero.badge, locale)}
          </p>

          <h1
            className="hero-anim mt-4 text-[2.65rem] font-semibold leading-[1.18] tracking-[-0.04em] text-zinc-900 sm:mt-5 sm:text-6xl sm:leading-[1.12] sm:tracking-[-0.045em] lg:text-[6rem]"
            style={{ animationDelay: "0.15s" }}
          >
            {pick(t.hero.title1, locale)}
            <br />
            <span className="italic text-zinc-500">{pick(t.hero.title2, locale)}</span>
          </h1>

          <p
            className="hero-anim mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-zinc-600 sm:mt-6 sm:text-lg"
            style={{ animationDelay: "0.25s" }}
          >
            {pick(t.hero.subtitle, locale).split("\n").map((line) => (
              <span key={line} className="block">{line}</span>
            ))}
          </p>

          <div
            className="hero-anim mt-8 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row"
            style={{ animationDelay: "0.35s" }}
          >
            <Link
              href="#pricing"
              data-magnetic
              className="sweep group inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-zinc-900 px-7 py-3.5 text-sm font-medium text-white shadow-[0_8px_30px_-10px_rgba(0,0,0,0.3)] transition hover:bg-zinc-800 hover:shadow-[0_12px_36px_-10px_rgba(0,0,0,0.4)] sm:w-auto"
            >
              {pick(t.hero.ctaPrimary, locale)}
              <svg viewBox="0 0 16 16" className="h-3 w-3 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="#hero-preview"
              className="group inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full border border-indigo-200/60 bg-white/55 px-6 py-3.5 text-sm font-medium text-indigo-600 transition hover:border-indigo-300 hover:bg-white/90 hover:text-indigo-700 sm:w-auto"
            >
              <span className="link-underline">{pick(t.hero.ctaSecondary, locale)}</span>
              <svg viewBox="0 0 16 16" className="h-3 w-3 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          <p className="hero-anim mt-4 text-xs text-zinc-500 sm:mt-5" style={{ animationDelay: "0.45s" }}>
            {pick(t.hero.note, locale)}
          </p>
        </div>

        {/* Devices */}
        <div
          id="hero-preview"
          className="hero-anim relative mx-auto mt-9 scroll-mt-24 max-w-5xl sm:mt-10"
          style={{ animationDelay: "0.6s" }}
        >
          <div className="mb-7 text-center sm:mb-9">
            <div
              role="group"
              aria-label={locale === "th" ? "เลือกหน้าจอตัวอย่าง" : "Choose a preview"}
              className="inline-flex max-w-full gap-1 rounded-full border border-white/90 bg-white/70 p-1 shadow-[0_3px_18px_-10px_rgba(79,70,229,0.3)]"
            >
              {views.map((view) => (
                <button
                  key={view.phase}
                  onClick={() => setPreview(view.phase)}
                  aria-pressed={preview === view.phase}
                  aria-controls="hero-preview-screens"
                  className={`min-h-11 rounded-full px-3 text-[10px] font-medium transition-colors sm:px-5 sm:text-xs ${
                    preview === view.phase
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700"
                  }`}
                >
                  {view[locale]}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-zinc-500 sm:text-xs">
              {locale === "th" ? "ตัวอย่างหน้าจอ · เลือกมุมมองเพื่อสำรวจ" : "Sample screens · Choose a view to explore"}
            </p>
          </div>
          <div id="hero-preview-screens">
            {/* Mobile / Tablet: stack devices */}
            <div className="flex flex-col items-center gap-6 lg:hidden">
              <div className="w-full max-w-xl">
                <div className="tilt">
                  <StudioDisplay>
                    <AnimatedDashboard phase={preview} />
                  </StudioDisplay>
                </div>
              </div>
              <div className="w-[180px] sm:w-[220px]">
                <div className="tilt">
                  <IPhoneFrame>
                    <AnimatedMobile />
                  </IPhoneFrame>
                </div>
              </div>
            </div>

            {/* Desktop: Studio Display with floating iPhone.
                data-tilt = cursor-follow 3D tilt (ScrollFX), replacing the CSS
                hover tilt so the two transforms never fight; the parallax
                wrappers are separate elements for the same reason. */}
            <div className="hidden lg:block">
              <div data-fx="parallax" data-fx-speed="0.07">
                <div data-tilt className="mx-auto">
                  <StudioDisplay>
                    <AnimatedDashboard phase={preview} />
                  </StudioDisplay>
                </div>
              </div>
              <div className="absolute right-16 bottom-16 w-[240px]" data-fx="parallax" data-fx-speed="0.2">
                <div data-tilt className="float">
                  <IPhoneFrame>
                    <AnimatedMobile />
                  </IPhoneFrame>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
