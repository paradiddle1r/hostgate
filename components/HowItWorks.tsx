"use client";

import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";
import Reveal from "./Reveal";

export default function HowItWorks() {
  const { locale, t } = useI18n();
  return (
    <section className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <SectionHeader
            badge={pick(t.howItWorks.badge, locale)}
            title={pick(t.howItWorks.title, locale)}
            subtitle={pick(t.howItWorks.subtitle, locale)}
          />
        </Reveal>

        <Reveal variant="stagger" className="relative mt-16 grid gap-12 md:grid-cols-3">
          {t.howItWorks.steps.map((step, i) => (
            <div key={i} className="relative text-center md:text-left">
              <div className="mx-auto md:mx-0 mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white">
                <span className="text-base font-semibold tracking-tight">{i + 1}</span>
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-zinc-900">
                {pick(step.title, locale)}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-zinc-600">
                {pick(step.desc, locale)}
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
