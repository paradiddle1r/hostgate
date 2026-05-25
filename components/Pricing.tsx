"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";
import Reveal from "./Reveal";

export default function Pricing() {
  const { locale, t } = useI18n();
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <SectionHeader
            badge={pick(t.pricing.badge, locale)}
            title={pick(t.pricing.title, locale)}
            subtitle={pick(t.pricing.subtitle, locale)}
          />
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-10 flex items-center justify-center">
            <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 text-sm">
              <button
                onClick={() => setYearly(false)}
                className={`rounded-full px-4 py-1.5 transition ${
                  !yearly ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {pick(t.pricing.monthly, locale)}
              </button>
              <button
                onClick={() => setYearly(true)}
                className={`rounded-full px-4 py-1.5 transition ${
                  yearly ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {pick(t.pricing.yearly, locale)}
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal variant="stagger" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {t.pricing.plans.map((plan, i) => {
            const popular = "popular" in plan && plan.popular;
            const isCustom = plan.priceTHB === "custom";
            const monthly = parseInt(plan.priceTHB.replace(/,/g, ""), 10) || 0;
            const display = isCustom
              ? null
              : yearly
              ? Math.round(monthly * 0.8).toLocaleString()
              : monthly.toLocaleString();

            return (
              <div
                key={i}
                className={`lift relative flex flex-col rounded-2xl p-6 transition ${
                  popular
                    ? "border-2 border-zinc-900 bg-white shadow-lg"
                    : "border border-zinc-200 bg-white"
                }`}
              >
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                      {pick(t.pricing.mostPopular, locale)}
                    </span>
                  </div>
                )}

                <div className="text-lg font-semibold tracking-tight text-zinc-900">{pick(plan.name, locale)}</div>
                <p className="mt-1 text-xs text-zinc-500">{pick(plan.tagline, locale)}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  {isCustom ? (
                    <span className="text-3xl font-semibold tracking-tight text-zinc-900">
                      {locale === "th" ? "ติดต่อสอบถาม" : "Custom"}
                    </span>
                  ) : (
                    <>
                      <span className="text-4xl font-semibold tracking-tight text-zinc-900">฿{display}</span>
                      <span className="text-sm text-zinc-500">{pick(t.pricing.perMonth, locale)}</span>
                    </>
                  )}
                </div>
                {!isCustom && yearly && (
                  <div className="mt-1 text-[10px] text-emerald-600">
                    {locale === "th" ? "ประหยัด 20%" : "Save 20%"}
                  </div>
                )}

                <div className="mt-1 text-xs text-zinc-500">{pick(plan.rooms, locale)}</div>

                <Link
                  href="#"
                  className={`mt-6 inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition ${
                    popular
                      ? "bg-zinc-900 text-white hover:bg-zinc-800"
                      : isCustom
                      ? "border border-zinc-200 text-zinc-900 hover:bg-zinc-50"
                      : i === 0
                      ? "bg-zinc-900 text-white hover:bg-zinc-800"
                      : "border border-zinc-200 text-zinc-900 hover:bg-zinc-50"
                  }`}
                >
                  {isCustom
                    ? pick(t.pricing.contactSales, locale)
                    : i === 0
                    ? pick(t.pricing.startFree, locale)
                    : pick(t.pricing.choosePlan, locale)}
                </Link>

                <ul className="mt-6 space-y-2.5 border-t border-zinc-200 pt-5">
                  {(locale === "th" ? plan.features.th : plan.features.en).map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-xs text-zinc-700">
                      <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-600" fill="currentColor">
                        <path d="M13.78 4.22a.75.75 0 010 1.06l-6.5 6.5a.75.75 0 01-1.06 0l-3-3a.75.75 0 011.06-1.06L6.75 10.19l5.97-5.97a.75.75 0 011.06 0z" />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Reveal>

        <p className="mt-10 text-center text-xs text-zinc-500">
          {locale === "th"
            ? "ราคายังไม่รวม VAT 7%"
            : "Prices exclude 7% VAT"}
        </p>
      </div>
    </section>
  );
}
