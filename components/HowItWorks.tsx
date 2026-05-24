"use client";

import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";

export default function HowItWorks() {
  const { locale, t } = useI18n();
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeader
          badge={pick(t.howItWorks.badge, locale)}
          title={pick(t.howItWorks.title, locale)}
          subtitle={pick(t.howItWorks.subtitle, locale)}
        />

        <div className="relative mt-14">
          {/* Connecting line */}
          <div className="absolute left-1/2 top-10 hidden h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent md:block" />

          <div className="relative grid gap-8 md:grid-cols-3">
            {t.howItWorks.steps.map((step, i) => (
              <div key={i} className="relative text-center md:text-left">
                <div className="mx-auto md:mx-0 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 ring-1 ring-white/10 backdrop-blur">
                  <span className="text-2xl font-bold text-white">{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {pick(step.title, locale)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
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
