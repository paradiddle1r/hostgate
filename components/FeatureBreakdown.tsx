"use client";

import { ReactNode } from "react";
import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";
import Reveal from "./Reveal";
import StudioDisplay from "./StudioDisplay";
import IpadFrame from "./IpadFrame";
import IPhoneFrame from "./IPhoneFrame";
import AnimatedDashboard from "./AnimatedDashboard";
import AnimatedMobile from "./AnimatedMobile";
import MonthlyRentalScene from "./scenes/MonthlyRentalScene";
import PaymentScene from "./scenes/PaymentScene";
import HousekeepingScene from "./scenes/HousekeepingScene";
import GuestCRMScene from "./scenes/GuestCRMScene";

type Device = "studio" | "ipad" | "iphone";

interface FeatureRow {
  eyebrow: { th: string; en: string };
  title: { th: string; en: string };
  desc: { th: string; en: string };
  bullets: { th: string; en: string }[];
  device: Device;
  scene: ReactNode;
}

export default function FeatureBreakdown() {
  const { locale } = useI18n();

  const rows: FeatureRow[] = [
    {
      eyebrow: { th: "การจอง", en: "Bookings" },
      title: { th: "ลากวาง.\nย้ายการจอง.", en: "Drag.\nMove bookings." },
      desc: {
        th: "ลากบล็อกการจองเพื่อย้ายห้องหรือเปลี่ยนวัน เห็นผลทันที",
        en: "Drag a booking to change its room or dates. See the result instantly.",
      },
      bullets: [
        { th: "ปฏิทินรายห้อง/รายชั้น", en: "Per-room and per-floor calendars" },
        { th: "เห็นห้องว่าง 30 วันข้างหน้า", en: "30-day availability at a glance" },
        { th: "ป้องกัน double-booking อัตโนมัติ", en: "Automatic double-booking protection" },
      ],
      device: "studio",
      scene: <AnimatedDashboard phase={1} />,
    },
    {
      eyebrow: { th: "Channel Manager", en: "Channels" },
      title: { th: "ทุก OTA.\nซิงค์ทันที.", en: "Every channel.\nIn sync." },
      desc: {
        th: "เปลี่ยนราคาที่เดียว อัปเดตทุก OTA ในไม่กี่วินาที ไม่มี overbooking",
        en: "Change a rate once. Every OTA updates in seconds. Zero overbookings.",
      },
      bullets: [
        { th: "Booking, Agoda, Airbnb, Expedia", en: "Booking, Agoda, Airbnb, Expedia" },
        { th: "ซิงค์ภายใน 30 วินาที", en: "Sync within 30 seconds" },
        { th: "Auto-rate per channel/season", en: "Auto rates per channel and season" },
      ],
      device: "studio",
      scene: <AnimatedDashboard phase={3} />,
    },
    {
      eyebrow: { th: "ระบบรายเดือน", en: "Monthly Rentals" },
      title: { th: "ค่าเช่ารายเดือน.\nบนระบบอัตโนมัติ.", en: "Monthly rent.\nOn autopilot." },
      desc: {
        th: "เก็บค่าเช่า บันทึกค่าน้ำค่าไฟ ออกใบเสร็จ — สำหรับหอพัก อพาร์ตเมนต์ และ co-living",
        en: "Collect rent, log utilities, issue receipts — built for dorms, apartments, and co-living.",
      },
      bullets: [
        { th: "ผู้เช่าและสัญญาเช่า", en: "Tenant and lease tracking" },
        { th: "ใบแจ้งหนี้ + ใบเสร็จอัตโนมัติ", en: "Auto invoices and receipts" },
        { th: "ค่าน้ำ-ค่าไฟ ตามมิเตอร์", en: "Per-meter water and electricity" },
      ],
      device: "ipad",
      scene: <MonthlyRentalScene />,
    },
    {
      eyebrow: { th: "การเงิน", en: "Payments" },
      title: { th: "เก็บเงิน.\nทันที.", en: "Get paid.\nInstantly." },
      desc: {
        th: "PromptPay QR สำหรับคนไทย บัตรเครดิตสำหรับชาวต่างชาติ ดูยอดเข้า real-time",
        en: "PromptPay for locals, cards for travelers. Watch payments arrive in real-time.",
      },
      bullets: [
        { th: "PromptPay QR ในตัว", en: "Built-in PromptPay QR" },
        { th: "บัตรเครดิต Visa, Master, JCB", en: "Visa, Mastercard, JCB" },
        { th: "ใบกำกับภาษีอัตโนมัติ", en: "Auto tax invoices" },
      ],
      device: "ipad",
      scene: <PaymentScene />,
    },
    {
      eyebrow: { th: "ลูกค้า", en: "Guests" },
      title: { th: "รู้จัก.\nทุกคน.", en: "Know.\nEveryone." },
      desc: {
        th: "เก็บข้อมูล รายการเข้าพัก ความชอบของแต่ละคน — สำหรับสร้างประสบการณ์ที่ดี",
        en: "Store profiles, stay history, and preferences — for better personalized service.",
      },
      bullets: [
        { th: "Guest profile + ประวัติ", en: "Guest profile + history" },
        { th: "Tag VIP, Repeat, Blacklist", en: "VIP, Repeat, Blacklist tags" },
        { th: "ส่งอีเมล/SMS เป็น group ได้", en: "Email/SMS campaigns" },
      ],
      device: "ipad",
      scene: <GuestCRMScene />,
    },
    {
      eyebrow: { th: "แม่บ้าน", en: "Housekeeping" },
      title: { th: "พนักงาน.\nบนมือถือ.", en: "Staff.\nOn their phone." },
      desc: {
        th: "พนักงานทำความสะอาดอัปเดตสถานะห้องจากมือถือ คุณเห็นทันทีว่าห้องไหนพร้อม",
        en: "Housekeepers update room status from their phone. You see ready rooms instantly.",
      },
      bullets: [
        { th: "แอป iOS + Android สำหรับพนักงาน", en: "iOS + Android staff app" },
        { th: "ตารางงานรายวัน", en: "Daily task assignment" },
        { th: "แจ้งเตือนห้องค้างทำ", en: "Pending-room alerts" },
      ],
      device: "iphone",
      scene: <HousekeepingScene />,
    },
    {
      eyebrow: { th: "Mobile", en: "Mobile" },
      title: { th: "ทุกอย่าง.\nในกระเป๋า.", en: "Everything.\nIn your pocket." },
      desc: {
        th: "เปิดดู dashboard ยอดขาย การจอง รายงาน จากที่ไหนก็ได้บนโลก",
        en: "Open the dashboard, sales, bookings, and reports from anywhere in the world.",
      },
      bullets: [
        { th: "Dashboard real-time", en: "Real-time dashboard" },
        { th: "แจ้งเตือนการจองใหม่ทันที", en: "Instant booking alerts" },
        { th: "อนุมัติเช็คอินจากมือถือ", en: "Approve check-ins on the go" },
      ],
      device: "iphone",
      scene: <AnimatedMobile />,
    },
  ];

  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <SectionHeader
            badge={locale === "th" ? "ลึก" : "Deep dive"}
            title={locale === "th" ? "ดูทุกฟีเจอร์." : "See every feature."}
            subtitle={
              locale === "th"
                ? "เลื่อนลงเพื่อดูแต่ละความสามารถ พร้อมตัวอย่างจริง"
                : "Scroll through each capability with live examples."
            }
          />
        </Reveal>

        <div className="mt-20 space-y-32 lg:space-y-44">
          {rows.map((row, i) => (
            <FeatureRowComponent key={i} row={row} reversed={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRowComponent({ row, reversed }: { row: FeatureRow; reversed: boolean }) {
  const { locale } = useI18n();

  const deviceFrame = (
    <div className="tilt">
      {row.device === "studio" && <StudioDisplay>{row.scene}</StudioDisplay>}
      {row.device === "ipad" && (
        <div className="mx-auto max-w-[480px]">
          <IpadFrame orientation="landscape">{row.scene}</IpadFrame>
        </div>
      )}
      {row.device === "iphone" && (
        <div className="mx-auto max-w-[260px]">
          <IPhoneFrame>{row.scene}</IPhoneFrame>
        </div>
      )}
    </div>
  );

  const text = (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">
        {pick(row.eyebrow, locale)}
      </p>
      <h3 className="mt-4 whitespace-pre-line text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-zinc-900 lg:text-5xl">
        {pick(row.title, locale)}
      </h3>
      <p className="mt-5 text-lg leading-relaxed text-zinc-600">{pick(row.desc, locale)}</p>
      <ul className="mt-6 space-y-2.5">
        {row.bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-zinc-700">
            <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 flex-none text-zinc-900" fill="currentColor">
              <path d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.5A1 1 0 014.7 8.1l3 3 6.7-6.7a1 1 0 011.3-.1z" />
            </svg>
            <span>{pick(b, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Reveal>
      <div className={`grid gap-12 lg:grid-cols-2 lg:gap-16 ${reversed ? "lg:grid-flow-dense" : ""}`}>
        <div className={`flex items-center ${reversed ? "lg:col-start-2" : ""}`}>{text}</div>
        <div className={`flex items-center ${reversed ? "lg:col-start-1" : ""}`}>{deviceFrame}</div>
      </div>
    </Reveal>
  );
}
