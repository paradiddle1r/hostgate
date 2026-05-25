"use client";

import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";
import Reveal from "./Reveal";
import MacBookFrame from "./MacBookFrame";
import IPhoneFrame from "./IPhoneFrame";
import AnimatedDashboard from "./AnimatedDashboard";
import AnimatedMobile from "./AnimatedMobile";

export default function Screenshots() {
  const { locale, t } = useI18n();

  return (
    <section id="screenshots" className="relative bg-zinc-50/60 py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <SectionHeader
            badge={pick(t.screenshots.badge, locale)}
            title={pick(t.screenshots.title, locale)}
            subtitle={pick(t.screenshots.subtitle, locale)}
          />
        </Reveal>

        {/* Side-by-side composition */}
        <Reveal variant="scale" delay={150}>
          <div className="mx-auto mt-16 flex max-w-6xl flex-col items-end gap-8 md:flex-row md:items-end md:gap-6 lg:gap-10">
            {/* MacBook — takes most of the width */}
            <div className="w-full md:flex-1">
              <div className="tilt">
                <MacBookFrame>
                  <AnimatedDashboard />
                </MacBookFrame>
              </div>
            </div>

            {/* iPhone — narrower, sits next to MacBook */}
            <div className="mx-auto w-[220px] flex-none md:mx-0 md:w-[200px] lg:w-[240px]">
              <div className="tilt float">
                <IPhoneFrame>
                  <AnimatedMobile />
                </IPhoneFrame>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Tagline below */}
        <Reveal delay={300}>
          <p className="mx-auto mt-16 max-w-md text-center text-base text-zinc-500">
            {locale === "th"
              ? "ใช้งานบนเครื่องไหนก็เหมือนเดิม"
              : "Same experience, every device."}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
