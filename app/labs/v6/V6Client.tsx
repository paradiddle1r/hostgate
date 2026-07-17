"use client";

import Link from "next/link";
import { Outfit, IBM_Plex_Sans_Thai } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import {
  CalendarRange,
  Share2,
  ReceiptText,
  Sparkles,
  BedDouble,
  LineChart,
  ArrowRight,
  Check,
} from "lucide-react";
import IPhoneFrame from "@/components/IPhoneFrame";
import AnimatedMobile from "@/components/AnimatedMobile";

/**
 * V6 · Motion — a motion-forward landing sample. Everything animates:
 * a drifting aurora + parallax dot-grid backdrop, a headline that reveals
 * word-by-word blur-to-sharp, count-up KPI numbers that fire on scroll,
 * floating glass cards, a looping live-booking feed, an animated occupancy
 * ring, scroll-reveal sections, and a magnetic sheen CTA. All CSS/JS — no
 * animation libraries — and fully degraded under prefers-reduced-motion.
 */
const display = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const thai = IBM_Plex_Sans_Thai({ subsets: ["latin", "thai"], weight: ["300", "400", "500", "600", "700"] });

/* Split into grapheme clusters so Thai vowels/tone marks stay attached to
   their base consonant (a plain .split("") separates the combining marks and
   the text renders broken). */
function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return Array.from(new Seg("th", { granularity: "grapheme" }).segment(s), (x) => x.segment);
  return Array.from(s);
}

/* ── count-up that fires once when scrolled into view ───────────────────── */
function useCountUp(target: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !done.current) {
          done.current = true;
          const dur = 1500;
          const t0 = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(target * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  return { ref, val };
}

function Stat({ value, decimals = 0, prefix = "", suffix = "", label }: { value: number; decimals?: number; prefix?: string; suffix?: string; label: string }) {
  const { ref, val } = useCountUp(value);
  const shown = decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString();
  return (
    <div className="text-center">
      <div className={`${display.className} text-4xl font-bold tracking-tight text-white sm:text-5xl`}>
        <span ref={ref} className="tabular-nums">
          {prefix}
          {shown}
        </span>
        {suffix}
      </div>
      <div className="mt-1.5 text-xs uppercase tracking-[0.2em] text-white/40">{label}</div>
    </div>
  );
}

/* ── scroll reveal (self-contained; /labs bypasses ScrollFX) ────────────── */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVis(true);
      return;
    }
    const io = new IntersectionObserver(
      (e) => e[0].isIntersecting && setVis(true),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`hg6-reveal ${vis ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── animated occupancy ring ─────────────────────────────────────────────── */
function OccupancyRing() {
  const ref = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPct(87);
      return;
    }
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setPct(87), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div ref={ref} className="relative h-[92px] w-[92px]">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke="url(#hg6ring)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <defs>
          <linearGradient id="hg6ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a855f7" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className={`${display.className} text-lg font-bold text-white`}>{pct}%</span>
      </div>
    </div>
  );
}

/* ── looping live booking feed ───────────────────────────────────────────── */
const FEED = [
  { n: "K. Anan", r: "201", amt: "฿8,970", c: "#a855f7" },
  { n: "J. Smith", r: "305", amt: "฿5,120", c: "#22d3ee" },
  { n: "M. García", r: "108", amt: "฿6,400", c: "#f472b6" },
  { n: "พิมพ์ ล.", r: "402", amt: "฿12,300", c: "#818cf8" },
];
function LiveFeed() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((v) => (v + 1) % FEED.length), 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hg6-glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">การจองเข้ามาสด</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
          <span className="hg6-pulse relative flex h-1.5 w-1.5 rounded-full bg-emerald-400" /> live
        </span>
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((row) => {
          const item = FEED[(i + row) % FEED.length];
          return (
            <div
              key={`${item.n}-${row}`}
              className="hg6-feedrow flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2"
              style={{ opacity: row === 0 ? 1 : 0.55 - row * 0.12 }}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: item.c }}>
                {item.n[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-white">{item.n}</span>
                <span className="block text-[10px] text-white/45">ห้อง {item.r}</span>
              </span>
              <span className={`${display.className} text-xs font-semibold tabular-nums text-white`}>{item.amt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: CalendarRange, name: "ปฏิทินการจองแบบลาก-วาง", desc: "จัดการห้องทั้งเดือนในหน้าเดียว ลากบล็อกเพื่อย้าย เปลี่ยนวันได้ทันที" },
  { icon: Share2, name: "Channel Manager", desc: "ซิงก์ห้องว่างและราคากับ Booking.com / Agoda อัตโนมัติ ไม่ต้องอัปเดตทีละแพลตฟอร์ม" },
  { icon: BedDouble, name: "ผู้เช่ารายเดือน + บิลค่าน้ำค่าไฟ", desc: "จดมิเตอร์ ออกบิล เก็บค่าเช่า และสัญญาเช่า ครบในระบบเดียว" },
  { icon: Sparkles, name: "AI ตอบแชทแขก", desc: "ผู้ช่วย AI ตอบคำถาม เช็กห้องว่าง และเปิดจองให้แขกตลอด 24 ชั่วโมง" },
  { icon: ReceiptText, name: "ใบกำกับภาษี / ใบเสร็จ", desc: "ออกเอกสารบัญชีถูกต้องตามกฎหมายไทย พิมพ์หรือส่งอีเมลได้ทันที" },
  { icon: LineChart, name: "รายงานรายได้ Real-time", desc: "Occupancy, ADR, RevPAR อัปเดตสดทุกวินาที ดูแนวโน้มได้ทุกช่วงเวลา" },
];

const PLANS = [
  { name: "Free", price: "฿0", per: "/เดือน", feats: ["1 ที่พัก", "สูงสุด 10 ห้อง", "ปฏิทินการจอง", "รายงานพื้นฐาน"], cta: "เริ่มต้นฟรี", featured: false },
  { name: "Standard", price: "฿990", per: "/เดือน", feats: ["ห้องไม่จำกัด", "ผู้เช่ารายเดือน + บิล", "งานแม่บ้าน", "ใบกำกับภาษี / ใบเสร็จ", "AI ตอบแชท"], cta: "เริ่มต้นฟรี", featured: true },
  { name: "Pro", price: "฿2,490", per: "/เดือน", feats: ["ทุกอย่างใน Standard", "หลายที่พัก (Multi-property)", "Channel Manager", "ระบบจองตรงผ่านเว็บ"], cta: "เริ่มต้นฟรี", featured: false },
];

const TRUSTED = ["PhuketPool", "Pattaya Suites", "SukhumvitStay", "HuaHin Bay", "Krabi Cliff", "BangkokInn"];

export default function V6Client() {
  return (
    <main className={`${thai.className} relative min-h-screen overflow-x-clip bg-[#070711] text-white`}>
      {/* ── animated backdrop ───────────────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="hg6-aurora hg6-a1" />
        <div className="hg6-aurora hg6-a2" />
        <div className="hg6-aurora hg6-a3" />
        <div className="hg6-grid" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,transparent,#070711_75%)]" />
      </div>

      <div className="relative z-10">
        {/* ── navbar ────────────────────────────────────────────────────── */}
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className={`${display.className} text-lg font-bold tracking-tight`}>
            Host<span className="text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#a855f7,#22d3ee)", WebkitBackgroundClip: "text", backgroundClip: "text" }}>Gate</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm sm:gap-6">
            <Link href="/labs" className="text-white/50 transition hover:text-white">← Design Lab</Link>
            <Link href="/signup" className="hg6-sheen rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#070711] transition hover:shadow-[0_8px_30px_-8px_rgba(168,85,247,0.6)]">
              เริ่มต้นฟรี
            </Link>
          </nav>
        </header>

        {/* ── hero ──────────────────────────────────────────────────────── */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-28 lg:pt-20">
          <div>
            <div className="hg6-fade inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70 backdrop-blur" style={{ animationDelay: "0.05s" }}>
              <span className="hg6-pulse relative flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              เปิดให้ใช้งานแล้ว
            </div>

            <h1 className={`${display.className} mt-5 text-[2.7rem] font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.2rem]`}>
              <span className="block">
                {graphemes("ที่พักของคุณ").map((ch, k) => (
                  <span key={k} className="hg6-word" style={{ animationDelay: `${0.15 + k * 0.06}s` }}>{ch}</span>
                ))}
              </span>
              <span
                className="hg6-word block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent"
                style={{ animationDelay: "0.85s" }}
              >
                บริหารง่ายขึ้น
              </span>
            </h1>

            <p className="hg6-fade mt-5 max-w-md text-base leading-relaxed text-white/55 sm:text-lg" style={{ animationDelay: "1.15s" }}>
              ระบบจัดการห้องพัก สำหรับโรงแรมและอพาร์ตเมนต์ ออกแบบใหม่ตั้งแต่ต้น — เห็นทุกอย่างเคลื่อนไหวแบบเรียลไทม์
            </p>

            <div className="hg6-fade mt-8 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "1.3s" }}>
              <Link href="/signup" className="hg6-sheen group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#070711] transition hover:shadow-[0_12px_40px_-10px_rgba(168,85,247,0.7)]">
                เริ่มใช้งาน
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="#" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-sm font-medium text-white/80 transition hover:border-white/30 hover:text-white">
                ดู Demo
              </Link>
            </div>
            <p className="hg6-fade mt-4 text-xs text-white/35" style={{ animationDelay: "1.4s" }}>ไม่ต้องใช้บัตรเครดิต · เดือนแรกฟรีทุกแผน</p>
          </div>

          {/* hero visual — phone + floating glass cards */}
          <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <div className="hg6-fade relative mx-auto w-[230px]" style={{ animationDelay: "0.5s" }}>
              <div className="hg6-float">
                <IPhoneFrame>
                  <AnimatedMobile />
                </IPhoneFrame>
              </div>
            </div>

            {/* floating KPI card — top left (fade on outer, float on inner so
                the two animations don't fight over the `animation` property) */}
            <div className="hg6-fade absolute -left-2 top-4 hidden sm:block" style={{ animationDelay: "0.9s" }}>
              <div className="hg6-floatb">
                <div className="hg6-glass w-[150px] rounded-2xl p-3.5">
                  <div className="flex items-center gap-3">
                    <OccupancyRing />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/45">Occupancy</div>
                      <div className="text-[11px] text-white/60">วันนี้</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* floating revenue card — bottom right */}
            <div className="hg6-fade absolute -right-2 bottom-8 hidden sm:block" style={{ animationDelay: "1.1s" }}>
              <div className="hg6-floatc">
                <div className="hg6-glass w-[168px] rounded-2xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-white/45">รายได้วันนี้</div>
                  <div className={`${display.className} mt-1 text-2xl font-bold tabular-nums`}>
                    ฿<HeroRevenue />
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] text-emerald-300">▲ +18%</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── live metrics band ─────────────────────────────────────────── */}
        <section className="border-y border-white/5 bg-white/[0.015]">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-5 py-12 sm:px-8 md:grid-cols-4">
            <Stat value={42} suffix="+" label="ห้องต่อที่พัก" />
            <Stat value={10000} suffix="+" label="คืนการจอง" />
            <Stat value={120} suffix="+" label="ที่พักใช้งาน" />
            <Stat value={99.9} decimals={1} suffix="%" label="uptime" />
          </div>
        </section>

        {/* ── features ──────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">Features</p>
            <h2 className={`${display.className} mt-3 text-3xl font-bold tracking-tight sm:text-4xl`}>ทุกอย่างที่โรงแรมของคุณต้องการ</h2>
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, k) => {
              const Icon = f.icon;
              return (
                <Reveal key={f.name} delay={(k % 3) * 90}>
                  <div className="hg6-card hg6-glass group h-full rounded-2xl p-6">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500/25 to-cyan-500/25 text-violet-200 ring-1 ring-white/10 transition group-hover:from-violet-500/40 group-hover:to-cyan-500/40">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-white">{f.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">{f.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* ── live feed showcase ────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Real-time</p>
              <h2 className={`${display.className} mt-3 text-3xl font-bold tracking-tight sm:text-4xl`}>
                เห็นการจองเข้ามา<br />
                <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">ทันทีที่เกิดขึ้น</span>
              </h2>
              <p className="mt-4 max-w-md text-white/55">
                ทุกการจองจาก Booking.com, Agoda, เว็บจองตรง และ AI แชท เด้งเข้ามาในระบบเดียว
                พร้อมยอดรายได้ที่อัปเดตสดทันที
              </p>
              <ul className="mt-6 space-y-2.5">
                {["ซิงก์ทุกช่องทางอัตโนมัติ", "แจ้งเตือนทันทีเมื่อมีจองใหม่", "ยอดรายได้อัปเดตแบบเรียลไทม์"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-sm text-white/70">
                    <Check className="h-4 w-4 text-cyan-300" /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120} className="mx-auto w-full max-w-sm">
              <LiveFeed />
            </Reveal>
          </div>
        </section>

        {/* ── social proof ──────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
          <Reveal className="text-center text-xs uppercase tracking-[0.3em] text-white/35">ที่พักที่ไว้วางใจ HostGate</Reveal>
          <Reveal delay={80} className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {TRUSTED.map((n) => (
              <span key={n} className={`${display.className} text-lg font-semibold text-white/30 transition hover:text-white/60`}>{n}</span>
            ))}
          </Reveal>
        </section>

        {/* ── pricing ───────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">Pricing</p>
            <h2 className={`${display.className} mt-3 text-3xl font-bold tracking-tight sm:text-4xl`}>ราคาที่โปร่งใส เริ่มต้นฟรี</h2>
            <p className="mt-3 text-white/45">เดือนแรกฟรีทุกแผน ยกเลิกได้ทุกเมื่อ</p>
          </Reveal>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {PLANS.map((p, k) => (
              <Reveal key={p.name} delay={k * 100}>
                <div
                  className={`hg6-card relative h-full rounded-3xl p-7 ${
                    p.featured
                      ? "hg6-glow bg-white/[0.05] ring-1 ring-violet-400/40"
                      : "hg6-glass"
                  }`}
                >
                  {p.featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-3 py-1 text-[11px] font-semibold text-white">
                      แนะนำ
                    </span>
                  )}
                  <div className="text-sm font-semibold text-white/80">{p.name}</div>
                  <div className="mt-3 flex items-end gap-1">
                    <span className={`${display.className} text-4xl font-bold`}>{p.price}</span>
                    <span className="pb-1 text-sm text-white/40">{p.per}</span>
                  </div>
                  <ul className="mt-6 space-y-2.5">
                    {p.feats.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-white/65">
                        <Check className="h-4 w-4 shrink-0 text-cyan-300" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={`hg6-sheen mt-7 block rounded-full py-3 text-center text-sm font-semibold transition ${
                      p.featured
                        ? "bg-white text-[#070711] hover:shadow-[0_10px_36px_-8px_rgba(168,85,247,0.7)]"
                        : "border border-white/15 text-white hover:border-white/30"
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── final CTA ─────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
          <Reveal>
            <div className="hg6-glass relative overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12">
              <div aria-hidden className="hg6-aurora hg6-a1 !opacity-40" style={{ inset: "auto", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }} />
              <div className="relative">
                <h2 className={`${display.className} text-3xl font-bold tracking-tight sm:text-4xl`}>พร้อมบริหารที่พักให้ง่ายขึ้นหรือยัง?</h2>
                <p className="mx-auto mt-3 max-w-md text-white/55">สมัครใช้งานวันนี้ ไม่ต้องใช้บัตรเครดิต เริ่มต้นฟรีได้ทันที</p>
                <Link href="/signup" className="hg6-sheen group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#070711] transition hover:shadow-[0_12px_40px_-10px_rgba(168,85,247,0.7)]">
                  เริ่มใช้งาน <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── footer ────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/5 py-8 text-center text-sm text-white/35">
          © 2026 HostGate ·{" "}
          <Link href="/labs" className="underline underline-offset-4 hover:text-white/60">Design Lab</Link>
        </footer>
      </div>

      {/* ── keyframes / motion ──────────────────────────────────────────── */}
      <style jsx global>{`
        .hg6-word {
          display: inline-block;
          opacity: 0;
          filter: blur(14px);
          transform: translateY(0.25em);
          animation: hg6-blurin 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          white-space: pre;
        }
        @keyframes hg6-blurin {
          to { opacity: 1; filter: blur(0); transform: translateY(0); }
        }
        .hg6-fade { opacity: 0; animation: hg6-fadeup 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        @keyframes hg6-fadeup {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hg6-reveal { opacity: 0; transform: translateY(26px); transition: opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1); }
        .hg6-reveal.is-in { opacity: 1; transform: none; }
        .hg6-glass {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.09);
          -webkit-backdrop-filter: blur(16px) saturate(1.2);
          backdrop-filter: blur(16px) saturate(1.2);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 24px 60px -30px rgba(0, 0, 0, 0.7);
        }
        .hg6-card { transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), border-color 0.4s, box-shadow 0.4s; }
        .hg6-card:hover { transform: translateY(-4px); border-color: rgba(168,85,247,0.35); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 70px -30px rgba(168,85,247,0.4); }
        .hg6-glow { box-shadow: 0 30px 90px -40px rgba(168, 85, 247, 0.7), inset 0 1px 0 rgba(255,255,255,0.08); }
        .hg6-pulse::before {
          content: ""; position: absolute; inset: 0; border-radius: 9999px;
          background: inherit; animation: hg6-ping 1.8s cubic-bezier(0,0,0.2,1) infinite;
        }
        @keyframes hg6-ping { 0% { transform: scale(1); opacity: 0.8; } 75%,100% { transform: scale(2.6); opacity: 0; } }
        .hg6-float { animation: hg6-float 6s ease-in-out infinite; }
        .hg6-floatb { animation: hg6-float 7s ease-in-out infinite; }
        .hg6-floatc { animation: hg6-float 8s ease-in-out infinite 0.6s; }
        @keyframes hg6-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        .hg6-sheen { position: relative; overflow: hidden; }
        .hg6-sheen::after {
          content: ""; position: absolute; top: 0; bottom: 0; left: -80%; width: 55%;
          background: linear-gradient(105deg, transparent, rgba(255,255,255,0.45), transparent);
          transform: skewX(-18deg); transition: left 0.7s cubic-bezier(0.22,1,0.36,1); pointer-events: none;
        }
        .hg6-sheen:hover::after { left: 130%; }
        /* backdrop */
        .hg6-aurora { position: absolute; width: 46vw; height: 46vw; border-radius: 9999px; filter: blur(90px); opacity: 0.55; will-change: transform; }
        .hg6-a1 { top: -12vw; left: -6vw; background: radial-gradient(circle, rgba(168,85,247,0.9), transparent 62%); animation: hg6-drift1 22s ease-in-out infinite; }
        .hg6-a2 { top: 8vw; right: -10vw; background: radial-gradient(circle, rgba(34,211,238,0.7), transparent 62%); animation: hg6-drift2 26s ease-in-out infinite; }
        .hg6-a3 { bottom: -14vw; left: 24vw; background: radial-gradient(circle, rgba(236,72,153,0.55), transparent 62%); animation: hg6-drift3 30s ease-in-out infinite; }
        @keyframes hg6-drift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6vw,4vw) scale(1.15); } }
        @keyframes hg6-drift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5vw,6vw) scale(1.1); } }
        @keyframes hg6-drift3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(4vw,-5vw) scale(1.2); } }
        .hg6-grid {
          position: absolute; inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px);
          background-size: 34px 34px;
          -webkit-mask-image: radial-gradient(80% 60% at 50% 20%, black, transparent 75%);
          mask-image: radial-gradient(80% 60% at 50% 20%, black, transparent 75%);
          animation: hg6-gridpan 24s linear infinite; opacity: 0.5;
        }
        @keyframes hg6-gridpan { from { background-position: 0 0; } to { background-position: 34px 34px; } }
        @media (prefers-reduced-motion: reduce) {
          .hg6-word, .hg6-fade { opacity: 1 !important; filter: none !important; transform: none !important; animation: none !important; }
          .hg6-reveal { opacity: 1 !important; transform: none !important; }
          .hg6-float, .hg6-floatb, .hg6-floatc, .hg6-aurora, .hg6-grid, .hg6-pulse::before { animation: none !important; }
        }
      `}</style>
    </main>
  );
}

/* hero revenue count-up (uses same easing, loops a gentle live tick after) */
function HeroRevenue() {
  const { ref, val } = useCountUp(42890);
  const [live, setLive] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setLive((v) => v + Math.floor(Math.random() * 180)), 2600);
    return () => clearInterval(id);
  }, []);
  return <span ref={ref} className="tabular-nums">{(Math.round(val) + live).toLocaleString()}</span>;
}
