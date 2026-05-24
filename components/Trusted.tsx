"use client";

import { useI18n, pick } from "@/lib/i18n";

const logos = [
  "BangkokInn",
  "ChiangMai Resort",
  "PhuketPool",
  "Pattaya Suites",
  "SukhumvitStay",
  "HuaHin Bay",
];

export default function Trusted() {
  const { locale, t } = useI18n();
  return (
    <section className="border-y border-white/5 py-10">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
          {pick(t.trusted.title, locale)}
        </p>
        <div className="mt-6 grid grid-cols-2 items-center justify-items-center gap-x-8 gap-y-6 opacity-70 sm:grid-cols-3 lg:grid-cols-6">
          {logos.map((name) => (
            <div
              key={name}
              className="select-none text-sm font-semibold tracking-tight text-zinc-400 transition hover:text-white"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
