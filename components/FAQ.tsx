"use client";

import { useState } from "react";
import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";

export default function FAQ() {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-4xl px-5 lg:px-8">
        <SectionHeader
          badge={pick(t.faq.badge, locale)}
          title={pick(t.faq.title, locale)}
        />

        <div className="mt-14 space-y-3">
          {t.faq.items.map((item, i) => (
            <div
              key={i}
              className={`overflow-hidden rounded-xl border transition ${
                open === i
                  ? "border-white/20 bg-white/[0.04]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              }`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-white sm:text-base">
                  {pick(item.q, locale)}
                </span>
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`h-4 w-4 flex-none text-zinc-400 transition-transform ${
                    open === i ? "rotate-180" : ""
                  }`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
                </svg>
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${
                  open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-300">
                    {pick(item.a, locale)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
