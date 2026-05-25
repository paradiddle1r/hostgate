"use client";

import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";
import Reveal from "./Reveal";

const integrations = [
  { name: "Booking.com", color: "bg-blue-500" },
  { name: "Agoda", color: "bg-rose-500" },
  { name: "Airbnb", color: "bg-pink-500" },
  { name: "Expedia", color: "bg-amber-500" },
  { name: "PromptPay", color: "bg-violet-500" },
  { name: "Omise", color: "bg-indigo-500" },
  { name: "Stripe", color: "bg-purple-500" },
  { name: "Xero", color: "bg-sky-500" },
  { name: "QuickBooks", color: "bg-emerald-500" },
  { name: "Mailchimp", color: "bg-yellow-500" },
  { name: "Google Calendar", color: "bg-red-500" },
  { name: "Line Notify", color: "bg-green-500" },
];

export default function Integrations() {
  const { locale, t } = useI18n();
  return (
    <section className="relative bg-zinc-50/60 py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <SectionHeader
            badge={pick(t.integrations.badge, locale)}
            title={pick(t.integrations.title, locale)}
            subtitle={pick(t.integrations.subtitle, locale)}
          />
        </Reveal>

        <Reveal variant="stagger" className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {integrations.map((i) => (
            <div
              key={i.name}
              className="lift flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-5"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${i.color} text-white font-bold text-lg`}>
                {i.name[0]}
              </div>
              <span className="text-center text-xs font-medium text-zinc-700">{i.name}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
