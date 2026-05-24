"use client";

import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";

export default function HowItWorks() {
  const { locale, t } = useI18n();
  return (
    <section className="relative bg-zinc-50/60 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeader
          badge={pick(t.howItWorks.badge, locale)}
          title={pick(t.howItWorks.title, locale)}
          subtitle={pick(t.howItWorks.subtitle, locale)}
        />

        <div className="relative mt-14">
          <div className="absolute left-1/2 top-8 hidden h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-zinc-300 to-transparent md:block" />

          <div className="relative grid gap-10 md:grid-cols-3">
            {t.howItWorks.steps.map((step, i) => (
              <div key={i} className="relative text-center md:text-left">
                <div className="mx-auto md:mx-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-white ring-8 ring-zinc-50/60">
                  <span className="text-xl font-bold">{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-zinc-900">
                  {pick(step.title, locale)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                  {pick(step.desc, locale)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
