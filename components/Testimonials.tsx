"use client";

import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";

export default function Testimonials() {
  const { locale, t } = useI18n();

  return (
    <section id="testimonials" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeader
          badge={pick(t.testimonials.badge, locale)}
          title={pick(t.testimonials.title, locale)}
        />

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {t.testimonials.items.map((item, i) => (
            <figure
              key={i}
              className="relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div className="mb-3 flex gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, s) => (
                  <svg key={s} viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <blockquote className="flex-1 text-sm leading-relaxed text-zinc-200">
                &ldquo;{pick(item.quote, locale)}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-white/5 pt-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${avatarGradients[i % 4]}`}>
                  {item.name[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{item.name}</div>
                  <div className="text-[11px] text-zinc-400">{pick(item.role, locale)}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] md:grid-cols-4">
          {[
            { v: "2,400+", l: locale === "th" ? "ที่พักใช้งาน" : "Properties using us" },
            { v: "1.2M+", l: locale === "th" ? "การจองที่จัดการ" : "Bookings managed" },
            { v: "99.99%", l: locale === "th" ? "เวลาออนไลน์" : "Uptime" },
            { v: "4.9/5", l: locale === "th" ? "คะแนนรีวิวเฉลี่ย" : "Average rating" },
          ].map((s) => (
            <div key={s.l} className="bg-[#050816] p-6 text-center">
              <div className="text-3xl font-bold text-white sm:text-4xl">
                <span className="gradient-text-brand">{s.v}</span>
              </div>
              <div className="mt-2 text-xs text-zinc-400">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const avatarGradients = [
  "bg-gradient-to-br from-indigo-500 to-fuchsia-500",
  "bg-gradient-to-br from-emerald-500 to-cyan-500",
  "bg-gradient-to-br from-amber-500 to-rose-500",
  "bg-gradient-to-br from-purple-500 to-pink-500",
];
