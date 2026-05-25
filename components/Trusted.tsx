"use client";

import { useI18n, pick } from "@/lib/i18n";

const logos = [
  "BangkokInn",
  "ChiangMai Resort",
  "PhuketPool",
  "Pattaya Suites",
  "SukhumvitStay",
  "HuaHin Bay",
  "Krabi Cliff",
  "AyutthayaHome",
];

export default function Trusted() {
  const { locale, t } = useI18n();
  return (
    <section className="border-y border-zinc-200 bg-white py-10">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-zinc-500">
          {pick(t.trusted.title, locale)}
        </p>

        {/* Marquee track */}
        <div className="relative mt-6 overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-white to-transparent" />
          <div className="marquee flex gap-12 whitespace-nowrap">
            {[...logos, ...logos].map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="select-none text-base font-semibold tracking-tight text-zinc-400"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
