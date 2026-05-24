"use client";

import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";

export default function Comparison() {
  const { locale, t } = useI18n();
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-5xl px-5 lg:px-8">
        <SectionHeader
          badge={pick(t.comparison.badge, locale)}
          title={pick(t.comparison.title, locale)}
          subtitle={pick(t.comparison.subtitle, locale)}
        />

        <div className="mt-14 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {/* Header row */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-px bg-zinc-200 text-xs sm:text-sm">
            <div className="bg-white px-4 py-4 font-semibold text-zinc-500 sm:px-6">
              {pick(t.comparison.cols.feature, locale)}
            </div>
            <div className="bg-zinc-900 px-4 py-4 text-center font-bold text-white sm:px-6">
              {pick(t.comparison.cols.hostgate, locale)}
            </div>
            <div className="bg-white px-4 py-4 text-center text-zinc-700 sm:px-6">
              {pick(t.comparison.cols.excel, locale)}
            </div>
            <div className="bg-white px-4 py-4 text-center text-zinc-700 sm:px-6">
              {pick(t.comparison.cols.other, locale)}
            </div>
          </div>

          {t.comparison.rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-px bg-zinc-200 text-xs sm:text-sm"
            >
              <div className="bg-white px-4 py-3.5 text-zinc-900 sm:px-6">
                {pick(row.label, locale)}
              </div>
              <Cell variant={row.hostgate} highlight />
              <Cell variant={row.excel} />
              <Cell variant={row.other} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cell({ variant, highlight }: { variant: string; highlight?: boolean }) {
  const bg = highlight ? "bg-zinc-50" : "bg-white";
  return (
    <div className={`flex items-center justify-center px-4 py-3.5 sm:px-6 ${bg}`}>
      {variant === "yes" ? (
        <svg viewBox="0 0 20 20" className="h-5 w-5 text-emerald-600" fill="currentColor">
          <path d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.5A1 1 0 014.7 8.1l3 3 6.7-6.7a1 1 0 011.3-.1z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-5 w-5 text-zinc-300" fill="currentColor">
          <path d="M5.3 5.3a1 1 0 011.4 0L10 8.6l3.3-3.3a1 1 0 111.4 1.4L11.4 10l3.3 3.3a1 1 0 11-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 01-1.4-1.4L8.6 10 5.3 6.7a1 1 0 010-1.4z" />
        </svg>
      )}
    </div>
  );
}
