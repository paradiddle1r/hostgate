"use client";

import { useI18n, pick } from "@/lib/i18n";

const logos = [
  { name: "BangkokInn", initial: "B", color: "bg-zinc-900" },
  { name: "ChiangMai Resort", initial: "C", color: "bg-emerald-700" },
  { name: "PhuketPool", initial: "P", color: "bg-sky-700" },
  { name: "Pattaya Suites", initial: "P", color: "bg-amber-700" },
  { name: "SukhumvitStay", initial: "S", color: "bg-violet-700" },
  { name: "HuaHin Bay", initial: "H", color: "bg-rose-700" },
  { name: "Krabi Cliff", initial: "K", color: "bg-indigo-700" },
  { name: "AyutthayaHome", initial: "A", color: "bg-fuchsia-700" },
];

export default function Trusted() {
  const { locale, t } = useI18n();
  return (
    <section className="relative bg-white py-12">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <p className="text-center text-xs uppercase tracking-[0.25em] text-zinc-500">
          {pick(t.trusted.title, locale)}
        </p>

        {/* Marquee track */}
        <div className="relative mt-8 overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-white to-transparent" />
          <div className="marquee flex gap-6 whitespace-nowrap">
            {[...logos, ...logos].map((logo, i) => (
              <div
                key={`${logo.name}-${i}`}
                className="flex select-none items-center gap-2.5 rounded-full border border-zinc-200 bg-white px-4 py-2"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white ${logo.color}`}
                >
                  {logo.initial}
                </span>
                <span className="text-sm font-medium tracking-tight text-zinc-700">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
