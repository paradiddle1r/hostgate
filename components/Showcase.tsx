"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";
import Reveal from "./Reveal";
import MacBookFrame from "./MacBookFrame";
import DashboardMock from "./DashboardMock";

/**
 * Apple-style sticky-scroll showcase.
 * MacBook is pinned to viewport while the right-side panel scrolls through
 * three feature highlights. Active highlight is tracked by scroll position.
 */
export default function Showcase() {
  const { locale } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  const features = [
    {
      eyebrow: { th: "ปฏิทิน", en: "Calendar" },
      title: { th: "เห็นทุกห้อง.\nในมุมมองเดียว.", en: "Every room.\nOne view." },
      desc: {
        th: "ลากวางเพื่อย้ายการจอง เปลี่ยนสถานะห้องด้วยคลิกเดียว",
        en: "Drag to move bookings. Click to change room status. That simple.",
      },
    },
    {
      eyebrow: { th: "OTA", en: "Channels" },
      title: { th: "ทุก OTA.\nซิงค์อัตโนมัติ.", en: "Every channel.\nIn sync." },
      desc: {
        th: "Booking, Agoda, Airbnb, Expedia เปลี่ยนราคาที่เดียว อัปเดตทุกที่",
        en: "Booking, Agoda, Airbnb, Expedia. Change a rate once. It updates everywhere.",
      },
    },
    {
      eyebrow: { th: "การเงิน", en: "Money" },
      title: { th: "เก็บเงิน.\nทันที.", en: "Get paid.\nInstantly." },
      desc: {
        th: "PromptPay, บัตรเครดิต, โอนผ่านธนาคาร — รับชำระทุกช่องทาง",
        en: "PromptPay, credit cards, bank transfers — all payment methods supported.",
      },
    },
  ];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Progress through the sticky container
      const total = rect.height - vh;
      const traveled = Math.max(0, Math.min(total, -rect.top));
      const progress = total > 0 ? traveled / total : 0;
      const idx = Math.min(features.length - 1, Math.floor(progress * features.length));
      setActive(idx);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [features.length]);

  return (
    <section className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <SectionHeader
            badge={locale === "th" ? "ลึกกว่าผิว" : "Look closer"}
            title={locale === "th" ? "ทุกรายละเอียด. คิดมาแล้ว." : "Every detail. Considered."}
          />
        </Reveal>
      </div>

      {/* Sticky container — about 3x viewport height to accommodate 3 features */}
      <div
        ref={containerRef}
        className="relative mt-12 hidden lg:block"
        style={{ height: `${features.length * 90}vh` }}
      >
        <div className="sticky top-0 flex h-screen items-center">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-2 items-center gap-12 px-5 lg:px-8">
            {/* Left: MacBook (pinned) */}
            <div className="float">
              <MacBookFrame>
                <DashboardMock />
              </MacBookFrame>
            </div>

            {/* Right: feature text (changes with scroll) */}
            <div className="relative">
              {features.map((f, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 flex flex-col justify-center transition-all duration-700 ${
                    active === i ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">
                    {pick(f.eyebrow, locale)}
                  </p>
                  <h3 className="mt-4 whitespace-pre-line text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-zinc-900 lg:text-6xl">
                    {pick(f.title, locale)}
                  </h3>
                  <p className="mt-5 max-w-md text-lg text-zinc-600">
                    {pick(f.desc, locale)}
                  </p>

                  {/* Progress dots */}
                  <div className="mt-10 flex gap-2">
                    {features.map((_, j) => (
                      <span
                        key={j}
                        className={`h-1 rounded-full transition-all ${
                          j === active ? "w-8 bg-zinc-900" : "w-4 bg-zinc-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile fallback: stacked simple cards */}
      <div className="mx-auto mt-12 max-w-3xl space-y-12 px-5 lg:hidden">
        {features.map((f, i) => (
          <Reveal key={i}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">
                {pick(f.eyebrow, locale)}
              </p>
              <h3 className="mt-3 whitespace-pre-line text-3xl font-semibold leading-tight tracking-tight text-zinc-900">
                {pick(f.title, locale)}
              </h3>
              <p className="mt-3 text-base text-zinc-600">{pick(f.desc, locale)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
