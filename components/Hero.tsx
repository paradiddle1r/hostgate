"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n, pick } from "@/lib/i18n";
import StudioDisplay from "./StudioDisplay";
import IPhoneFrame from "./IPhoneFrame";
import AnimatedDashboard from "./AnimatedDashboard";
import AnimatedMobile from "./AnimatedMobile";

export default function Hero() {
  const { locale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  }

  return (
    <section className="relative pt-28 pb-12 sm:pt-32 sm:pb-16 lg:pt-48 lg:pb-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p
            className="hero-anim text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600 sm:text-xs sm:tracking-[0.25em]"
            style={{ animationDelay: "0.05s" }}
          >
            {pick(t.hero.badge, locale)}
          </p>

          <h1
            className="hero-anim mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-zinc-900 sm:mt-5 sm:text-6xl sm:leading-[1.02] sm:tracking-[-0.045em] lg:text-[6.5rem]"
            style={{ animationDelay: "0.15s" }}
          >
            {pick(t.hero.title1, locale)}
            <br />
            <span className="italic text-zinc-400">{pick(t.hero.title2, locale)}</span>
          </h1>

          <p
            className="hero-anim mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-600 sm:mt-7 sm:text-lg lg:text-xl"
            style={{ animationDelay: "0.25s" }}
          >
            {pick(t.hero.subtitle, locale)}
          </p>

          <div
            className="hero-anim mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row"
            style={{ animationDelay: "0.35s" }}
          >
            <Link
              href="#pricing"
              className="group inline-flex w-full max-w-xs items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white shadow-[0_8px_30px_-10px_rgba(0,0,0,0.3)] transition hover:bg-zinc-800 hover:shadow-[0_12px_36px_-10px_rgba(0,0,0,0.4)] sm:w-auto"
            >
              {pick(t.hero.ctaPrimary, locale)}
              <svg viewBox="0 0 16 16" className="h-3 w-3 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="#screenshots"
              className="group inline-flex w-full max-w-xs items-center justify-center gap-1.5 text-sm font-medium text-indigo-600 transition hover:text-indigo-700 sm:w-auto"
            >
              <span className="link-underline">{pick(t.hero.ctaSecondary, locale)}</span>
              <svg viewBox="0 0 16 16" className="h-3 w-3 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          {/* Email capture */}
          <div
            className="hero-anim mt-6 flex justify-center sm:mt-8"
            style={{ animationDelay: "0.45s" }}
          >
            {submitted ? (
              <p className="text-sm text-indigo-600 font-medium">
                {locale === "th"
                  ? "รับทราบแล้ว! เราจะติดต่อกลับเร็ว ๆ นี้"
                  : "Got it! We'll be in touch soon."}
              </p>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex w-full max-w-sm items-center gap-2"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    locale === "th" ? "อีเมลของคุณ" : "Your email"
                  }
                  className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="submit"
                  className="flex-none rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
                >
                  {locale === "th" ? "แจ้งเตือนฉัน" : "Notify me"}
                </button>
              </form>
            )}
          </div>

          <p className="hero-anim mt-4 text-xs text-zinc-500 sm:mt-5" style={{ animationDelay: "0.55s" }}>
            {pick(t.hero.note, locale)}
          </p>
        </div>

        {/* Devices */}
        <div
          className="hero-anim relative mx-auto mt-12 max-w-5xl sm:mt-16 lg:mt-24"
          style={{ animationDelay: "0.6s" }}
        >
          {/* Mobile / Tablet: stack devices */}
          <div className="flex flex-col items-center gap-6 lg:hidden">
            <div className="w-full max-w-xl">
              <div className="tilt">
                <StudioDisplay>
                  <AnimatedDashboard />
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

          {/* Desktop: Studio Display with floating iPhone */}
          <div className="hidden lg:block">
            <div className="tilt mx-auto">
              <StudioDisplay>
                <AnimatedDashboard />
              </StudioDisplay>
            </div>
            <div className="absolute right-16 bottom-16 w-[240px] float">
              <div className="tilt">
                <IPhoneFrame>
                  <AnimatedMobile />
                </IPhoneFrame>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
