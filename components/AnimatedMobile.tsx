"use client";

import { useEffect, useRef, useState } from "react";
import { usePauseWhenHidden } from "@/lib/useReveal";

/**
 * Animated mobile PMS view in the real hotel-pms "liquid light" theme — soft
 * blue canvas, frosted cards, Apple-blue accent. Ticks the revenue KPI and
 * fires a new-booking toast periodically. Pauses timers + CSS animations when
 * off-screen (several copies mount on the landing page).
 *
 * All dimensions are in `cqw` (container-query units resolved against the
 * IPhoneFrame screen), so the layout scales pixel-perfectly at any frame
 * width — nothing can overflow. Safe areas come from the frame via
 * --hg-safe-top / --hg-safe-bottom (status bar + home indicator clearance).
 */
export default function AnimatedMobile() {
  const [revenue, setRevenue] = useState(42800);
  const [toast, setToast] = useState(false);
  const { ref, active } = usePauseWhenHidden<HTMLDivElement>();
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => setRevenue((r) => r + Math.floor(Math.random() * 200)), 1500);
    const toastLoop = setInterval(() => {
      setToast(true);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast(false), 2200);
    }, 4500);
    return () => {
      clearInterval(tick);
      clearInterval(toastLoop);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [active]);

  return (
    <div
      ref={ref}
      data-paused={active ? undefined : "true"}
      className="pms-ll hg-anim-root relative flex h-full w-full flex-col px-[5.5cqw]"
      style={{ paddingTop: "calc(var(--hg-safe-top, 13.5cqw) + 1cqw)" }}
    >
      <div className="pms-ll-mesh" aria-hidden />

      {/* Toast — drops in just below the Dynamic Island */}
      <div
        className={`pms-ll-surface pointer-events-none absolute left-[4cqw] right-[4cqw] top-[14.5cqw] z-30 flex items-center gap-[2.6cqw] rounded-[5.5cqw] p-[3cqw] transition-all duration-500 ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-[22cqw] opacity-0"
        }`}
        style={{ boxShadow: "var(--ll-shadow)" }}
      >
        <span className="grid h-[8cqw] w-[8cqw] shrink-0 place-items-center rounded-full text-white" style={{ background: "var(--ll-accent)" }}>
          <svg viewBox="0 0 16 16" className="h-[3.6cqw] w-[3.6cqw]" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 8l4 4 6-8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[3.4cqw] font-semibold leading-tight">การจองใหม่</div>
          <div className="truncate text-[2.9cqw]" style={{ color: "var(--ll-muted)" }}>ห้อง 108 · ฿8,970</div>
        </div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[3.2cqw]" style={{ color: "var(--ll-muted)" }}>สวัสดีตอนเช้า</p>
          <h3 className="truncate text-[5.8cqw] font-bold tracking-tight">โรงแรมสุขุมวิท</h3>
        </div>
        <div className="grid h-[8.6cqw] w-[8.6cqw] shrink-0 place-items-center rounded-full text-[3.4cqw] font-bold text-white" style={{ background: "var(--ll-accent)" }}>N</div>
      </div>

      {/* Hero KPI — accent gradient card */}
      <div
        className="relative z-10 mt-[4cqw] overflow-hidden rounded-[5.5cqw] p-[4.5cqw] text-white"
        style={{ background: "linear-gradient(135deg, #0a84ff 0%, #5e9dff 55%, #64d2ff 100%)", boxShadow: "var(--ll-shadow)" }}
      >
        <p className="text-[2.9cqw] uppercase tracking-[0.14em] text-white/70">รายได้วันนี้</p>
        <p className="mt-[0.8cqw] text-[8.4cqw] font-bold leading-none tracking-tight tabular-nums">฿{revenue.toLocaleString()}</p>
        <p className="mt-[2cqw] inline-flex items-center gap-[1.3cqw] rounded-full bg-white/20 px-[2.2cqw] py-[0.8cqw] text-[2.7cqw] leading-none text-white">
          <span className="h-[1.4cqw] w-[1.4cqw] animate-pulse rounded-full bg-white" /> live
        </p>
      </div>

      {/* Stats */}
      <div className="relative z-10 mt-[3cqw] grid grid-cols-2 gap-[2.6cqw]">
        {[
          { l: "Occupancy", v: "87%" },
          { l: "ADR", v: "฿2,490" },
          { l: "เข้าพัก", v: "12" },
          { l: "เช็คเอาต์", v: "8" },
        ].map((k) => (
          <div key={k.l} className="pms-ll-surface rounded-[4.5cqw] p-[3cqw]">
            <div className="truncate text-[2.7cqw] uppercase tracking-wide" style={{ color: "var(--ll-faint)" }}>{k.l}</div>
            <div className="mt-[0.6cqw] text-[5cqw] font-bold leading-tight">{k.v}</div>
          </div>
        ))}
      </div>

      {/* Arrivals */}
      <div className="relative z-10 mt-[3.6cqw]">
        <p className="mb-[2cqw] text-[3.4cqw] font-semibold">เข้าพักวันนี้</p>
        <div className="space-y-[2cqw]">
          {[
            { n: "K. Anan", r: "201", t: "14:00", c: "#0a84ff" },
            { n: "J. Smith", r: "305", t: "15:30", c: "#30c8c0" },
            { n: "C. Lee", r: "108", t: "16:00", c: "#8b5cf6" },
          ].map((a, i) => (
            <div key={a.n} className="pms-ll-surface flex items-center gap-[2.6cqw] rounded-[4.5cqw] p-[2.4cqw]" style={{ animation: `slideUp 0.5s ease-out ${i * 0.1}s both` }}>
              <div className="grid h-[7.4cqw] w-[7.4cqw] shrink-0 place-items-center rounded-full text-[3cqw] font-bold text-white" style={{ background: a.c }}>{a.n[0]}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[3.4cqw] font-semibold leading-tight">{a.n}</p>
                <p className="text-[2.8cqw]" style={{ color: "var(--ll-muted)" }}>ห้อง {a.r}</p>
              </div>
              <span className="shrink-0 text-[3cqw]" style={{ color: "var(--ll-muted)" }}>{a.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 7-day revenue mini chart — fills the space above the tab bar */}
      <div className="pms-ll-surface relative z-10 mt-[3.6cqw] rounded-[4.5cqw] p-[3cqw]">
        <div className="flex items-baseline justify-between">
          <p className="text-[3.2cqw] font-semibold">รายได้ 7 วัน</p>
          <p className="text-[2.7cqw] font-semibold" style={{ color: "#16a34a" }}>+18%</p>
        </div>
        <div className="mt-[2.2cqw] flex items-end justify-between gap-[1.6cqw]" style={{ height: "13cqw" }}>
          {[42, 55, 38, 62, 50, 74, 88].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-[1.2cqw]" style={{ height: `${h}%`, background: i === 6 ? "var(--ll-accent)" : "var(--ll-accent-soft)" }} />
          ))}
        </div>
        <div className="mt-[1.2cqw] flex justify-between text-[2.2cqw]" style={{ color: "var(--ll-faint)" }}>
          {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((d) => (
            <span key={d} className="flex-1 text-center">{d}</span>
          ))}
        </div>
      </div>

      {/* Bottom tab bar — sits above the home indicator */}
      <div
        className="pms-ll-surface relative z-10 mt-auto -mx-[5.5cqw] flex items-start justify-around px-[6cqw] pt-[2cqw]"
        style={{ borderTop: "1px solid var(--ll-border)", paddingBottom: "calc(var(--hg-safe-bottom, 6cqw) + 0.5cqw)" }}
      >
        {[
          {
            l: "หน้าหลัก", on: true,
            d: "M3 8.5L8 4l5 4.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V8.5z",
          },
          {
            l: "ปฏิทิน",
            d: "M3 5a1 1 0 011-1h8a1 1 0 011 1v7a1 1 0 01-1 1H4a1 1 0 01-1-1V5zm0 2.5h10M6 3v2m4-2v2",
          },
          {
            l: "แขก",
            d: "M8 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm-4.5 6a4.5 4.5 0 019 0",
          },
          {
            l: "เพิ่ม",
            d: "M8 4.5v7M4.5 8h7",
          },
        ].map((n) => (
          <div key={n.l} className="flex flex-col items-center gap-[0.9cqw]">
            <svg viewBox="0 0 16 16" className="h-[5cqw] w-[5cqw]" fill="none" stroke={n.on ? "var(--ll-accent)" : "var(--ll-faint)"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d={n.d} />
            </svg>
            <span className="text-[2.6cqw] font-medium leading-none" style={{ color: n.on ? "var(--ll-accent)" : "var(--ll-faint)" }}>{n.l}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
