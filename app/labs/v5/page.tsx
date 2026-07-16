import Link from "next/link";
import type { Metadata } from "next";
import { Noto_Serif_Thai, Cormorant_Garamond, Sarabun } from "next/font/google";
import IPhoneFrame from "@/components/IPhoneFrame";
import AnimatedMobile from "@/components/AnimatedMobile";

export const metadata: Metadata = {
  title: "V5 · Boutique — HostGate Design Lab",
  robots: { index: false, follow: false },
};

/**
 * V5 · Boutique — Thai boutique-hotel luxury, quiet money.
 * Cream + warm ink + muted gold. Noto Serif Thai for display, Cormorant
 * Garamond italic for Latin flourishes, Sarabun light for body copy.
 * Motion is deliberately restrained: `.hero-anim` fades only.
 */

const notoSerifThai = Noto_Serif_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  style: "normal",
  variable: "--font-boutique-serif",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["italic", "normal"],
  variable: "--font-boutique-flourish",
});

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400"],
  style: "normal",
  variable: "--font-boutique-body",
});

const INK = "#2e2a24";
const GOLD = "#a16207";
const HAIRLINE = "#e7dfd2";
const FRAME_GOLD = "#d9c9a3";
const CREAM = "#faf6ef";
const SAND = "#f3ede1";

const serif = { fontFamily: "var(--font-boutique-serif)" };
const flourish = { fontFamily: "var(--font-boutique-flourish)" };

const FEATURES = [
  {
    n: "๐๑",
    name: "ปฏิทินการจองแบบลาก-วาง",
    desc: "ลากวางแค่ปลายนิ้ว จัดห้องได้ในไม่กี่วินาที",
  },
  {
    n: "๐๒",
    name: "Channel Manager",
    desc: "เชื่อม Booking.com และ Agoda อัตโนมัติ ไม่ต้องพิมพ์ซ้ำ",
  },
  {
    n: "๐๓",
    name: "ผู้เช่ารายเดือน",
    desc: "จัดการสัญญาเช่า บิลค่าน้ำค่าไฟ ในที่เดียว",
  },
  {
    n: "๐๔",
    name: "งานแม่บ้าน",
    desc: "มอบหมายงานทำความสะอาด ติดตามสถานะห้องแบบเรียลไทม์",
  },
  {
    n: "๐๕",
    name: "ใบกำกับภาษี / ใบเสร็จ",
    desc: "ออกเอกสารบัญชีถูกต้องตามกฎหมาย ในคลิกเดียว",
  },
  {
    n: "๐๖",
    name: "รายงานรายได้ Real-time",
    desc: "เห็นรายได้ อัตราเข้าพัก และ RevPAR ได้ทันที",
  },
];

const STATS = [
  { v: "42+", l: "ห้องพัก" },
  { v: "10,000+", l: "คืนที่เข้าพัก" },
  { v: "120+", l: "ที่พักที่ใช้งาน" },
  { v: "99.9%", l: "Uptime" },
];

const TRUSTED = [
  "PhuketPool",
  "Pattaya Suites",
  "SukhumvitStay",
  "HuaHin Bay",
  "Krabi Cliff",
  "BangkokInn",
];

const PLANS = [
  {
    name: "Free",
    price: "฿0",
    per: "/เดือน",
    desc: "เริ่มต้นสำหรับที่พักขนาดเล็ก",
    bullets: ["1 ที่พัก", "สูงสุด 10 ห้อง", "ปฏิทินการจอง"],
    featured: false,
  },
  {
    name: "Standard",
    price: "฿990",
    per: "/เดือน",
    desc: "สำหรับที่พักที่กำลังเติบโต",
    bullets: ["ห้องไม่จำกัด", "ผู้เช่ารายเดือน", "ใบกำกับภาษี/ใบเสร็จ"],
    featured: true,
  },
  {
    name: "Pro",
    price: "฿2,490",
    per: "/เดือน",
    desc: "สำหรับผู้บริหารหลายที่พัก",
    bullets: ["หลายที่พักในบัญชีเดียว", "Channel Manager", "AI ตอบแชทแขก"],
    featured: false,
  },
];

export default function LabV5Page() {
  return (
    <main
      className={`${notoSerifThai.variable} ${cormorant.variable} ${sarabun.variable} min-h-screen overflow-x-hidden antialiased`}
      style={{ fontFamily: "var(--font-boutique-body)", fontWeight: 300, background: CREAM, color: INK }}
    >
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ borderColor: HAIRLINE, background: `${CREAM}cc`, backdropFilter: "blur(6px)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <Link href="/" className="text-xl italic" style={{ ...flourish, color: INK }}>
            HostGate
          </Link>
          <nav className="flex items-center gap-3 sm:gap-8">
            <Link
              href="/labs"
              className="text-[11px] uppercase tracking-[0.15em] sm:text-xs sm:tracking-[0.2em]"
              style={{ color: "#8a8069" }}
            >
              ← Design Lab
            </Link>
            <Link
              href="/signup"
              className="rounded-sm border px-3 py-2 text-[11px] uppercase tracking-[0.15em] transition-colors sm:px-5 sm:text-xs sm:tracking-[0.2em]"
              style={{ borderColor: GOLD, color: GOLD }}
            >
              เริ่มต้นฟรี
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative px-6 py-20 sm:px-8 sm:py-28">
        {/* certificate-style gold double rule */}
        <div className="pointer-events-none absolute inset-3 border sm:inset-6" style={{ borderColor: FRAME_GOLD }} aria-hidden />
        <div
          className="pointer-events-none absolute inset-5 border sm:inset-9"
          style={{ borderColor: FRAME_GOLD, opacity: 0.55 }}
          aria-hidden
        />
        {[
          "left-2 top-2 sm:left-5 sm:top-5",
          "right-2 top-2 sm:right-5 sm:top-5",
          "left-2 bottom-2 sm:left-5 sm:bottom-5",
          "right-2 bottom-2 sm:right-5 sm:bottom-5",
        ].map((pos) => (
          <span
            key={pos}
            className={`pointer-events-none absolute ${pos} text-sm sm:text-base`}
            style={{ color: GOLD }}
            aria-hidden
          >
            ✦
          </span>
        ))}

        <div className="relative mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center text-center sm:min-h-[70vh]">
          <p
            className="hero-anim text-[11px] uppercase tracking-[0.4em] sm:text-xs"
            style={{ color: GOLD, animationDelay: "0.05s" }}
          >
            — Boutique PMS —
          </p>

          <h1
            className="hero-anim mt-6 text-[2.5rem] font-medium leading-[1.2] sm:text-6xl md:text-7xl"
            style={{ ...serif, animationDelay: "0.18s" }}
          >
            ที่พักของคุณ
            <br />
            บริหารง่ายขึ้น
          </h1>

          <p
            className="hero-anim mx-auto mt-6 max-w-xl text-sm font-light leading-relaxed sm:text-base"
            style={{ color: "#5b5545", animationDelay: "0.32s" }}
          >
            ระบบจัดการห้องพัก สำหรับโรงแรมและอพาร์ตเมนต์ ออกแบบใหม่ตั้งแต่ต้น
          </p>

          <div
            className="hero-anim mt-10 flex flex-col items-center gap-4 sm:flex-row"
            style={{ animationDelay: "0.46s" }}
          >
            <Link
              href="/signup"
              className="sweep rounded-sm px-9 py-3.5 text-xs uppercase tracking-[0.25em] transition-colors sm:text-sm"
              style={{ background: GOLD, color: CREAM }}
            >
              เริ่มใช้งาน
            </Link>
            <Link
              href="#demo"
              className="rounded-sm border px-9 py-3.5 text-xs uppercase tracking-[0.25em] transition-colors sm:text-sm"
              style={{ borderColor: `${INK}4d`, color: INK }}
            >
              ดู Demo
            </Link>
          </div>

          <p className="hero-anim mt-5 text-xs" style={{ color: "#a39b87", animationDelay: "0.56s" }}>
            ไม่ต้องใช้บัตรเครดิต
          </p>
        </div>

        <div
          id="demo"
          className="hero-anim relative mx-auto mt-16 flex max-w-5xl items-center justify-center gap-6 sm:mt-24 sm:gap-12"
          style={{ animationDelay: "0.66s" }}
        >
          <div className="hidden shrink-0 flex-col items-end gap-3 text-right md:flex">
            <span className="h-px w-14" style={{ background: FRAME_GOLD }} aria-hidden />
            <span className="text-lg italic leading-snug" style={{ ...flourish, color: "#5b5545" }}>
              ระบบเดียว
              <br />
              ครบทุกงาน
            </span>
          </div>

          <div className="w-[230px] shrink-0">
            <IPhoneFrame>
              <AnimatedMobile />
            </IPhoneFrame>
          </div>

          <div className="hidden shrink-0 flex-col items-start gap-3 text-left md:flex">
            <span className="h-px w-14" style={{ background: FRAME_GOLD }} aria-hidden />
            <span className="text-lg italic leading-snug" style={{ ...flourish, color: "#5b5545" }}>
              สำหรับที่พัก
              <br />
              ที่ใส่ใจ
            </span>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="px-6 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.4em]" style={{ color: GOLD }}>
              — Features —
            </p>
            <h2 className="mt-4 text-3xl sm:text-4xl" style={serif}>
              ออกแบบมาเพื่องานหลังบ้านของคุณ
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-x-16 gap-y-10 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.n} className="flex items-baseline gap-6 border-b pb-6" style={{ borderColor: HAIRLINE }}>
                <span className="shrink-0 text-2xl" style={{ ...serif, color: GOLD }}>
                  {f.n}
                </span>
                <div>
                  <h3 className="text-lg" style={serif}>
                    {f.name}
                  </h3>
                  <p className="mt-1.5 text-sm font-light leading-relaxed" style={{ color: "#5b5545" }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quote ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 sm:px-8 sm:py-28" style={{ background: SAND }}>
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-5xl italic sm:text-6xl" style={{ ...flourish, color: GOLD }} aria-hidden>
            &ldquo;
          </span>
          <blockquote
            className="mt-2 text-2xl italic leading-relaxed sm:text-3xl"
            style={{ ...flourish, color: INK }}
          >
            เหมือนมีผู้จัดการหลังบ้านที่ไม่เคยหลับ ทุกอย่างเรียบร้อย ทุกเช้า
          </blockquote>
          <p className="mt-6 text-xs uppercase tracking-[0.3em]" style={{ color: GOLD }}>
            — คุณอรุณี ศรีสุข · PhuketPool —
          </p>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:px-8 sm:py-24">
        <div
          className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-8 border-y px-6 py-12 text-center sm:gap-x-4"
          style={{ borderColor: HAIRLINE }}
        >
          {STATS.map((s, i) => (
            <div key={s.l} className="flex items-center gap-x-3 sm:gap-x-4">
              <div className="px-3">
                <div className="text-3xl sm:text-4xl" style={serif}>
                  {s.v}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.25em]" style={{ color: "#8a8069" }}>
                  {s.l}
                </div>
              </div>
              {i < STATS.length - 1 && (
                <span className="hidden sm:inline" style={{ color: GOLD }} aria-hidden>
                  ·
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-3xl text-center">
          <p className="text-[11px] uppercase tracking-[0.35em]" style={{ color: "#a39b87" }}>
            ที่พักที่ไว้วางใจเรา
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {TRUSTED.map((t) => (
              <span key={t} className="text-sm italic" style={{ ...flourish, color: "#5b5545" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.4em]" style={{ color: GOLD }}>
              — Pricing —
            </p>
            <h2 className="mt-4 text-3xl sm:text-4xl" style={serif}>
              แผนราคา เรียบง่าย โปร่งใส
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 border-t md:grid-cols-3" style={{ borderColor: HAIRLINE }}>
            {PLANS.map((p) => (
              <div
                key={p.name}
                className="border-b px-8 py-12 text-center last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
                style={{ borderColor: HAIRLINE, background: p.featured ? SAND : "transparent" }}
              >
                <p className="h-4 text-[10px] uppercase tracking-[0.3em]" style={{ color: GOLD }}>
                  {p.featured ? "แนะนำ" : ""}
                </p>
                <h3 className="mt-3 text-xs uppercase tracking-[0.3em]" style={{ color: "#8a8069" }}>
                  {p.name}
                </h3>
                <div className="mt-4">
                  <span className="text-4xl sm:text-5xl" style={serif}>
                    {p.price}
                  </span>
                  <span className="text-sm" style={{ color: "#8a8069" }}>
                    {p.per}
                  </span>
                </div>
                <p className="mt-3 text-sm font-light" style={{ color: "#5b5545" }}>
                  {p.desc}
                </p>
                <ul className="mt-6 space-y-2 text-sm font-light" style={{ color: "#5b5545" }}>
                  {p.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 inline-block border-b text-xs uppercase tracking-[0.2em] transition-colors"
                  style={{ borderColor: GOLD, color: GOLD }}
                >
                  เริ่มต้นฟรี →
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-xs" style={{ color: "#a39b87" }}>
            เดือนแรกฟรีทุกแผน
          </p>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="px-6 py-24 text-center sm:px-8 sm:py-28" style={{ background: INK, color: CREAM }}>
        <p className="text-[11px] uppercase tracking-[0.4em]" style={{ color: FRAME_GOLD }}>
          — เริ่มต้นวันนี้ —
        </p>
        <h2 className="mx-auto mt-5 max-w-xl text-3xl leading-tight sm:text-4xl" style={serif}>
          พร้อมยกระดับที่พักของคุณหรือยัง
        </h2>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="sweep rounded-sm px-9 py-3.5 text-xs uppercase tracking-[0.25em] transition-colors sm:text-sm"
            style={{ background: GOLD, color: CREAM }}
          >
            เริ่มใช้งาน
          </Link>
          <Link
            href="#demo"
            className="rounded-sm border px-9 py-3.5 text-xs uppercase tracking-[0.25em] transition-colors sm:text-sm"
            style={{ borderColor: `${CREAM}4d`, color: CREAM }}
          >
            ดู Demo
          </Link>
        </div>
        <p className="mt-5 text-xs" style={{ color: `${CREAM}80` }}>
          ไม่ต้องใช้บัตรเครดิต
        </p>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="px-6 py-10 text-center sm:px-8" style={{ background: SAND }}>
        <p className="text-lg italic" style={{ ...flourish, color: INK }}>
          HostGate
        </p>
        <p className="mt-3 text-xs tracking-[0.15em]" style={{ color: "#8a8069" }}>
          © 2026 HostGate ·{" "}
          <Link href="/labs" className="underline underline-offset-4">
            Design Lab
          </Link>
        </p>
      </footer>
    </main>
  );
}
