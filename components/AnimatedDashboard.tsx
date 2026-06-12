"use client";

import { useEffect, useState } from "react";
import { usePauseWhenHidden } from "@/lib/useReveal";

/**
 * Animated PMS mockup rendered in the REAL hotel-pms "liquid light" theme —
 * soft blue canvas (#eaf1fb), frosted-white surfaces, Apple-blue accent
 * (#0a84ff) and pill-shaped frosted booking bars — so the marketing preview
 * matches what customers actually run. Tokens come from `.pms-ll` in
 * globals.css (mirrored from the product's calendar.css).
 *
 * Four scenes:
 *  0 — overview (occupancy / ADR / RevPAR KPIs ticking)
 *  1 — booking calendar (the flagship — frosted pill bars on a room×date grid)
 *  2 — booking + guest detail
 *  3 — channel sync
 *
 * `phase` locks the scene; otherwise it cycles every 4.5s. usePauseWhenHidden
 * + data-paused stop the cycle and CSS animations off-screen (mobile memory).
 */
export default function AnimatedDashboard({ phase }: { phase?: number }) {
  const [auto, setAuto] = useState(0);
  const { ref, active } = usePauseWhenHidden<HTMLDivElement>();

  useEffect(() => {
    if (phase !== undefined) return;
    if (!active) return;
    const id = setInterval(() => setAuto((p) => (p + 1) % 4), 4500);
    return () => clearInterval(id);
  }, [phase, active]);

  const p = phase ?? auto;

  const NAV = ["Calendar", "Bookings", "Guests", "Rentals", "Housekeeping", "Invoices", "Reports"];
  const navActive = (i: number) =>
    (p === 0 && i === 6) || (p === 1 && i === 0) || (p === 2 && i === 1) || (p === 3 && i === 0);

  return (
    <div
      ref={ref}
      data-paused={active ? undefined : "true"}
      className="pms-ll hg-anim-root relative flex h-full w-full overflow-hidden"
    >
      <div className="pms-ll-mesh" aria-hidden />

      {/* Sidebar */}
      <aside className="pms-ll-surface relative z-10 hidden w-[150px] flex-none px-3 py-4 md:block">
        <div className="mb-5 flex items-center gap-2 px-1">
          <div className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--ll-accent)] text-white">
            <HotelGlyph />
          </div>
          <span className="text-[11px] font-bold tracking-tight">HostGate</span>
        </div>
        {NAV.map((item, i) => {
          const on = navActive(i);
          return (
            <div
              key={item}
              className="mb-0.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors duration-500"
              style={
                on
                  ? { background: "var(--ll-accent-soft)", color: "var(--ll-accent)" }
                  : { color: "var(--ll-muted)" }
              }
            >
              <span
                className="grid h-4 w-4 place-items-center rounded-[5px]"
                style={{ background: on ? "var(--ll-accent)" : "rgba(71,85,105,0.12)" }}
              >
                <span className="h-1 w-1 rounded-full" style={{ background: on ? "#fff" : "var(--ll-faint)" }} />
              </span>
              {item}
            </div>
          );
        })}
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--ll-border)" }}>
          <div className="flex items-center gap-2 px-1">
            <div className="grid h-6 w-6 place-items-center rounded-full bg-[var(--ll-accent)] text-[9px] font-bold text-white">
              N
            </div>
            <div className="leading-tight">
              <div className="text-[9px] font-semibold">Nida P.</div>
              <div className="text-[8px]" style={{ color: "var(--ll-faint)" }}>admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <Scene visible={p === 0}><OverviewScene active={active && p === 0} /></Scene>
        <Scene visible={p === 1}><CalendarScene /></Scene>
        <Scene visible={p === 2}><BookingScene /></Scene>
        <Scene visible={p === 3}><ChannelsScene /></Scene>
      </div>
    </div>
  );
}

function HotelGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V5a1 1 0 011-1h8a1 1 0 011 1v16M15 9h3a1 1 0 011 1v11M9 8h.01M9 12h.01" />
    </svg>
  );
}

function Scene({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 p-3.5 transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
      }`}
    >
      {children}
    </div>
  );
}

const card = "pms-ll-surface rounded-xl";

/* ── Scene 0 — Overview ──────────────────────────────────────── */
function OverviewScene({ active = true }: { active?: boolean }) {
  const [revenue, setRevenue] = useState(42800);
  const [occ, setOcc] = useState(87);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setRevenue((r) => r + Math.floor(Math.random() * 250));
      setOcc((o) => Math.min(99, o + (Math.random() > 0.5 ? 1 : 0)));
    }, 1200);
    return () => clearInterval(id);
  }, [active]);

  return (
    <>
      <SceneHead title="ภาพรวมวันนี้" sub="Today" live />
      <div className="grid grid-cols-4 gap-2">
        {[
          { l: "Occupancy", v: `${occ}%` },
          { l: "ADR", v: "฿2,490" },
          { l: "RevPAR", v: "฿2,166" },
          { l: "รายได้วันนี้", v: `฿${revenue.toLocaleString()}` },
        ].map((k) => (
          <div key={k.l} className={`${card} p-2`}>
            <div className="text-[8px] uppercase tracking-wide" style={{ color: "var(--ll-faint)" }}>{k.l}</div>
            <div className="mt-0.5 text-[13px] font-bold tracking-tight tabular-nums">{k.v}</div>
            <div className="mt-0.5 text-[8px] font-medium" style={{ color: "var(--ll-accent)" }}>▲ live</div>
          </div>
        ))}
      </div>

      <div className={`${card} mt-3 p-2.5`}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold">Revenue · this month</span>
          <span className="text-[9px] font-medium" style={{ color: "var(--ll-accent)" }}>+18.4%</span>
        </div>
        <AnimatedChart />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className={`${card} p-2.5`}>
          <div className="mb-1.5 text-[10px] font-semibold">เข้าพักวันนี้</div>
          {[["K. Anan", 201], ["J. Smith", 305], ["C. Lee", 108]].map(([n, r], i) => (
            <div
              key={n as string}
              className="mb-1 flex items-center justify-between rounded-md px-1.5 py-1 text-[9px]"
              style={{ background: "var(--ll-surface-2)", animation: `slideInLeft 0.6s ease-out ${i * 0.15}s both` }}
            >
              <span className="font-medium">{n}</span>
              <span style={{ color: "var(--ll-muted)" }}>#{r}</span>
            </div>
          ))}
        </div>
        <div className={`${card} p-2.5`}>
          <div className="mb-1.5 text-[10px] font-semibold">ช่องทาง</div>
          {["Booking", "Agoda", "Airbnb"].map((c, i) => (
            <div key={c} className="mb-1 flex items-center justify-between text-[9px]">
              <span>{c}</span>
              <span className="flex items-center gap-1" style={{ color: "var(--ll-accent)" }}>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--ll-accent)", animationDelay: `${i * 0.3}s` }} />
                synced
              </span>
            </div>
          ))}
        </div>
      </div>
      <Keyframes />
    </>
  );
}

function AnimatedChart() {
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-12 w-full">
      <defs>
        <linearGradient id="ll-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a84ff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#0a84ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points="0,22 8,18 16,20 24,14 32,16 40,9 48,11 56,6 64,8 72,4 80,6 88,3 96,5"
        fill="none" stroke="#0a84ff" strokeWidth="1" strokeLinecap="round"
        strokeDasharray="200" strokeDashoffset="200"
        style={{ animation: "drawLine 2s ease-out forwards" }}
      />
      <polygon
        points="0,22 8,18 16,20 24,14 32,16 40,9 48,11 56,6 64,8 72,4 80,6 88,3 96,5 96,28 0,28"
        fill="url(#ll-grad)" opacity="0"
        style={{ animation: "fadeIn 2s ease-out 1s forwards" }}
      />
      <style>{`@keyframes drawLine{to{stroke-dashoffset:0}}@keyframes fadeIn{to{opacity:1}}`}</style>
    </svg>
  );
}

/* ── Scene 1 — Calendar (flagship) ───────────────────────────── */
const DOW = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา", "จ", "อ", "พ", "พฤ", "ศ"];
const BAR = { blue: "#0a84ff", teal: "#30c8c0", violet: "#8b5cf6", amber: "#f59e0b", rose: "#fb7185" };
type BarKey = keyof typeof BAR;
// [startCol, endCol, colour] per room row (12-day window)
const ROWS: { room: string; bars: [number, number, BarKey][] }[] = [
  { room: "101", bars: [[0, 3, "blue"], [5, 8, "teal"]] },
  { room: "102", bars: [[1, 4, "violet"], [6, 10, "amber"]] },
  { room: "201", bars: [[0, 2, "teal"], [4, 7, "rose"]] },
  { room: "202", bars: [[2, 6, "blue"]] },
  { room: "301", bars: [[1, 5, "amber"], [7, 11, "teal"]] },
  { room: "302", bars: [[0, 3, "rose"], [6, 9, "blue"]] },
  { room: "401", bars: [[3, 8, "violet"]] },
];
const WIN = 12;
const TODAY = 4;

function CalendarScene() {
  return (
    <>
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight">ปฏิทินการจอง</h3>
          <p className="text-[9px]" style={{ color: "var(--ll-faint)" }}>20–31 พ.ค.</p>
        </div>
        <div className="flex items-center gap-1.5">
          {[["ว่าง", "28"], ["เข้า", "6"], ["ออก", "4"]].map(([l, v]) => (
            <span key={l} className="pms-ll-surface rounded-full px-2 py-0.5 text-[8px] font-medium" style={{ color: "var(--ll-muted)" }}>
              {l} <b style={{ color: "var(--ll-fg)" }}>{v}</b>
            </span>
          ))}
        </div>
      </div>

      <div className={`${card} overflow-hidden p-2.5`}>
        {/* date header */}
        <div className="grid items-end gap-[3px]" style={{ gridTemplateColumns: `26px repeat(${WIN}, 1fr)` }}>
          <div />
          {Array.from({ length: WIN }).map((_, i) => {
            const weekend = DOW[i] === "ส" || DOW[i] === "อา";
            const isToday = i === TODAY;
            return (
              <div
                key={i}
                className="rounded-md py-0.5 text-center"
                style={{ background: isToday ? "var(--ll-accent)" : weekend ? "var(--ll-wknd)" : "transparent" }}
              >
                <div className="text-[6.5px] leading-none" style={{ color: isToday ? "rgba(255,255,255,0.85)" : "var(--ll-faint)" }}>{DOW[i]}</div>
                <div className="text-[8px] font-semibold leading-tight" style={{ color: isToday ? "#fff" : "var(--ll-fg)" }}>{i + 20}</div>
              </div>
            );
          })}
        </div>

        {/* room rows */}
        <div className="mt-1 space-y-[3px]">
          {ROWS.map((r, ri) => (
            <div key={r.room} className="grid items-center gap-[3px]" style={{ gridTemplateColumns: `26px repeat(${WIN}, 1fr)` }}>
              <div className="text-[8px] font-medium" style={{ color: "var(--ll-muted)" }}>{r.room}</div>
              <div className="relative col-span-12 h-[14px]">
                {/* weekend + today column tints */}
                <div className="absolute inset-0 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${WIN}, 1fr)` }}>
                  {Array.from({ length: WIN }).map((_, i) => {
                    const weekend = DOW[i] === "ส" || DOW[i] === "อา";
                    return (
                      <div key={i} className="rounded-[3px]"
                        style={{ background: i === TODAY ? "rgba(10,132,255,0.08)" : weekend ? "var(--ll-wknd)" : "var(--ll-surface-2)" }} />
                    );
                  })}
                </div>
                {/* frosted pill bars */}
                {r.bars.map(([s, e, c], bi) => {
                  const dragging = ri === 2 && bi === 1;
                  return (
                    <div
                      key={bi}
                      className="pms-ll-bar absolute top-[1px] flex h-[12px] items-center overflow-hidden px-1.5"
                      style={{
                        // @ts-expect-error CSS var for the pill recipe
                        "--bc": BAR[c],
                        left: `calc(${(s / WIN) * 100}% + 1px)`,
                        width: `calc(${((e - s + 1) / WIN) * 100}% - 2px)`,
                        animation: dragging ? "dragBlock 3.4s ease-in-out 0.6s infinite" : undefined,
                        zIndex: dragging ? 5 : 1,
                      }}
                    >
                      <span className="truncate text-[6.5px] font-semibold" style={{ color: "var(--ll-fg)" }}>
                        {["Anan", "Smith", "Pim", "Lee", "Noi", "Som", "Kit"][(ri + bi) % 7]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="pms-ll-surface mt-2.5 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5"
        style={{ animation: "fadeUp 0.6s ease-out 1.2s both" }}
      >
        <span className="grid h-4 w-4 place-items-center rounded-md text-white" style={{ background: "var(--ll-accent)" }}>
          <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="currentColor"><path d="M8 0a2 2 0 100 4 2 2 0 000-4zM3 6a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM8 12a2 2 0 100 4 2 2 0 000-4z" /></svg>
        </span>
        <span className="text-[9px] font-medium" style={{ color: "var(--ll-fg)" }}>ย้ายห้อง 201 · 24–27 พ.ค.</span>
      </div>
      <Keyframes />
    </>
  );
}

/* ── Scene 2 — Booking + guest detail ────────────────────────── */
function BookingScene() {
  const rows = [
    { name: "K. Anan", room: "201", chan: "Direct", c: BAR.blue },
    { name: "J. Smith", room: "305", chan: "Booking", c: BAR.teal },
    { name: "Pim L.", room: "108", chan: "Agoda", c: BAR.rose, isNew: true },
    { name: "C. Lee", room: "402", chan: "Airbnb", c: BAR.violet },
  ];
  return (
    <>
      <SceneHead title="การจอง" sub="12 today" />
      <div className={`${card} overflow-hidden`}>
        {rows.map((b, i) => (
          <div
            key={b.name}
            className="flex items-center justify-between p-2 text-[10px]"
            style={{
              borderTop: i ? "1px solid var(--ll-border)" : "none",
              background: b.isNew ? "var(--ll-accent-soft)" : "transparent",
              animation: b.isNew ? "newBooking 0.8s ease-out 0.3s both" : undefined,
            }}
          >
            <div className="flex items-center gap-2">
              <div className="grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: b.c }}>{b.name[0]}</div>
              <div>
                <div className="font-semibold">{b.name}</div>
                <div className="text-[8px]" style={{ color: "var(--ll-muted)" }}>ห้อง {b.room} · {b.chan}</div>
              </div>
            </div>
            {b.isNew && <span className="rounded-full px-1.5 py-0.5 text-[7px] font-semibold uppercase text-white" style={{ background: "var(--ll-accent)" }}>New</span>}
          </div>
        ))}
      </div>

      <div className="pms-ll-surface absolute right-3 top-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ boxShadow: "var(--ll-shadow)", animation: "toastIn 0.6s ease-out 0.1s both" }}>
        <span className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: "var(--ll-accent)" }}>
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 8l4 4 6-8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div>
          <div className="text-[10px] font-semibold">การจองใหม่</div>
          <div className="text-[8px]" style={{ color: "var(--ll-muted)" }}>Pim L. · ห้อง 108 · 3 คืน</div>
        </div>
      </div>

      <div className="pms-ll-surface absolute left-1/2 top-1/2 w-[182px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-3" style={{ boxShadow: "var(--ll-shadow)", animation: "popupIn 0.7s ease-out 1.8s both" }}>
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: BAR.rose }}>P</div>
          <div>
            <div className="text-[11px] font-semibold">Pim Laungsri</div>
            <div className="text-[8px]" style={{ color: "var(--ll-faint)" }}>pim.l@example.com</div>
          </div>
        </div>
        <div className="mt-2 space-y-1 pt-2 text-[9px]" style={{ borderTop: "1px solid var(--ll-border)" }}>
          <KV k="ห้อง" v="108 · Deluxe" />
          <KV k="เช็คอิน" v="25 พ.ค. · 14:00" />
          <KV k="เช็คเอาต์" v="28 พ.ค. · 12:00" />
          <KV k="ยอดรวม" v="฿8,970" highlight />
        </div>
      </div>
      <Keyframes />
    </>
  );
}

/* ── Scene 3 — Channels ──────────────────────────────────────── */
function ChannelsScene() {
  const ch = [
    { name: "Booking.com", c: BAR.blue, n: 142, d: 0 },
    { name: "Agoda", c: BAR.rose, n: 98, d: 0.15 },
    { name: "Airbnb", c: BAR.violet, n: 76, d: 0.3 },
    { name: "Expedia", c: BAR.amber, n: 54, d: 0.45 },
  ];
  return (
    <>
      <SceneHead title="Channel Manager" sub="ซิงค์ครบ" live />
      <div className="space-y-1.5">
        {ch.map((c) => (
          <div key={c.name} className={`${card} flex items-center gap-2 p-2`} style={{ animation: `slideRight 0.5s ease-out ${c.d}s both` }}>
            <div className="h-7 w-7 rounded-lg" style={{ background: c.c }} />
            <div className="flex-1">
              <div className="text-[10px] font-semibold">{c.name}</div>
              <div className="flex items-center gap-1 text-[8px]" style={{ color: "var(--ll-muted)" }}>
                <span className="inline-block h-1 w-1 rounded-full" style={{ background: "var(--ll-accent)", animation: `pulse 1.5s ease-in-out ${c.d}s infinite` }} />
                synced 2s ago
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold tabular-nums">{c.n}</div>
              <div className="text-[8px]" style={{ color: "var(--ll-faint)" }}>bookings</div>
            </div>
          </div>
        ))}
      </div>
      <div className="pms-ll-surface mt-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2" style={{ animation: "fadeUp 0.6s ease-out 0.8s both" }}>
        <span className="text-[9px]" style={{ color: "var(--ll-muted)" }}>อัปเดตราคา</span>
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="inline-block h-1 w-1 rounded-full" style={{ background: "var(--ll-accent)", animation: `dotFlow 1.5s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </span>
        <span className="text-[9px] font-medium" style={{ color: "var(--ll-accent)" }}>4 ช่องทาง</span>
      </div>
      <Keyframes />
    </>
  );
}

/* ── shared bits ─────────────────────────────────────────────── */
function SceneHead({ title, sub, live }: { title: string; sub: string; live?: boolean }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div>
        <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
        <p className="text-[9px]" style={{ color: "var(--ll-faint)" }}>{sub}</p>
      </div>
      {live && (
        <span className="flex items-center gap-1.5 text-[9px] font-medium" style={{ color: "var(--ll-accent)" }}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: "var(--ll-accent)" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--ll-accent)" }} />
          </span>
          Real-time
        </span>
      )}
    </div>
  );
}
function KV({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--ll-muted)" }}>{k}</span>
      <span style={{ fontWeight: highlight ? 700 : 500, color: highlight ? "var(--ll-accent)" : "var(--ll-fg)" }}>{v}</span>
    </div>
  );
}
function Keyframes() {
  return (
    <style jsx global>{`
      @keyframes slideInLeft { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes slideRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pulse { 0%,100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
      @keyframes dotFlow { 0%,100% { opacity: 0.3; transform: translateX(0); } 50% { opacity: 1; transform: translateX(4px); } }
      @keyframes newBooking { 0% { opacity: 0; transform: translateY(-8px); } 100% { opacity: 1; transform: translateY(0); } }
      @keyframes toastIn { 0% { opacity: 0; transform: translateY(-20px) translateX(10px); } 100% { opacity: 1; transform: translateY(0) translateX(0); } }
      @keyframes popupIn { 0% { opacity: 0; transform: translate(-50%, -45%) scale(0.92); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
      @keyframes dragBlock { 0%,22% { transform: translateX(0); } 44%,60% { transform: translateX(28%) scale(1.04); } 82%,100% { transform: translateX(0); } }
    `}</style>
  );
}
