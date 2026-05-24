"use client";

import { useI18n, pick } from "@/lib/i18n";

const icons = [
  <path key="r" strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  <path key="c" strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
  <path key="f" strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6m-6 4h6" />,
  <path key="b" strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />,
  <path key="h" strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0-8.25h6m-6 0a1.5 1.5 0 113 0M9 15h6m-6 0a1.5 1.5 0 103 0m-3 0V6.75m6 8.25V6.75m0 8.25a1.5 1.5 0 113 0m0-8.25a1.5 1.5 0 11-3 0" />,
  <path key="rp" strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />,
  <path key="p" strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />,
  <path key="m" strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m4.5-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />,
  <path key="ph" strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />,
];

export default function Features() {
  const { locale, t } = useI18n();
  return (
    <section id="features" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeader
          badge={pick(t.features.badge, locale)}
          title={pick(t.features.title, locale)}
          subtitle={pick(t.features.subtitle, locale)}
        />

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map((item, i) => (
            <div
              key={i}
              className="group relative bg-white p-7 transition hover:bg-zinc-50"
            >
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                  {icons[i]}
                </svg>
              </div>
              <h3 className="text-base font-semibold text-zinc-900">
                {pick(item.title, locale)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {pick(item.desc, locale)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SectionHeader({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-500 shadow-sm">
        {badge}
      </span>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-zinc-600 sm:text-lg">{subtitle}</p>
      )}
    </div>
  );
}
