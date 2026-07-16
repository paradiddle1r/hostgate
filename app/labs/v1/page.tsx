import Link from "next/link";
import type { Metadata } from "next";
import { Fraunces, Anuphan } from "next/font/google";
import StudioDisplay from "@/components/StudioDisplay";
import AnimatedDashboard from "@/components/AnimatedDashboard";

export const metadata: Metadata = {
  title: "V1 · Editorial — Design Lab — HostGate",
  robots: { index: false, follow: false },
};

// Display serif — Latin words, numerals, section labels only (no Thai glyphs).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["italic", "normal"],
  display: "swap",
});

// Body / headline face — carries the Thai copy.
const anuphan = Anuphan({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const FEATURES = [
  {
    name: "ปฏิทินการจองแบบลาก-วาง",
    desc: "ลากวางจัดห้อง เปลี่ยนวันที่ ย้ายแขกได้ในคลิกเดียว",
  },
  {
    name: "Channel Manager",
    desc: "ซิงก์ห้องว่างและราคากับ Booking.com / Agoda แบบเรียลไทม์",
  },
  {
    name: "ผู้เช่ารายเดือน + บิลค่าน้ำค่าไฟ",
    desc: "จดมิเตอร์ คำนวณบิล ออกใบแจ้งหนี้ให้ผู้เช่าอัตโนมัติ",
  },
  {
    name: "งานแม่บ้าน",
    desc: "คิวทำความสะอาดที่อัปเดตสถานะห้องให้ทั้งทีมเห็นตรงกัน",
  },
  {
    name: "ใบกำกับภาษี / ใบเสร็จ",
    desc: "ออกเอกสารบัญชีถูกต้องตามกฎหมาย พร้อมเลขที่รันอัตโนมัติ",
  },
  {
    name: "AI ตอบแชทแขก",
    desc: "ตอบคำถามและปิดการจองผ่านไลน์ได้เองตลอด 24 ชั่วโมง",
  },
];

const STATS = [
  { value: "42+", label: "ห้องพัก" },
  { value: "10,000+", label: "คืนของแขก" },
  { value: "120+", label: "ที่พักที่ใช้งาน" },
  { value: "99.9%", label: "Uptime" },
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
    amount: "0",
    period: "",
    features: ["1 ที่พัก", "10 ห้อง", "ปฏิทินการจองพื้นฐาน"],
    featured: false,
  },
  {
    name: "Standard",
    amount: "990",
    period: "/เดือน",
    features: ["ห้องไม่จำกัด", "ผู้เช่ารายเดือน + บิลค่าน้ำค่าไฟ", "ใบกำกับภาษี / ใบเสร็จ"],
    featured: true,
  },
  {
    name: "Pro",
    amount: "2,490",
    period: "/เดือน",
    features: ["หลายที่พัก", "Channel Manager", "AI ตอบแชทแขก"],
    featured: false,
  },
];

export default function LabV1() {
  return (
    <div className={`${anuphan.className} bg-white text-zinc-900`}>
      <main className="mx-auto max-w-6xl border-x border-zinc-200 bg-white">
        {/* Mini navbar */}
        <nav className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 sm:px-8">
          <Link
            href="/"
            className={`${fraunces.className} italic text-lg tracking-tight text-zinc-900`}
          >
            HostGate
            <span className="text-rose-600">.</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-8">
            <Link
              href="/labs"
              className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 transition hover:text-zinc-900 sm:text-xs sm:tracking-[0.18em]"
            >
              ← Design Lab
            </Link>
            <Link
              href="/signup"
              className="border border-zinc-900 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-zinc-900 transition hover:bg-zinc-900 hover:text-white sm:px-4 sm:text-xs"
            >
              เริ่มต้นฟรี
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="border-b border-zinc-200">
          <div className="grid gap-10 px-6 pb-14 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1fr_260px] lg:gap-16 lg:pb-20 lg:pt-24">
            <div className="min-w-0">
              <p className="hero-anim text-[10px] font-medium uppercase tracking-[0.32em] text-zinc-500 sm:text-[11px]">
                HostGate — Hotel &amp; Apartment PMS
              </p>

              <h1
                className="hero-anim mt-6 font-semibold leading-[0.98] tracking-tight text-zinc-900"
                style={{ animationDelay: "0.08s" }}
              >
                <span className="block text-4xl sm:text-6xl lg:text-8xl">ที่พักของคุณ</span>
                <span className="block text-4xl sm:text-6xl lg:text-8xl">บริหารง่ายขึ้น</span>
              </h1>

              <p
                className={`${fraunces.className} hero-anim mt-4 italic text-lg text-rose-600 sm:text-2xl`}
                style={{ animationDelay: "0.14s" }}
              >
                Your property. Simply managed.
              </p>

              <p
                className="hero-anim mt-6 max-w-md text-base leading-relaxed text-zinc-600"
                style={{ animationDelay: "0.2s" }}
              >
                ระบบจัดการห้องพัก สำหรับโรงแรมและอพาร์ตเมนต์ ออกแบบใหม่ตั้งแต่ต้น
              </p>

              <div
                className="hero-anim mt-8 flex flex-wrap items-center gap-5"
                style={{ animationDelay: "0.26s" }}
              >
                <Link
                  href="/signup"
                  className="sweep bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-rose-600"
                >
                  เริ่มใช้งาน →
                </Link>
                <Link
                  href="/"
                  className="link-underline border-b border-zinc-900 pb-0.5 text-sm font-medium text-zinc-900"
                >
                  ดู Demo
                </Link>
              </div>

              <p
                className="hero-anim mt-4 text-xs text-zinc-400"
                style={{ animationDelay: "0.3s" }}
              >
                ไม่ต้องใช้บัตรเครดิต
              </p>
            </div>

            <aside
              className="hero-anim hidden lg:block"
              style={{ animationDelay: "0.34s" }}
            >
              <div className="space-y-6 border-l border-zinc-200 pl-6">
                <div>
                  <p className={`${fraunces.className} italic text-3xl text-zinc-900`}>
                    Vol. 01
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Issue — 2026
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-zinc-600">
                  ออกแบบมาสำหรับเจ้าของโรงแรมและอพาร์ตเมนต์ที่อยากได้ระบบจัดการตรงไปตรงมา
                  ไม่ต้องเรียนรู้นาน
                </p>
                <ul className="space-y-2 text-xs text-zinc-500">
                  <li>— ปฏิทินลาก-วาง</li>
                  <li>— บิลรายเดือนอัตโนมัติ</li>
                  <li>— AI ตอบแชทแขก</li>
                </ul>
              </div>
            </aside>
          </div>

          {/* Figure — hero device mock */}
          <figure
            className="hero-anim border-t border-zinc-200 px-6 py-10 sm:px-8 sm:py-14"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="tilt border border-zinc-200 bg-white p-3 sm:p-6">
              <StudioDisplay className="max-w-3xl">
                <AnimatedDashboard />
              </StudioDisplay>
            </div>
            <figcaption className="mt-4 flex items-baseline gap-2 text-xs text-zinc-500">
              <span className={`${fraunces.className} italic text-rose-600`}>fig. 1</span>
              <span>— ปฏิทินการจองแบบลาก-วาง</span>
            </figcaption>
          </figure>
        </section>

        {/* Features */}
        <section className="border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-24">
          <p className="flex items-baseline gap-3 text-xs uppercase tracking-[0.28em] text-zinc-500">
            <span className={`${fraunces.className} italic text-lg text-rose-600 sm:text-xl`}>
              02
            </span>
            Features — ฟีเจอร์หลัก
          </p>

          <div className="mt-8 divide-y divide-zinc-200 border-t border-b border-zinc-200">
            {FEATURES.map((f, i) => (
              <div
                key={f.name}
                className="group py-6 sm:grid sm:grid-cols-[4rem_18rem_1fr] sm:items-baseline sm:gap-8"
              >
                <div className="flex items-baseline gap-3 sm:contents">
                  <span
                    className={`${fraunces.className} w-8 shrink-0 italic text-2xl text-zinc-300 transition group-hover:text-rose-600 sm:w-auto sm:text-3xl`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-base font-semibold text-zinc-900 sm:text-lg">
                    {f.name}
                  </span>
                </div>
                <span className="mt-2 block text-sm text-zinc-500 sm:mt-0 sm:text-right">
                  {f.desc}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Social proof */}
        <section className="border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-24">
          <p className="flex items-baseline gap-3 text-xs uppercase tracking-[0.28em] text-zinc-500">
            <span className={`${fraunces.className} italic text-lg text-rose-600 sm:text-xl`}>
              03
            </span>
            Proof — ตัวเลขจริง
          </p>

          <div className="mt-8 grid grid-cols-2 divide-x divide-y divide-zinc-200 border border-zinc-200 sm:grid-cols-4 sm:divide-y-0">
            {STATS.map((s) => (
              <div key={s.label} className="px-4 py-8 text-center sm:px-6">
                <p
                  className={`${fraunces.className} italic text-3xl text-zinc-900 sm:text-5xl lg:text-6xl`}
                >
                  {s.value}
                </p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-zinc-500 sm:text-xs">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-zinc-200 pt-8 text-xs uppercase tracking-[0.14em] text-zinc-400">
            {TRUSTED.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-24">
          <p className="flex items-baseline gap-3 text-xs uppercase tracking-[0.28em] text-zinc-500">
            <span className={`${fraunces.className} italic text-lg text-rose-600 sm:text-xl`}>
              04
            </span>
            Pricing — ราคา
          </p>

          <div className="mt-10 grid divide-y divide-zinc-200 border-t border-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {PLANS.map((p) => (
              <div key={p.name} className="py-8 sm:px-8 sm:first:pl-0 sm:last:pr-0">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
                    p.featured ? "text-rose-600" : "text-transparent"
                  }`}
                >
                  แนะนำ
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-900">{p.name}</p>
                <p className="mt-4 flex items-baseline gap-1">
                  <span
                    className={`${anuphan.className} text-2xl font-medium text-zinc-900 sm:text-3xl`}
                  >
                    ฿
                  </span>
                  <span
                    className={`${fraunces.className} italic text-4xl text-zinc-900 sm:text-5xl`}
                  >
                    {p.amount}
                  </span>
                  {p.period && <span className="text-sm text-zinc-500">{p.period}</span>}
                </p>
                <ul className="mt-6 space-y-2 text-sm text-zinc-600">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-zinc-300">—</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-zinc-400">เดือนแรกฟรี</p>
                <Link
                  href="/signup"
                  className={`link-underline mt-6 inline-block border-b pb-0.5 text-sm font-medium transition ${
                    p.featured
                      ? "border-rose-600 text-rose-600"
                      : "border-zinc-900 text-zinc-900"
                  }`}
                >
                  เริ่มใช้งาน →
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-b border-zinc-200 px-6 py-20 text-center sm:px-8 sm:py-28">
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">พร้อมเริ่มหรือยัง</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-6xl">
            เริ่มบริหารที่พัก
            <span className="text-rose-600">.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-sm text-zinc-500">
            ไม่ต้องใช้บัตรเครดิต · เดือนแรกฟรีทุกแผน
          </p>
          <div className="mt-8">
            <Link
              href="/signup"
              className="sweep inline-block bg-zinc-900 px-8 py-3.5 text-sm font-medium text-white transition hover:bg-rose-600"
            >
              เริ่มใช้งาน →
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 sm:px-8">
          <div className="flex flex-col items-center justify-between gap-3 text-xs text-zinc-400 sm:flex-row">
            <p>© 2026 HostGate</p>
            <Link href="/labs" className="link-underline text-zinc-400 hover:text-zinc-900">
              ← Design Lab
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
