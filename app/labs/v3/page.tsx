import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Prompt } from "next/font/google";
import {
  Sparkles,
  ArrowRight,
  Smartphone,
  CalendarDays,
  Wallet,
  RefreshCw,
  Home as HomeIcon,
  Bot,
  FileText,
  Users,
  Check,
} from "lucide-react";
import IPhoneFrame from "@/components/IPhoneFrame";
import AnimatedMobile from "@/components/AnimatedMobile";

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "V3 · Bento — HostGate Design Lab",
  robots: { index: false, follow: false },
};

/* ------------------------------------------------------------------------ */
/* Data                                                                      */
/* ------------------------------------------------------------------------ */

const STATS = [
  { value: "42 ห้อง+", label: "ต่อที่พัก" },
  { value: "10,000+", label: "คืนเข้าพัก" },
  { value: "120+", label: "ที่พักที่ใช้งาน" },
  { value: "99.9%", label: "uptime" },
];

const TRUSTED = ["PhuketPool", "Pattaya Suites", "SukhumvitStay", "HuaHin Bay", "Krabi Cliff", "BangkokInn"];

const PLANS = [
  {
    name: "Free",
    price: "฿0",
    period: "/เดือน",
    desc: "เริ่มต้นใช้งานฟรี ไม่มีค่าใช้จ่าย",
    features: ["1 ที่พัก", "สูงสุด 10 ห้อง", "ปฏิทินการจองแบบลาก-วาง", "รายงานรายได้ Real-time"],
    featured: false,
    dark: false,
  },
  {
    name: "Standard",
    price: "฿990",
    period: "/เดือน",
    desc: "สำหรับที่พักที่กำลังเติบโต",
    features: ["ห้องไม่จำกัด", "งานแม่บ้าน + บิลรายเดือน", "ใบกำกับภาษี / ใบเสร็จ", "AI ตอบแชทแขก"],
    featured: true,
    dark: false,
  },
  {
    name: "Pro",
    price: "฿2,490",
    period: "/เดือน",
    desc: "หลายที่พัก + Channel Manager",
    features: ["ทุกอย่างใน Standard", "หลายที่พักในบัญชีเดียว", "Channel Manager เต็มรูปแบบ", "ทีมงานไม่จำกัดจำนวน"],
    featured: false,
    dark: true,
  },
];

/* ------------------------------------------------------------------------ */
/* Small local building blocks                                              */
/* ------------------------------------------------------------------------ */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`v3b-in ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Tile({
  span,
  tint,
  icon,
  label,
  delay,
  children,
  contentClassName = "",
}: {
  span: string;
  tint: string;
  icon: ReactNode;
  label: string;
  delay: number;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div
      className={`v3b-in group relative flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-stone-900/5 ${span}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`flex shrink-0 items-center gap-2 border-b border-stone-100 px-4 py-2.5 ${tint}`}>
        <span className="text-stone-600">{icon}</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-stone-600">{label}</span>
      </div>
      <div className={`flex flex-1 flex-col ${contentClassName}`}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Page                                                                      */
/* ------------------------------------------------------------------------ */

export default function LabV3() {
  return (
    <div className={`${prompt.className} min-h-screen overflow-x-hidden bg-[#fafaf9] text-stone-900`}>
      {/* Mini navbar */}
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-[#fafaf9]/85 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="text-lg font-semibold tracking-tight text-stone-900">
            Host<span className="text-indigo-500">Gate</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/labs"
              className="text-xs text-stone-500 transition hover:text-stone-900 sm:text-sm"
            >
              ← Design Lab
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 sm:px-4 sm:text-sm"
            >
              เริ่มต้นฟรี
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero — short, compact, the bento is the star */}
      <section className="relative mx-auto flex min-h-[38vh] max-w-4xl flex-col items-center justify-center px-5 pb-8 pt-14 text-center sm:px-8 sm:pt-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_20%,black,transparent)]" />

        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
            <Sparkles className="h-3.5 w-3.5" /> ระบบจัดการที่พัก รุ่นใหม่
          </span>
        </Reveal>

        <Reveal delay={70}>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.15] tracking-tight text-stone-900 sm:text-5xl md:text-6xl">
            ที่พักของคุณ. บริหารง่ายขึ้น.
          </h1>
        </Reveal>

        <Reveal delay={140}>
          <p className="mt-4 max-w-xl text-balance text-base text-stone-500 sm:text-lg">
            ระบบจัดการห้องพัก สำหรับโรงแรมและอพาร์ตเมนต์ ออกแบบใหม่ตั้งแต่ต้น
          </p>
        </Reveal>

        <Reveal delay={210}>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="sweep inline-flex items-center gap-2 rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-600"
            >
              เริ่มใช้งาน <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#bento"
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-400"
            >
              ดู Demo
            </Link>
          </div>
        </Reveal>

        <Reveal delay={270}>
          <p className="mt-4 text-xs text-stone-400">ไม่ต้องใช้บัตรเครดิต</p>
        </Reveal>
      </section>

      {/* THE BENTO — main event */}
      <section id="bento" className="mx-auto max-w-6xl px-5 pb-6 sm:px-8">
        <Reveal className="mb-5 text-center sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-500">ฟีเจอร์</p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            ทุกฟีเจอร์ที่คุณต้องการ อยู่ในที่เดียว
          </h2>
        </Reveal>

        <div className="grid auto-rows-[minmax(150px,auto)] grid-flow-dense grid-cols-2 gap-4 md:grid-cols-4">
          {/* 1. BIG — mobile app mock */}
          <Tile
            span="col-span-2 row-span-1 md:col-span-2 md:row-span-2"
            tint="bg-indigo-100/70"
            icon={<Smartphone className="h-3.5 w-3.5" />}
            label="แอปบนมือถือ"
            delay={0}
            contentClassName="relative items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-4 py-6"
          >
            <span className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-amber-200/40 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-indigo-200/40 blur-3xl" />
            <div className="tilt float relative w-[148px] md:w-[168px]">
              <IPhoneFrame>
                <AnimatedMobile />
              </IPhoneFrame>
            </div>
          </Tile>

          {/* 2. Wide — booking calendar strip */}
          <Tile
            span="col-span-2 md:col-span-3"
            tint="bg-amber-100/70"
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label="ปฏิทินการจองแบบลาก-วาง"
            delay={60}
            contentClassName="justify-center px-4 py-4"
          >
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-stone-400">
              {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-2.5 space-y-2">
              <div className="grid grid-cols-7 gap-1">
                <span className="col-start-1 col-span-3 h-3.5 rounded-full bg-indigo-400" />
              </div>
              <div className="grid grid-cols-7 gap-1">
                <span className="col-start-3 col-span-3 h-3.5 rounded-full bg-amber-400" />
              </div>
              <div className="grid grid-cols-7 gap-1">
                <span className="col-start-2 col-span-4 h-3.5 rounded-full bg-teal-400" />
              </div>
              <div className="grid grid-cols-7 gap-1">
                <span className="col-start-5 col-span-3 h-3.5 rounded-full bg-rose-400" />
              </div>
            </div>
          </Tile>

          {/* 3. Revenue today */}
          <Tile
            span="col-span-1"
            tint="bg-teal-100/70"
            icon={<Wallet className="h-3.5 w-3.5" />}
            label="รายได้วันนี้"
            delay={120}
            contentClassName="justify-between px-4 py-3"
          >
            <div>
              <p className="text-xl font-bold tracking-tight text-stone-900 md:text-2xl">฿42,890</p>
              <p className="mt-0.5 text-[11px] font-medium text-teal-600">+18% จากเมื่อวาน</p>
            </div>
            <div className="mt-3 flex h-8 items-end gap-1">
              {[40, 55, 35, 60, 50, 75, 90].map((h, i) => (
                <span
                  key={i}
                  className={`flex-1 rounded-t-sm ${i === 6 ? "bg-teal-500" : "bg-teal-200"}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </Tile>

          {/* 4. Channel manager */}
          <Tile
            span="col-span-1"
            tint="bg-rose-100/70"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            label="Channel Manager"
            delay={160}
            contentClassName="justify-center gap-1.5 px-3.5 py-3"
          >
            {["Booking.com", "Agoda", "Airbnb"].map((n) => (
              <div
                key={n}
                className="flex w-full items-center justify-between rounded-lg bg-stone-50 px-2.5 py-1.5 text-[10.5px] font-medium text-stone-600"
              >
                <span className="truncate">{n}</span>
                <RefreshCw className="h-3 w-3 shrink-0 text-rose-400 animate-[spin_3s_linear_infinite]" />
              </div>
            ))}
          </Tile>

          {/* 5. Housekeeping */}
          <Tile
            span="col-span-1"
            tint="bg-sky-100/70"
            icon={<HomeIcon className="h-3.5 w-3.5" />}
            label="แม่บ้าน"
            delay={200}
            contentClassName="grid grid-cols-2 content-center gap-2 px-3.5 py-3"
          >
            {["201", "305", "108", "412"].map((room, i) => (
              <div
                key={room}
                className="v3b-chip flex items-center justify-center rounded-xl py-2.5"
                style={{ animationDelay: `-${i * 1.4}s` }}
              >
                <span className="text-[13px] font-bold text-stone-800">{room}</span>
              </div>
            ))}
          </Tile>

          {/* 6. AI chat */}
          <Tile
            span="col-span-1"
            tint="bg-indigo-100/70"
            icon={<Bot className="h-3.5 w-3.5" />}
            label="AI ตอบแชทแขก"
            delay={240}
            contentClassName="justify-center gap-2 px-3.5 py-3"
          >
            <div className="max-w-[88%] self-start rounded-2xl rounded-bl-sm bg-stone-100 px-3 py-1.5 text-[10.5px] leading-relaxed text-stone-700">
              ห้องว่างวันเสาร์ไหมคะ
            </div>
            <div className="max-w-[88%] self-end rounded-2xl rounded-br-sm bg-indigo-500 px-3 py-1.5 text-[10.5px] leading-relaxed text-white">
              ว่างค่ะ ห้อง Superior ฿1,590/คืน 😊
            </div>
          </Tile>

          {/* 7. Tax invoice */}
          <Tile
            span="col-span-2 md:col-span-1"
            tint="bg-amber-100/70"
            icon={<FileText className="h-3.5 w-3.5" />}
            label="ใบกำกับภาษี"
            delay={280}
            contentClassName="justify-center px-4 py-3"
          >
            <div className="space-y-1.5">
              <div className="h-1.5 w-2/3 rounded-full bg-stone-200" />
              <div className="h-1.5 w-1/2 rounded-full bg-stone-200" />
            </div>
            <div className="mt-3 space-y-1.5 text-[10px] text-stone-500">
              <div className="flex justify-between">
                <span>ค่าห้อง</span>
                <span className="tabular-nums">2,600.00</span>
              </div>
              <div className="flex justify-between">
                <span>VAT 7%</span>
                <span className="tabular-nums">182.00</span>
              </div>
              <div className="flex justify-between font-semibold text-stone-800">
                <span>รวม</span>
                <span className="tabular-nums">2,782.00</span>
              </div>
            </div>
            <div className="mt-2.5 flex justify-end">
              <span className="-rotate-12 rounded border-2 border-teal-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-teal-500">
                ชำระแล้ว
              </span>
            </div>
          </Tile>

          {/* 8. Wide — monthly tenant bills table */}
          <Tile
            span="col-span-2 md:col-span-4"
            tint="bg-rose-100/70"
            icon={<Users className="h-3.5 w-3.5" />}
            label="บิลรายเดือน ผู้เช่า"
            delay={320}
            contentClassName="justify-center px-4 py-3"
          >
            <div className="grid grid-cols-[1.5fr_0.6fr_0.9fr_0.9fr] gap-2 px-1 text-[9.5px] font-semibold uppercase tracking-wide text-stone-400 sm:text-[10px]">
              <span>ผู้เช่า</span>
              <span>ห้อง</span>
              <span>ยอดบิล</span>
              <span>สถานะ</span>
            </div>
            <div className="mt-1.5 space-y-1.5">
              {[
                { n: "คุณสมชาย ใจดี", r: "A203", a: "4,850", s: "ชำระแล้ว", ok: true },
                { n: "คุณมาลี พงษ์ศรี", r: "B105", a: "5,120", s: "รอชำระ", ok: false },
                { n: "คุณวิชัย ทองคำ", r: "A310", a: "4,600", s: "ชำระแล้ว", ok: true },
              ].map((row) => (
                <div
                  key={row.r}
                  className="grid grid-cols-[1.5fr_0.6fr_0.9fr_0.9fr] items-center gap-2 rounded-lg bg-stone-50 px-2 py-1.5 text-[10.5px] text-stone-600"
                >
                  <span className="truncate font-medium text-stone-700">{row.n}</span>
                  <span>{row.r}</span>
                  <span className="tabular-nums">฿{row.a}</span>
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      row.ok ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {row.s}
                  </span>
                </div>
              ))}
            </div>
          </Tile>
        </div>
      </section>

      {/* Stats strip */}
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 50}>
              <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-2.5 shadow-sm">
                <span className="text-base font-bold text-stone-900 sm:text-lg">{s.value}</span>
                <span className="text-xs text-stone-500">{s.label}</span>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Trusted names — marquee */}
        <Reveal delay={200} className="mt-8">
          <p className="text-center text-xs text-stone-400">ที่พักที่ไว้วางใจ HostGate</p>
          <div className="relative mt-3 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="marquee flex w-max items-center gap-10">
              {[...TRUSTED, ...TRUSTED].map((n, i) => (
                <span key={`${n}-${i}`} className="shrink-0 text-lg font-semibold tracking-tight text-stone-300">
                  {n}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <Reveal className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-500">แพ็กเกจ</p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            เลือกแผนที่ใช่สำหรับที่พักของคุณ
          </h2>
          <p className="mt-2 text-sm text-stone-500">เดือนแรกฟรีทุกแผน · ยกเลิกเมื่อไหร่ก็ได้</p>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 80}>
              <div
                className={`relative flex h-full flex-col rounded-3xl border p-6 transition-all duration-300 hover:-translate-y-0.5 ${
                  p.featured
                    ? "border-indigo-300 bg-white ring-2 ring-indigo-300 shadow-xl shadow-indigo-500/10"
                    : p.dark
                      ? "border-stone-800 bg-stone-900 text-white"
                      : "border-stone-200 bg-white"
                }`}
              >
                {p.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    แนะนำ
                  </span>
                )}

                <div
                  className={`-mx-6 -mt-6 mb-5 rounded-t-3xl px-6 py-5 ${
                    p.featured ? "bg-indigo-500 text-white" : p.dark ? "bg-stone-800 text-white" : "bg-stone-100"
                  }`}
                >
                  <p className={`text-sm font-semibold ${p.dark || p.featured ? "text-white/80" : "text-stone-500"}`}>
                    {p.name}
                  </p>
                  <p className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight">{p.price}</span>
                    <span className={`text-sm ${p.dark || p.featured ? "text-white/70" : "text-stone-500"}`}>
                      {p.period}
                    </span>
                  </p>
                </div>

                <p className={`text-sm ${p.dark ? "text-stone-300" : "text-stone-500"}`}>{p.desc}</p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          p.featured ? "text-indigo-500" : p.dark ? "text-teal-300" : "text-teal-500"
                        }`}
                      />
                      <span className={p.dark ? "text-stone-200" : "text-stone-600"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`sweep mt-6 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                    p.featured
                      ? "bg-indigo-500 text-white hover:bg-indigo-600"
                      : p.dark
                        ? "bg-white text-stone-900 hover:bg-stone-100"
                        : "bg-stone-900 text-white hover:bg-stone-800"
                  }`}
                >
                  เริ่มต้นฟรี
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">
        <Reveal>
          <div className="sweep relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-900 to-indigo-950 px-6 py-12 text-center sm:px-12 sm:py-16">
            <span className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-indigo-500/30 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-16 left-0 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl" />
            <h2 className="relative text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              พร้อมบริหารที่พักให้ง่ายขึ้นหรือยัง?
            </h2>
            <p className="relative mt-3 text-sm text-stone-300 sm:text-base">
              เริ่มใช้งาน HostGate วันนี้ ไม่ต้องใช้บัตรเครดิต
            </p>
            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="sweep inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
              >
                เริ่มใช้งาน <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-stone-400 sm:flex-row">
          <span>© 2026 HostGate</span>
          <Link href="/labs" className="transition hover:text-stone-600">
            ← กลับไป Design Lab
          </Link>
        </div>
      </footer>

      <style>{`
        @keyframes v3bIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .v3b-in { animation: v3bIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }

        @keyframes v3bChip {
          0%, 32% { background-color: #fecaca; }
          33%, 65% { background-color: #fde68a; }
          66%, 100% { background-color: #99f6e4; }
        }
        .v3b-chip { background-color: #fecaca; animation: v3bChip 6s steps(1) infinite; }

        @media (prefers-reduced-motion: reduce) {
          .v3b-in, .v3b-chip, .float, .marquee, .tilt {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
