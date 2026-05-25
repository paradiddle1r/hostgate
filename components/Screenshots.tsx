"use client";

import { useState } from "react";
import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";
import Reveal from "./Reveal";
import MacBookFrame from "./MacBookFrame";
import IPhoneFrame from "./IPhoneFrame";
import DashboardMock from "./DashboardMock";
import MobileMock from "./MobileMock";

type View = "desktop" | "mobile";

export default function Screenshots() {
  const { locale, t } = useI18n();
  const [view, setView] = useState<View>("desktop");

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

        {/* Device toggle */}
        <Reveal delay={100}>
          <div className="mt-12 flex justify-center">
            <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 text-sm">
              <button
                onClick={() => setView("desktop")}
                className={`rounded-full px-4 py-1.5 transition ${
                  view === "desktop" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {locale === "th" ? "เดสก์ท็อป" : "Desktop"}
              </button>
              <button
                onClick={() => setView("mobile")}
                className={`rounded-full px-4 py-1.5 transition ${
                  view === "mobile" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {locale === "th" ? "มือถือ" : "Mobile"}
              </button>
            </div>
          </div>
        </Reveal>

        {/* Device showcase */}
        <Reveal variant="scale" delay={200}>
          <div className="mx-auto mt-12 flex justify-center transition-all duration-500">
            {view === "desktop" ? (
              <div className="w-full max-w-4xl tilt">
                <MacBookFrame>
                  <DashboardMock />
                </MacBookFrame>
              </div>
            ) : (
              <div className="tilt">
                <IPhoneFrame>
                  <MobileMock />
                </IPhoneFrame>
              </div>
            )}
          </div>
        </Reveal>

        {/* Tagline below */}
        <Reveal delay={300}>
          <p className="mx-auto mt-12 max-w-md text-center text-sm text-zinc-500">
            {locale === "th"
              ? "ใช้งานบนเครื่องไหนก็เหมือนเดิม"
              : "Same experience, every device."}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
