"use client";

import { useI18n, pick } from "@/lib/i18n";

export default function LegalLayout({
  title,
  lastUpdated,
  bodyTh,
  bodyEn,
}: {
  title: { th: string; en: string };
  lastUpdated: string;
  bodyTh: { heading: string; content: string }[];
  bodyEn: { heading: string; content: string }[];
}) {
  const { locale, t } = useI18n();
  const body = locale === "th" ? bodyTh : bodyEn;

  return (
    <article className="relative pt-32 pb-20">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          {pick(title, locale)}
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          {pick(t.legal.lastUpdated, locale)}: {lastUpdated}
        </p>

        <div className="mt-10 space-y-8">
          {body.map((sec, i) => (
            <section key={i}>
              <h2 className="text-xl font-semibold text-zinc-900">{sec.heading}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-700">
                {sec.content}
              </p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
