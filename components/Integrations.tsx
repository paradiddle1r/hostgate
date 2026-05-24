"use client";

import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";

const integrations = [
  { name: "Booking.com", gradient: "from-blue-500 to-blue-700" },
  { name: "Agoda", gradient: "from-rose-500 to-rose-700" },
  { name: "Airbnb", gradient: "from-pink-500 to-pink-700" },
  { name: "Expedia", gradient: "from-amber-500 to-amber-700" },
  { name: "PromptPay", gradient: "from-violet-500 to-violet-700" },
  { name: "Omise", gradient: "from-indigo-500 to-indigo-700" },
  { name: "Stripe", gradient: "from-purple-500 to-purple-700" },
  { name: "Xero", gradient: "from-sky-500 to-sky-700" },
  { name: "QuickBooks", gradient: "from-emerald-500 to-emerald-700" },
  { name: "Mailchimp", gradient: "from-yellow-500 to-yellow-700" },
  { name: "Google Calendar", gradient: "from-red-500 to-red-700" },
  { name: "Line Notify", gradient: "from-green-500 to-green-700" },
];

export default function Integrations() {
  const { locale, t } = useI18n();
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeader
          badge={pick(t.integrations.badge, locale)}
          title={pick(t.integrations.title, locale)}
          subtitle={pick(t.integrations.subtitle, locale)}
        />

        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {integrations.map((i) => (
            <div
              key={i.name}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${i.gradient} text-white font-bold text-lg shadow-lg`}>
                {i.name[0]}
              </div>
              <span className="text-center text-xs font-medium text-zinc-300">{i.name}</span>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-zinc-500">
          {locale === "th"
            ? "และอีกมากมายผ่าน API + Webhook"
            : "And many more via API + Webhooks"}
        </p>
      </div>
    </section>
  );
}
