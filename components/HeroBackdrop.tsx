"use client";

import { BedDouble, CalendarCheck2, Check, Clock3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Decorative sample UI, never live booking or room data. */
export default function HeroBackdrop() {
  const { locale } = useI18n();
  const th = locale === "th";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 35% at 17% 30%, rgba(199,210,254,0.25), transparent 75%), radial-gradient(ellipse 45% 32% at 86% 36%, rgba(245,208,254,0.20), transparent 75%), radial-gradient(ellipse 55% 28% at 50% 76%, rgba(165,243,252,0.18), transparent 75%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(129,140,248,0.24) 0.8px, transparent 0.8px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 55% 48% at 50% 50%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 55% 48% at 50% 50%, black, transparent)",
        }}
      />

      <div className="hero-notice-main hidden xl:block">
        <div className="hero-reservation-float">
          <div className="hero-notice-window">
            <div className="hero-notice-bar">
              <CalendarCheck2 size={13} />
              <span>HOSTGATE / RESERVATIONS</span>
              <i className="hero-notice-signal" />
            </div>
            <div className="hero-notice-content">
              <div className="hero-notice-guest">
                <span className="hero-guest-avatar">P</span>
                <div>
                  <strong>{th ? "การจองใหม่" : "New reservation"}</strong>
                  <p>{th ? "คุณพิม · ห้อง 204 · 3 คืน" : "Pim · Room 204 · 3 nights"}</p>
                </div>
              </div>
              <span className="hero-confirmed"><Check size={12} />{th ? "ยืนยันการจองแล้ว" : "Booking confirmed"}</span>
              <small className="hero-sample-label">{th ? "ข้อมูลตัวอย่าง" : "Sample data"}</small>
            </div>
          </div>
          <div className="hero-arrival-toast">
            <span className="hero-arrival-icon"><Clock3 size={16} /></span>
            <div><strong>{th ? "เข้าพักวันนี้ 14:00" : "Arriving today at 14:00"}</strong><small>{th ? "พร้อมสำหรับการต้อนรับครั้งต่อไป" : "A little more ready for the next stay"}</small></div>
          </div>
        </div>
      </div>

      <div className="hero-notice-companion hidden xl:block">
        <div className="hero-rooms-float hero-notice-window">
          <div className="hero-notice-bar"><BedDouble size={13} /><span>HOSTGATE / ROOM STATUS</span></div>
          <div className="hero-room-content">
            <strong>{th ? "พร้อมต้อนรับแขก" : "Ready to welcome"}</strong>
            <p>{th ? "ทุกห้อง ดูแลง่ายขึ้น" : "Every room, a little clearer"}</p>
            <div className="hero-room-grid">
              {["101", "102", "103"].map((room, i) => (
                <div key={room} className={i === 1 ? "hero-room-cleaning" : "hero-room-ready"}>
                  <BedDouble size={16} /><b>{room}</b>
                  <span>{i === 1 ? (th ? "ทำความสะอาด" : "Cleaning") : (th ? "พร้อมเข้าพัก" : "Ready")}</span>
                </div>
              ))}
            </div>
            <div className="hero-room-foot"><span><Check size={11} />{th ? "2 ห้องพร้อม" : "2 rooms ready"}</span><small>{th ? "ข้อมูลตัวอย่าง" : "Sample data"}</small></div>
          </div>
        </div>
      </div>
    </div>
  );
}
