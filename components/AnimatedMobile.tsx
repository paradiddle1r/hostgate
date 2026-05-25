"use client";

import { useEffect, useState } from "react";

/**
 * Animated mobile view — shows live KPI ticking + a new-booking toast that
 * fires periodically.
 */
export default function AnimatedMobile() {
  const [revenue, setRevenue] = useState(42800);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => {
      setRevenue((r) => r + Math.floor(Math.random() * 200));
    }, 1500);

    const toastLoop = setInterval(() => {
      setToast(true);
      setTimeout(() => setToast(false), 2200);
    }, 4500);

    return () => {
      clearInterval(tick);
      clearInterval(toastLoop);
    };
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col bg-white px-4 pt-1 text-zinc-900">
      {/* Toast — appears + disappears periodically */}
      <div
        className={`pointer-events-none absolute left-3 right-3 top-1 z-30 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg transition-all duration-500 ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"
        }`}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500">
          <svg viewBox="0 0 16 16" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M3 8l4 4 6-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-semibold leading-tight">New booking</div>
          <div className="text-[8px] text-zinc-500">Room 108 · ฿8,970</div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-[10px] text-zinc-500">Good morning</p>
          <h3 className="text-[15px] font-bold tracking-tight">Sukhumvit Inn</h3>
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100">
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
        </div>
      </div>

      {/* Hero KPI */}
      <div className="mt-3 rounded-xl bg-zinc-900 p-3 text-white">
        <p className="text-[9px] uppercase tracking-wider text-white/50">Today&apos;s revenue</p>
        <p className="mt-0.5 text-[20px] font-bold tracking-tight tabular-nums">
          ฿{revenue.toLocaleString()}
        </p>
        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[8px] text-emerald-300">
          <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
          live
        </p>
      </div>

      {/* Stats grid */}
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {[
          { l: "Occupancy", v: "87%" },
          { l: "ADR", v: "฿2,490" },
          { l: "Check-in", v: "12" },
          { l: "Check-out", v: "8" },
        ].map((k) => (
          <div key={k.l} className="rounded-lg border border-zinc-200 bg-white p-2">
            <div className="text-[8px] uppercase tracking-wide text-zinc-500">{k.l}</div>
            <div className="mt-0.5 text-[13px] font-bold">{k.v}</div>
          </div>
        ))}
      </div>

      {/* Arrivals */}
      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold text-zinc-700">Arrivals today</p>
        <div className="space-y-1.5">
          {[
            { n: "K. Anan", r: "201", t: "14:00", c: "bg-indigo-100 text-indigo-700" },
            { n: "J. Smith", r: "305", t: "15:30", c: "bg-emerald-100 text-emerald-700" },
            { n: "C. Lee", r: "108", t: "16:00", c: "bg-fuchsia-100 text-fuchsia-700" },
          ].map((a, i) => (
            <div
              key={a.n}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-1.5"
              style={{ animation: `slideUp 0.5s ease-out ${i * 0.1}s both` }}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ${a.c}`}>
                {a.n[0]}
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold">{a.n}</p>
                <p className="text-[8px] text-zinc-500">Room {a.r}</p>
              </div>
              <span className="text-[9px] text-zinc-500">{a.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="mt-auto -mx-4 flex items-center justify-around border-t border-zinc-200 bg-white/95 px-4 py-1.5 backdrop-blur">
        {[
          { l: "Home", active: true },
          { l: "Calendar" },
          { l: "Guests" },
          { l: "More" },
        ].map((n) => (
          <div key={n.l} className="flex flex-col items-center gap-0.5 py-1">
            <div className={`h-1 w-1 rounded-full ${n.active ? "bg-zinc-900" : "bg-zinc-300"}`} />
            <span className={`text-[8px] font-medium ${n.active ? "text-zinc-900" : "text-zinc-400"}`}>{n.l}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
