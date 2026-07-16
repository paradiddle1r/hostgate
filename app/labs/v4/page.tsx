import Link from "next/link";
import type { Metadata } from "next";
import { Archivo_Black, Kanit, Space_Mono } from "next/font/google";
import {
  CalendarDays,
  Share2,
  Home,
  Sparkles,
  FileText,
  TrendingUp,
  Check,
  ArrowRight,
  Star,
  Ban,
} from "lucide-react";
import IPhoneFrame from "@/components/IPhoneFrame";
import AnimatedMobile from "@/components/AnimatedMobile";

export const metadata: Metadata = {
  title: "V4 · Brutal — HostGate Design Lab",
  robots: { index: false, follow: false },
};

/* ── Fonts ─────────────────────────────────────────────────────────────── */
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-v4-display",
});
const kanit = Kanit({
  subsets: ["latin", "thai"],
  weight: ["600", "700", "800"],
  variable: "--font-v4-kanit",
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-v4-mono",
});

/* ── Shared brutalist tokens ──────────────────────────────────────────── */
const INK = "#111111";
const COBALT = "#1d4ed8";
const PINK = "#ec4899";
const YELLOW = "#facc15";

// Hard offset shadow + pressed-on-hover treatment, reused on every
// interactive / poster element.
const HARD =
  "transition-all duration-150 ease-out shadow-[6px_6px_0_#111] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[2px_2px_0_#111] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none";
const HARD_SM =
  "transition-all duration-150 ease-out shadow-[4px_4px_0_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#111]";

/* ── Copy ─────────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: CalendarDays,
    name: "ปฏิทินการจองแบบลาก-วาง",
    desc: "ลากห้อง ลากวันที่ จบในคลิกเดียว ไม่ต้องพิมพ์ฟอร์ม",
    bg: COBALT,
    fg: "#fff",
    rot: "-rotate-3",
  },
  {
    icon: Share2,
    name: "Channel Manager",
    desc: "ซิงก์ห้องว่าง-ราคากับ Booking.com / Agoda อัตโนมัติ",
    bg: PINK,
    fg: "#fff",
    rot: "rotate-2",
  },
  {
    icon: Home,
    name: "ผู้เช่ารายเดือน",
    desc: "จัดการสัญญาเช่า ออกบิลค่าน้ำค่าไฟให้เองทุกเดือน",
    bg: YELLOW,
    fg: "#111",
    rot: "-rotate-2",
  },
  {
    icon: Sparkles,
    name: "งานแม่บ้าน",
    desc: "คิวทำความสะอาดห้อง อัปเดตสถานะเรียลไทม์",
    bg: INK,
    fg: YELLOW,
    rot: "rotate-3",
  },
  {
    icon: FileText,
    name: "ใบกำกับภาษี/ใบเสร็จ",
    desc: "ออกเอกสารถูกต้องตามกฎหมาย พิมพ์ได้ทันที",
    bg: COBALT,
    fg: "#fff",
    rot: "rotate-2",
  },
  {
    icon: TrendingUp,
    name: "รายงานรายได้ Real-time",
    desc: "ดูรายได้ อัตราเข้าพัก ADR ได้ทุกที่ทุกเวลา",
    bg: PINK,
    fg: "#fff",
    rot: "-rotate-2",
  },
];

const STATS = [
  { v: "42+", l: "ห้องพัก", bg: YELLOW, fg: "#111" },
  { v: "10,000+", l: "คืนผู้เข้าพัก", bg: "#fff", fg: "#111" },
  { v: "120+", l: "ที่พักที่ใช้งาน", bg: COBALT, fg: "#fff" },
  { v: "99.9%", l: "UPTIME", bg: PINK, fg: "#fff" },
];

const TRUSTED = [
  "PhuketPool",
  "Pattaya Suites",
  "SukhumvitStay",
  "HuaHin Bay",
  "Krabi Cliff",
  "BangkokInn",
];

const MARQUEE_ITEMS = [
  "ปฏิทินการจองแบบลาก-วาง",
  "CHANNEL MANAGER",
  "ผู้เช่ารายเดือน+บิลค่าน้ำค่าไฟ",
  "งานแม่บ้าน",
  "ใบกำกับภาษี/ใบเสร็จ",
  "รายงานรายได้ REAL-TIME",
  "BOOKING ENGINE",
  "AI ตอบแชทแขก",
];

const PLANS = [
  {
    name: "Free",
    price: "฿0",
    period: "",
    tag: "1 ที่พัก / 10 ห้อง",
    features: ["1 ที่พัก, 10 ห้อง", "ปฏิทินการจองแบบลาก-วาง", "รายงานพื้นฐาน"],
    variant: "white" as const,
    featured: false,
  },
  {
    name: "Standard",
    price: "฿990",
    period: "/เดือน",
    tag: "ห้องไม่จำกัด",
    features: [
      "ห้องไม่จำกัด",
      "ใบกำกับภาษี + ใบเสร็จ",
      "ผู้เช่ารายเดือน + บิลค่าน้ำค่าไฟ",
      "งานแม่บ้าน",
      "ซัพพอร์ตทางแชท",
    ],
    variant: "cobalt" as const,
    featured: true,
  },
  {
    name: "Pro",
    price: "฿2,490",
    period: "/เดือน",
    tag: "หลายที่พัก + Channel Manager",
    features: [
      "ทุกอย่างใน Standard",
      "หลายที่พัก (Multi-property)",
      "Channel Manager",
      "AI ตอบแชทแขก",
      "ซัพพอร์ตลำดับความสำคัญ",
    ],
    variant: "white" as const,
    featured: false,
  },
];

/* ── Local building blocks ───────────────────────────────────────────── */
function HardLink({
  href,
  children,
  bg,
  fg,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  bg: string;
  fg: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      style={{ background: bg, color: fg }}
      className={`${HARD} inline-flex items-center justify-center gap-2 whitespace-nowrap border-4 border-black px-6 py-3 text-sm font-bold uppercase tracking-wide sm:text-base ${spaceMono.className} ${className}`}
    >
      {children}
    </Link>
  );
}

function Sticker({
  children,
  bg,
  fg,
  rot,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
  rot: string;
}) {
  return (
    <span
      style={{ background: bg, color: fg }}
      className={`${rot} inline-flex items-center gap-1.5 rounded-full border-2 border-black px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-[3px_3px_0_#111] sm:text-xs ${spaceMono.className}`}
    >
      {children}
    </span>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function LabsV4Page() {
  return (
    <div
      className={`${archivoBlack.variable} ${kanit.variable} ${spaceMono.variable} min-h-screen overflow-x-hidden text-black antialiased`}
      style={{ background: YELLOW }}
    >
      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b-4 border-black bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
          <Link
            href="/"
            className={`${archivoBlack.className} text-lg tracking-tight sm:text-xl`}
          >
            HostGate
          </Link>
          <Link
            href="/labs"
            className={`${spaceMono.className} hidden items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-black/70 transition hover:text-black sm:inline-flex`}
          >
            <span aria-hidden>←</span> Design Lab
          </Link>
          <HardLink href="/signup" bg={INK} fg={YELLOW} className="!px-4 !py-2 !text-xs sm:!px-6 sm:!py-2.5 sm:!text-sm">
            เริ่มต้นฟรี
          </HardLink>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
          <div>
            <span
              className={`inline-flex items-center gap-2 border-2 border-black bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] sm:text-xs ${spaceMono.className}`}
            >
              <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
              Property Management System
            </span>

            <h1
              className={`${kanit.className} mt-5 font-extrabold uppercase leading-[1.22] tracking-tight text-black`}
              style={{ fontSize: "clamp(2.75rem, 8vw, 6rem)" }}
            >
              <span className="block">ที่พักของคุณ.</span>
              <span
                className="mt-3 inline-block -rotate-2 bg-[#1d4ed8] px-4 py-2 leading-[1.35] text-white sm:px-5 sm:py-2.5"
                style={{ boxShadow: "6px 6px 0 #111" }}
              >
                บริหารง่ายขึ้น.
              </span>
            </h1>

            <p
              className="mt-6 max-w-lg text-base leading-relaxed text-black/80 sm:text-lg"
              style={{
                fontFamily:
                  "var(--font-v4-mono), var(--font-v4-kanit), ui-sans-serif, system-ui, sans-serif",
              }}
            >
              ระบบจัดการห้องพัก สำหรับโรงแรมและอพาร์ตเมนต์ ออกแบบใหม่ตั้งแต่ต้น
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <HardLink href="/signup" bg={INK} fg={YELLOW}>
                เริ่มใช้งาน <ArrowRight className="h-4 w-4" strokeWidth={3} />
              </HardLink>
              <HardLink href="/book" bg={YELLOW} fg="#111">
                ดู Demo
              </HardLink>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Sticker bg={PINK} fg="#fff" rot="-rotate-3">
                <Star className="h-3.5 w-3.5 fill-white" strokeWidth={0} /> เดือนแรกฟรี
              </Sticker>
              <Sticker bg="#fff" fg="#111" rot="rotate-2">
                <Ban className="h-3.5 w-3.5" strokeWidth={2.5} /> NO CREDIT CARD
              </Sticker>
            </div>
          </div>

          {/* Device mock */}
          <div className="relative mx-auto w-full max-w-[240px] sm:max-w-[270px] lg:mx-0 lg:max-w-[280px]">
            <div
              className="relative rotate-2 border-4 border-black bg-white p-4 sm:p-5"
              style={{ boxShadow: "12px 12px 0 #111" }}
            >
              <IPhoneFrame className="w-full">
                <AnimatedMobile />
              </IPhoneFrame>

              <span
                className={`absolute -right-4 -top-4 -rotate-6 border-2 border-black bg-[#ec4899] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-[3px_3px_0_#111] ${spaceMono.className}`}
              >
                ● LIVE
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ribbon ─────────────────────────────────────────── */}
      <div className="relative py-8 sm:py-10">
        <div
          className="relative left-1/2 w-[120vw] -translate-x-1/2 -rotate-1 overflow-hidden border-y-4 border-black bg-black py-3 sm:py-4"
          style={{ boxShadow: "0 8px 0 rgba(0,0,0,0.15)" }}
        >
          <div className="marquee flex w-max items-center whitespace-nowrap">
            {[0, 1].map((rep) => (
              <div key={rep} className="flex items-center">
                {MARQUEE_ITEMS.map((txt, i) => (
                  <span
                    key={`${rep}-${i}`}
                    className={`mx-4 flex items-center gap-4 text-sm font-bold uppercase tracking-wider text-white sm:mx-6 sm:text-lg ${spaceMono.className}`}
                  >
                    {txt}
                    <span aria-hidden className="text-[#facc15]">
                      ✦
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section className="border-t-4 border-black bg-white px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl">
            <p
              className={`text-xs font-bold uppercase tracking-[0.2em] text-[#1d4ed8] ${spaceMono.className}`}
            >
              Features
            </p>
            <h2
              className={`${kanit.className} mt-2 font-extrabold uppercase leading-[1.05] tracking-tight text-black`}
              style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)" }}
            >
              ฟีเจอร์ครบ จบในที่เดียว
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.name}
                  className={`${HARD_SM} border-2 border-black bg-white p-6`}
                >
                  <div
                    style={{ background: f.bg, color: f.fg }}
                    className={`${f.rot} flex h-12 w-12 items-center justify-center border-2 border-black`}
                  >
                    <Icon className="h-6 w-6" strokeWidth={2.25} />
                  </div>
                  <h3 className={`${kanit.className} mt-4 text-lg font-bold leading-snug text-black`}>
                    {f.name}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-black/70">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Stats + Trusted (social proof) ────────────────────────── */}
      <section className="border-t-4 border-black bg-black px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className={`text-xs font-bold uppercase tracking-[0.2em] text-[#facc15] ${spaceMono.className}`}>
            By the numbers
          </p>
          <h2
            className={`${kanit.className} mt-2 font-extrabold uppercase leading-[1.05] tracking-tight text-white`}
            style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)" }}
          >
            ตัวเลขที่พูดแทนเรา
          </h2>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {STATS.map((s) => (
              <div
                key={s.l}
                style={{ background: s.bg, color: s.fg }}
                className="border-2 border-black p-5 sm:p-7"
              >
                <div className={`${archivoBlack.className} text-3xl leading-none sm:text-5xl`}>
                  {s.v}
                </div>
                <div
                  className={`mt-2 text-[11px] font-bold uppercase tracking-wider sm:text-xs ${spaceMono.className}`}
                  style={{ opacity: 0.85 }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>

          <p
            className={`mt-14 text-xs font-bold uppercase tracking-[0.2em] text-white/50 ${spaceMono.className}`}
          >
            Trusted by
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {TRUSTED.map((name, i) => (
              <span
                key={name}
                className={`${i % 2 === 0 ? "-rotate-1" : "rotate-1"} border-2 border-black bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-black shadow-[3px_3px_0_#facc15] sm:text-sm ${spaceMono.className}`}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────── */}
      <section className="border-t-4 border-black px-5 py-16 sm:px-8 sm:py-24" style={{ background: YELLOW }}>
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.2em] text-[#1d4ed8] ${spaceMono.className}`}>
                Pricing
              </p>
              <h2
                className={`${kanit.className} mt-2 font-extrabold uppercase leading-[1.05] tracking-tight text-black`}
                style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)" }}
              >
                เลือกแผนที่ใช่
              </h2>
            </div>
            <Sticker bg={INK} fg={YELLOW} rot="-rotate-2">
              <Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} /> เดือนแรกฟรีทุกแผน
            </Sticker>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
            {PLANS.map((p) => {
              const isCobalt = p.variant === "cobalt";
              return (
                <div
                  key={p.name}
                  style={{
                    background: isCobalt ? COBALT : "#fff",
                    color: isCobalt ? "#fff" : "#111",
                    boxShadow: p.featured ? "8px 8px 0 #111" : "6px 6px 0 #111",
                  }}
                  className={`relative flex flex-col border-4 border-black p-7 sm:p-8 ${
                    p.featured ? "lg:-mt-4 lg:scale-105" : ""
                  }`}
                >
                  {p.featured && (
                    <span
                      className={`absolute -right-3 -top-3 rotate-6 border-2 border-black bg-[#ec4899] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-[3px_3px_0_#111] ${spaceMono.className}`}
                    >
                      แนะนำ
                    </span>
                  )}

                  <h3 className={`${kanit.className} text-xl font-bold`}>{p.name}</h3>
                  <p className={`mt-1 text-xs ${isCobalt ? "text-white/70" : "text-black/60"} ${spaceMono.className}`}>
                    {p.tag}
                  </p>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span className={`${kanit.className} text-4xl font-extrabold sm:text-5xl`}>{p.price}</span>
                    {p.period && (
                      <span className={`text-sm ${isCobalt ? "text-white/70" : "text-black/60"} ${spaceMono.className}`}>
                        {p.period}
                      </span>
                    )}
                  </div>

                  <ul className="mt-6 flex-1 space-y-3">
                    {p.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm leading-snug">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${isCobalt ? "text-white" : "text-[#1d4ed8]"}`}
                          strokeWidth={3}
                        />
                        <span className={isCobalt ? "text-white/90" : "text-black/80"}>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <HardLink
                    href="/signup"
                    bg={isCobalt ? YELLOW : INK}
                    fg={isCobalt ? "#111" : YELLOW}
                    className="mt-8 w-full"
                  >
                    เริ่มใช้งาน
                  </HardLink>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="border-t-4 border-black bg-[#1d4ed8] px-5 py-16 text-center sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2
            className={`${kanit.className} font-extrabold uppercase leading-[1.05] tracking-tight text-white`}
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
          >
            พร้อมเริ่มบริหารง่ายขึ้นหรือยัง?
          </h2>
          <p
            className={`mt-4 text-sm text-white/80 sm:text-base ${spaceMono.className}`}
          >
            ไม่ต้องใช้บัตรเครดิต · ใช้งานได้ในไม่กี่นาที
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <HardLink href="/signup" bg={YELLOW} fg="#111">
              เริ่มต้นฟรี <ArrowRight className="h-4 w-4" strokeWidth={3} />
            </HardLink>
            <HardLink href="/book" bg="#fff" fg="#111">
              ดู Demo
            </HardLink>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t-4 border-black bg-black px-5 py-8 sm:px-8">
        <div
          className={`mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-white/60 ${spaceMono.className}`}
        >
          <span>© 2026 HostGate</span>
          <Link href="/labs" className="text-white/60 transition hover:text-white">
            ← Design Lab
          </Link>
        </div>
      </footer>
    </div>
  );
}
