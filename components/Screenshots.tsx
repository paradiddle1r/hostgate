"use client";

import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";
import Reveal from "./Reveal";
import StudioDisplay from "./StudioDisplay";
import IpadFrame from "./IpadFrame";
import IPhoneFrame from "./IPhoneFrame";
import AnimatedDashboard from "./AnimatedDashboard";
import AnimatedMobile from "./AnimatedMobile";
import MonthlyRentalScene from "./scenes/MonthlyRentalScene";

export default function Screenshots() {
  const { locale, t } = useI18n();

  return (
    <section id="screenshots" className="relative bg-zinc-50/60 py-20 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <SectionHeader
            badge={pick(t.screenshots.badge, locale)}
            title={pick(t.screenshots.title, locale)}
            subtitle={pick(t.screenshots.subtitle, locale)}
          />
        </Reveal>

        {/* Stacked on mobile/tablet, row on lg+ */}
        <Reveal variant="scale" delay={150}>
          <div className="mx-auto mt-12 max-w-6xl lg:mt-16">
            {/* Mobile / Tablet — stack centered */}
            <div className="flex flex-col items-center gap-10 lg:hidden">
              <div className="w-full max-w-xl">
                <div className="tilt">
                  <StudioDisplay>
                    <AnimatedDashboard />
                  </StudioDisplay>
                </div>
              </div>
              <div className="w-full max-w-md">
                <div className="tilt float">
                  <IpadFrame orientation="landscape">
                    <MonthlyRentalScene />
                  </IpadFrame>
                </div>
              </div>
              <div className="w-[200px]">
                <div className="tilt">
                  <IPhoneFrame>
                    <AnimatedMobile />
                  </IPhoneFrame>
                </div>
              </div>
            </div>

            {/* Desktop — row */}
            <div className="hidden items-end gap-8 lg:flex">
              <div className="flex-1">
                <div className="tilt">
                  <StudioDisplay>
                    <AnimatedDashboard />
                  </StudioDisplay>
                </div>
              </div>
              <div className="w-[280px] flex-none">
                <div className="tilt float">
                  <IpadFrame orientation="landscape">
                    <MonthlyRentalScene />
                  </IpadFrame>
                </div>
              </div>
              <div className="w-[200px] flex-none">
                <div className="tilt">
                  <IPhoneFrame>
                    <AnimatedMobile />
                  </IPhoneFrame>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={300}>
          <p className="mx-auto mt-12 max-w-md text-center text-base text-zinc-500 lg:mt-16">
            {locale === "th"
              ? "ใช้งานบนเครื่องไหนก็เหมือนเดิม"
              : "Same experience, every device."}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
