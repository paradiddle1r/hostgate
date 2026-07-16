import Link from "next/link";
import type { Metadata } from "next";
import { Sora, IBM_Plex_Sans_Thai } from "next/font/google";
import {
  CalendarRange,
  Globe2,
  Receipt,
  Sparkles,
  BedDouble,
  BarChart3,
  ArrowRight,
  Check,
  ShieldCheck,
} from "lucide-react";
import StudioDisplay from "@/components/StudioDisplay";
import AnimatedDashboard from "@/components/AnimatedDashboard";
import IPhoneFrame from "@/components/IPhoneFrame";
import AnimatedMobile from "@/components/AnimatedMobile";

export const metadata: Metadata = {
  title: "V2 · Glow — HostGate Design Lab",
  robots: { index: false, follow: false },
};

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--v2-display",
});

const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--v2-thai",
});

const FEATURES = [
  {
    icon: CalendarRange,
    title: "ปฏิทินการจองแบบลาก-วาง",
    desc: "ย้ายห้อง เลื่อนวันเข้าพัก จัดการโอเวอร์บุ๊กกิ้ง ได้ในคลิกเดียว เห็นภาพรวมทั้งเดือนแบบเรียลไทม์",
  },
  {
    icon: Globe2,
    title: "Channel Manager",
    desc: "ซิงค์ห้องว่างและราคากับ Booking.com, Agoda อัตโนมัติ ไม่ต้องอัปเดตทีละแพลตฟอร์ม",
  },
  {
    icon: BedDouble,
    title: "ผู้เช่ารายเดือน + บิลค่าน้ำค่าไฟ",
    desc: "จัดการสัญญาเช่า มิเตอร์น้ำไฟ ออกบิลรายเดือนอัตโนมัติ พร้อมประวัติการชำระ",
  },
  {
    icon: Sparkles,
    title: "งานแม่บ้าน",
    desc: "คิวทำความสะอาดอัปเดตอัตโนมัติเมื่อแขกเช็คเอาต์ ติดตามสถานะห้องได้แบบเรียลไทม์",
  },
  {
    icon: Receipt,
    title: "ใบกำกับภาษี / ใบเสร็จ",
    desc: "ออกเอกสารบัญชีถูกต้องตามกฎหมายไทย พิมพ์หรือส่งอีเมลได้ทันทีจากหน้าจอง",
  },
  {
    icon: BarChart3,
    title: "รายงานรายได้ Real-time",
    desc: "Occupancy, ADR, RevPAR อัปเดตสดทุกวินาที ตัดสินใจเรื่องราคาได้เร็วกว่าคู่แข่ง",
  },
];

const STATS = [
  { v: "42", u: "ห้อง+", label: "ต่อทรัพย์สิน" },
  { v: "10,000", u: "+", label: "คืนของแขกต่อปี" },
  { v: "120", u: "+", label: "ที่พักที่ใช้งานอยู่" },
  { v: "99.9", u: "%", label: "Uptime" },
];

const TRUSTED = ["PhuketPool", "Pattaya Suites", "SukhumvitStay", "HuaHin Bay", "Krabi Cliff", "BangkokInn"];

const PLANS = [
  {
    name: "Free",
    price: "฿0",
    period: "/เดือน",
    desc: "ทดลองใช้งานฟรี ไม่มีวันหมดอายุ",
    features: ["1 ที่พัก", "สูงสุด 10 ห้อง", "ปฏิทินการจอง", "รายงานพื้นฐาน"],
    featured: false,
  },
  {
    name: "Standard",
    price: "฿990",
    period: "/เดือน",
    desc: "สำหรับโรงแรมและอพาร์ตเมนต์ที่กำลังเติบโต",
    features: ["ห้องไม่จำกัด", "ผู้เช่ารายเดือน + บิล", "งานแม่บ้าน", "ใบกำกับภาษี/ใบเสร็จ", "เดือนแรกฟรี"],
    featured: true,
  },
  {
    name: "Pro",
    price: "฿2,490",
    period: "/เดือน",
    desc: "จัดการหลายที่พักพร้อม Channel Manager เต็มรูปแบบ",
    features: ["หลายที่พักในบัญชีเดียว", "Channel Manager", "Booking engine บนเว็บ", "AI ตอบแชทแขก", "เดือนแรกฟรี"],
    featured: false,
  },
];

export default function LabsV2() {
  return (
    <main
      className={`${sora.variable} ${plexThai.variable} relative min-h-screen overflow-x-clip bg-[#09090b] text-zinc-100`}
      style={{ fontFamily: "var(--v2-thai), var(--v2-display), system-ui, sans-serif" }}
    >
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="relative z-20 border-b border-white/10 bg-[#09090b]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-cyan-400 text-[13px] font-bold text-zinc-950" style={{ fontFamily: "var(--v2-display)" }}>
              H
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-zinc-50" style={{ fontFamily: "var(--v2-display)" }}>
              HostGate
            </span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/labs"
              className="hidden text-sm text-zinc-400 transition hover:text-zinc-100 sm:inline"
            >
              ← Design Lab
            </Link>
            <Link
              href="/signup"
              className="sweep rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition hover:bg-zinc-200"
            >
              เริ่มต้นฟรี
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative z-10 overflow-hidden px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
        {/* ambient glow — scoped to this section (not fixed) so the blurred
            layer never has to repaint across the full page height on scroll */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="v2-blob v2-blob-a absolute left-[6%] top-[-14%] h-[440px] w-[440px] rounded-full bg-indigo-500/25 blur-[100px]" />
          <div className="v2-blob v2-blob-b absolute right-[2%] top-[-4%] h-[400px] w-[400px] rounded-full bg-cyan-400/20 blur-[105px]" />
        </div>

        {/* grid pattern, masked radially so it fades at the edges */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[720px]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 60% 55% at 50% 20%, black 10%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 55% at 50% 20%, black 10%, transparent 75%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="hero-anim inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[13px] text-zinc-300 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            เปิดให้ใช้งานแล้ว
          </div>

          <h1
            className="hero-anim mt-6 text-[2.6rem] font-bold leading-[1.08] tracking-tight sm:text-6xl"
            style={{ fontFamily: "var(--v2-display)", animationDelay: "0.08s" }}
          >
            <span className="block text-zinc-50">ที่พักของคุณ.</span>
            <span className="v2-glow-text relative inline-block bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
              บริหารง่ายขึ้น.
            </span>
          </h1>

          <p className="hero-anim mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-zinc-400 sm:text-lg" style={{ animationDelay: "0.16s" }}>
            ระบบจัดการห้องพัก สำหรับโรงแรมและอพาร์ตเมนต์ ออกแบบใหม่ตั้งแต่ต้น
          </p>

          <div className="hero-anim mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "0.24s" }}>
            <Link
              href="/signup"
              className="sweep group flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-zinc-950 shadow-[0_8px_30px_-8px_rgba(255,255,255,0.35)] transition hover:bg-zinc-200"
            >
              เริ่มใช้งาน
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/labs"
              className="rounded-full border border-white/15 px-6 py-3 text-[15px] font-medium text-zinc-200 transition hover:border-white/30 hover:bg-white/5"
            >
              ดู Demo
            </Link>
          </div>
          <p className="hero-anim mt-4 text-[13px] text-zinc-500" style={{ animationDelay: "0.3s" }}>
            ไม่ต้องใช้บัตรเครดิต
          </p>
        </div>

        {/* Hero visual — StudioDisplay center-stage, iPhone tucked beside it */}
        <div className="hero-anim relative z-10 mx-auto mt-16 max-w-5xl" style={{ animationDelay: "0.36s" }}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 55% 60% at 50% 35%, rgba(99,102,241,0.28), transparent 70%)",
            }}
          />
          <div className="flex items-end justify-center gap-4 sm:gap-8">
            <div className="tilt float w-full max-w-[720px]">
              <StudioDisplay>
                <AnimatedDashboard />
              </StudioDisplay>
            </div>
            <div className="tilt float mb-2 hidden w-[130px] shrink-0 md:block" style={{ animationDelay: "1.2s" }}>
              <IPhoneFrame>
                <AnimatedMobile />
              </IPhoneFrame>
            </div>
          </div>
          {/* reflection */}
          <div
            aria-hidden
            className="mx-auto mt-2 h-24 max-w-[640px] scale-y-[-1]"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.06), transparent 70%)",
              maskImage: "linear-gradient(to bottom, black, transparent 80%)",
              WebkitMaskImage: "linear-gradient(to bottom, black, transparent 80%)",
              filter: "blur(2px)",
            }}
          />
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────── */}
      <section className="relative z-10 border-y border-white/10 bg-white/[0.02] px-5 py-10 sm:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl" style={{ fontFamily: "var(--v2-display)" }}>
                {s.v}
                <span className="text-xl sm:text-2xl">{s.u}</span>
              </div>
              <div className="mt-1 text-[13px] text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="relative z-10 overflow-hidden px-5 py-20 sm:px-8 sm:py-28">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="v2-blob v2-blob-c absolute right-[10%] top-[10%] h-[420px] w-[420px] rounded-full bg-violet-500/15 blur-[110px]" />
        </div>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-[13px] font-semibold uppercase tracking-[0.25em] text-indigo-400">Features</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl" style={{ fontFamily: "var(--v2-display)" }}>
              ทุกอย่างที่โรงแรมของคุณต้องการ
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-indigo-400/40 hover:bg-white/[0.06]"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-400/20 text-indigo-300 ring-1 ring-inset ring-white/10 transition group-hover:text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-zinc-50">{f.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Social proof ───────────────────────────────────────── */}
      <section className="relative z-10 border-t border-white/10 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-[13px] uppercase tracking-[0.25em] text-zinc-500">
            ที่พักที่ไว้วางใจ HostGate
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {TRUSTED.map((name) => (
              <span key={name} className="text-lg font-semibold tracking-tight text-zinc-600 transition hover:text-zinc-300" style={{ fontFamily: "var(--v2-display)" }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section className="relative z-10 overflow-hidden px-5 py-20 sm:px-8 sm:py-28">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="v2-blob v2-blob-a absolute bottom-[-8%] left-[8%] h-[420px] w-[420px] rounded-full bg-indigo-500/15 blur-[110px]" />
        </div>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-[13px] font-semibold uppercase tracking-[0.25em] text-indigo-400">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl" style={{ fontFamily: "var(--v2-display)" }}>
              ราคาที่โปร่งใส เริ่มต้นฟรี
            </h2>
            <p className="mt-3 text-[15px] text-zinc-400">เดือนแรกฟรีทุกแผน ยกเลิกได้ทุกเมื่อ</p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map((p) =>
              p.featured ? (
                <div key={p.name} className="relative rounded-2xl bg-gradient-to-b from-indigo-400/70 via-violet-400/60 to-cyan-400/70 p-px md:-translate-y-3">
                  <div className="flex h-full flex-col rounded-2xl bg-[#09090b] p-7">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-zinc-50">{p.name}</h3>
                      <span className="rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400 px-3 py-1 text-[11px] font-bold text-zinc-950">
                        แนะนำ
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-zinc-400">{p.desc}</p>
                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-4xl font-bold tracking-tight text-zinc-50" style={{ fontFamily: "var(--v2-thai), var(--v2-display)" }}>{p.price}</span>
                      <span className="text-sm text-zinc-500">{p.period}</span>
                    </div>
                    <ul className="mt-6 flex-1 space-y-3">
                      {p.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2 text-[14px] text-zinc-300">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                          {feat}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/signup"
                      className="sweep mt-7 flex items-center justify-center rounded-full bg-white py-2.5 text-[14px] font-semibold text-zinc-950 transition hover:bg-zinc-200"
                    >
                      เลือกแผนนี้
                    </Link>
                  </div>
                </div>
              ) : (
                <div key={p.name} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm transition hover:border-white/20">
                  <h3 className="text-lg font-semibold text-zinc-50">{p.name}</h3>
                  <p className="mt-1 text-[13px] text-zinc-400">{p.desc}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-zinc-50" style={{ fontFamily: "var(--v2-display)" }}>{p.price}</span>
                    <span className="text-sm text-zinc-500">{p.period}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3">
                    {p.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-[14px] text-zinc-300">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="mt-7 flex items-center justify-center rounded-full border border-white/15 py-2.5 text-[14px] font-medium text-zinc-200 transition hover:border-white/30 hover:bg-white/5"
                  >
                    เลือกแผนนี้
                  </Link>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────── */}
      <section className="relative z-10 px-5 py-20 sm:px-8 sm:py-28">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center backdrop-blur-sm sm:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 70% 80% at 50% 50%, rgba(99,102,241,0.35), transparent 70%)",
            }}
          />
          <ShieldCheck className="mx-auto h-8 w-8 text-cyan-300" />
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl" style={{ fontFamily: "var(--v2-display)" }}>
            พร้อมบริหารที่พักให้ง่ายขึ้นหรือยัง?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-zinc-400">
            สมัครใช้งานวันนี้ ไม่ต้องใช้บัตรเครดิต เริ่มต้นฟรีได้ทันที
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="sweep group flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-zinc-950 shadow-[0_8px_30px_-8px_rgba(255,255,255,0.35)] transition hover:bg-zinc-200"
            >
              เริ่มใช้งาน
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/labs"
              className="rounded-full border border-white/15 px-6 py-3 text-[15px] font-medium text-zinc-200 transition hover:border-white/30 hover:bg-white/5"
            >
              ดู Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/10 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-[13px] text-zinc-500 sm:flex-row">
          <span>© 2026 HostGate</span>
          <Link href="/labs" className="text-zinc-500 underline underline-offset-4 transition hover:text-zinc-300">
            ← Design Lab
          </Link>
        </div>
      </footer>

      <style>{`
        @keyframes v2-drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(4%, 6%) scale(1.08); }
        }
        @keyframes v2-drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-6%, 4%) scale(1.05); }
        }
        @keyframes v2-drift-c {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(3%, -5%) scale(1.1); }
        }
        .v2-blob-a { animation: v2-drift-a 20s ease-in-out infinite; }
        .v2-blob-b { animation: v2-drift-b 24s ease-in-out infinite; }
        .v2-blob-c { animation: v2-drift-c 26s ease-in-out infinite; }

        @keyframes v2-glow-sweep {
          0%, 100% { filter: drop-shadow(0 0 18px rgba(99,102,241,0.35)); }
          50% { filter: drop-shadow(0 0 26px rgba(34,211,238,0.4)); }
        }
        .v2-glow-text { animation: v2-glow-sweep 5s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .v2-blob-a, .v2-blob-b, .v2-blob-c, .v2-glow-text {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}
