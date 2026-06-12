"use client";

import { useEffect, useRef, useState } from "react";
import { usePauseWhenHidden } from "@/lib/useReveal";

/**
 * Animated mobile PMS view in the real hotel-pms "liquid light" theme — soft
 * blue canvas, frosted cards, Apple-blue accent. Ticks the revenue KPI and
 * fires a new-booking toast periodically. Pauses timers + CSS animations when
 * off-screen (several copies mount on the landing page).
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
      className="pms-ll hg-anim-root relative flex h-full w-full flex-col px-4 pt-1"
    >
      <div className="pms-ll-mesh" aria-hidden />

      {/* Toast */}
      <div
        className={`pms-ll-surface pointer-events-none absolute left-3 right-3 top-1 z-30 flex items-center gap-2 rounded-2xl p-2 transition-all duration-500 ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"
        }`}
        style={{ boxShadow: "var(--ll-shadow)" }}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: "var(--ll-accent)" }}>
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 8l4 4 6-8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div className="flex-1">
          <div className="text-[10px] font-semibold leading-tight">การจองใหม่</div>
          <div className="text-[8px]" style={{ color: "var(--ll-muted)" }}>ห้อง 108 · ฿8,970</div>
        </div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between pt-1">
        <div>
          <p className="text-[10px]" style={{ color: "var(--ll-muted)" }}>สวัสดีตอนเช้า</p>
          <h3 className="text-[15px] font-bold tracking-tight">โรงแรมสุขุมวิท</h3>
        </div>
        <div className="grid h-7 w-7 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: "var(--ll-accent)" }}>N</div>
      </div>

      {/* Hero KPI — accent gradient card */}
      <div
        className="relative z-10 mt-3 overflow-hidden rounded-2xl p-3 text-white"
        style={{ background: "linear-gradient(135deg, #0a84ff 0%, #5e9dff 55%, #64d2ff 100%)", boxShadow: "var(--ll-shadow)" }}
      >
        <p className="text-[9px] uppercase tracking-wider text-white/70">รายได้วันนี้</p>
        <p className="mt-0.5 text-[20px] font-bold tracking-tight tabular-nums">฿{revenue.toLocaleString()}</p>
        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[8px] text-white">
          <span className="h-1 w-1 animate-pulse rounded-full bg-white" /> live
        </p>
      </div>

      {/* Stats */}
      <div className="relative z-10 mt-2.5 grid grid-cols-2 gap-2">
        {[
          { l: "Occupancy", v: "87%" },
          { l: "ADR", v: "฿2,490" },
          { l: "เข้าพัก", v: "12" },
          { l: "เช็คเอาต์", v: "8" },
        ].map((k) => (
          <div key={k.l} className="pms-ll-surface rounded-xl p-2">
            <div className="text-[8px] uppercase tracking-wide" style={{ color: "var(--ll-faint)" }}>{k.l}</div>
            <div className="mt-0.5 text-[13px] font-bold">{k.v}</div>
          </div>
        ))}
      </div>

      {/* Arrivals */}
      <div className="relative z-10 mt-3">
        <p className="mb-1.5 text-[10px] font-semibold">เข้าพักวันนี้</p>
        <div className="space-y-1.5">
          {[
            { n: "K. Anan", r: "201", t: "14:00", c: "#0a84ff" },
            { n: "J. Smith", r: "305", t: "15:30", c: "#30c8c0" },
            { n: "C. Lee", r: "108", t: "16:00", c: "#8b5cf6" },
          ].map((a, i) => (
            <div key={a.n} className="pms-ll-surface flex items-center gap-2 rounded-xl p-1.5" style={{ animation: `slideUp 0.5s ease-out ${i * 0.1}s both` }}>
              <div className="grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: a.c }}>{a.n[0]}</div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold">{a.n}</p>
                <p className="text-[8px]" style={{ color: "var(--ll-muted)" }}>ห้อง {a.r}</p>
              </div>
              <span className="text-[9px]" style={{ color: "var(--ll-muted)" }}>{a.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="pms-ll-surface relative z-10 mt-auto -mx-4 flex items-center justify-around px-4 py-1.5" style={{ borderTop: "1px solid var(--ll-border)" }}>
        {[
          { l: "หน้าหลัก", on: true },
          { l: "ปฏิทิน" },
          { l: "แขก" },
          { l: "เพิ่ม" },
        ].map((n) => (
          <div key={n.l} className="flex flex-col items-center gap-0.5 py-1">
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: n.on ? "var(--ll-accent)" : "var(--ll-faint)" }} />
            <span className="text-[8px] font-medium" style={{ color: n.on ? "var(--ll-accent)" : "var(--ll-faint)" }}>{n.l}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
