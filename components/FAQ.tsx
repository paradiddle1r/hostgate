"use client";

import { useState } from "react";
import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";
import Reveal from "./Reveal";

export default function FAQ() {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-4xl px-5 lg:px-8">
        <Reveal>
          <SectionHeader
            badge={pick(t.faq.badge, locale)}
            title={pick(t.faq.title, locale)}
          />
        </Reveal>

        <Reveal variant="stagger" className="mt-14 space-y-3">
          {t.faq.items.map((item, i) => (
            <div
              key={i}
              className={`overflow-hidden rounded-xl border bg-white transition ${
                open === i ? "border-zinc-300 shadow-sm" : "border-zinc-200"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`faq-panel-${i}`}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="text-base font-semibold text-zinc-900">
                  {pick(item.q, locale)}
                </span>
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`h-4 w-4 flex-none text-zinc-500 transition-transform ${
                    open === i ? "rotate-180" : ""
                  }`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
                </svg>
              </button>
              <div
                id={`faq-panel-${i}`}
                aria-hidden={open !== i}
                className={`grid transition-all duration-300 ease-out ${
                  open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-6 pb-5 text-sm leading-relaxed text-zinc-600">
                    {pick(item.a, locale)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
