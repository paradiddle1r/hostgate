"use client";

import { useEffect, useState } from "react";

/**
 * Animated dashboard mockup that cycles through 4 scenes:
 *  0 — overview (KPIs ticking)
 *  1 — booking calendar with a block being dragged
 *  2 — new booking notification + guest detail popup
 *  3 — channels syncing live
 *
 * If `phase` is provided, the dashboard locks to that phase.
 * Otherwise it cycles automatically every 4.5 seconds.
 */
export default function AnimatedDashboard({ phase }: { phase?: number }) {
  const [auto, setAuto] = useState(0);

  useEffect(() => {
    if (phase !== undefined) return;
    const id = setInterval(() => setAuto((p) => (p + 1) % 4), 4500);
    return () => clearInterval(id);
  }, [phase]);

  const p = phase ?? auto;

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-white text-zinc-900">
      {/* Sidebar */}
      <aside className="hidden w-[150px] flex-none border-r border-zinc-100 bg-zinc-50/60 px-3 py-4 md:block">
        <div className="mb-5 flex items-center gap-2 px-2">
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
          <span className="text-[11px] font-semibold tracking-tight">HostGate</span>
        </div>
        {["Dashboard", "Bookings", "Calendar", "Guests", "Channels", "Reports", "Settings"].map(
          (item, i) => {
            const active =
              (p === 0 && i === 0) ||
              (p === 1 && i === 2) ||
              (p === 2 && i === 1) ||
              (p === 3 && i === 4);
            return (
              <div
                key={item}
                className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] transition-colors duration-500 ${
                  active ? "bg-zinc-900 text-white" : "text-zinc-600"
                }`}
              >
                <span className={`h-[6px] w-[6px] rounded-full ${active ? "bg-white" : "bg-zinc-300"}`} />
                {item}
              </div>
            );
          }
        )}
      </aside>

      {/* Main content — render scene based on phase */}
      <div className="relative flex-1 overflow-hidden">
        <Scene visible={p === 0}>
          <OverviewScene />
        </Scene>
        <Scene visible={p === 1}>
          <CalendarScene />
        </Scene>
        <Scene visible={p === 2}>
          <BookingScene />
        </Scene>
        <Scene visible={p === 3}>
          <ChannelsScene />
        </Scene>
      </div>
    </div>
  );
}

function Scene({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 p-4 transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
      }`}
    >
      {children}
    </div>
  );
}

/* ============================================================
   Scene 0 — Overview with ticking KPIs
   ============================================================ */
function OverviewScene() {
  const [revenue, setRevenue] = useState(42800);
  const [occ, setOcc] = useState(87);

  useEffect(() => {
    const id = setInterval(() => {
      setRevenue((r) => r + Math.floor(Math.random() * 250));
      setOcc((o) => Math.min(99, o + (Math.random() > 0.5 ? 1 : 0)));
    }, 1200);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight">Today</h3>
          <p className="text-[9px] text-zinc-500">Live</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[9px] text-emerald-600">Real-time</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { l: "Occupancy", v: `${occ}%`, chip: "text-emerald-600" },
          { l: "ADR", v: "฿2,490", chip: "text-indigo-600" },
          { l: "RevPAR", v: "฿2,166", chip: "text-fuchsia-600" },
          { l: "Today", v: `฿${revenue.toLocaleString()}`, chip: "text-cyan-600" },
        ].map((k) => (
          <div key={k.l} className="rounded-lg border border-zinc-200 bg-white p-2 transition-all">
            <div className="text-[8px] uppercase tracking-wide text-zinc-500">{k.l}</div>
            <div className="mt-0.5 text-[13px] font-bold tracking-tight tabular-nums">{k.v}</div>
            <div className={`mt-0.5 text-[8px] ${k.chip}`}>▲ live</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold">Revenue this month</span>
          <span className="text-[9px] text-emerald-600">+18.4%</span>
        </div>
        <AnimatedChart />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
          <div className="mb-1.5 text-[10px] font-semibold">Arrivals</div>
          {["K. Anan", "J. Smith", "C. Lee"].map((n, i) => (
            <div
              key={n}
              className="mb-1 flex items-center justify-between rounded-md bg-zinc-50 px-1.5 py-1 text-[9px]"
              style={{ animation: `slideInLeft 0.6s ease-out ${i * 0.15}s both` }}
            >
              <span className="font-medium">{n}</span>
              <span className="text-zinc-500">#{[201, 305, 108][i]}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
          <div className="mb-1.5 text-[10px] font-semibold">Channels</div>
          {["Booking", "Agoda", "Airbnb"].map((c, i) => (
            <div key={c} className="mb-1 flex items-center justify-between text-[9px]">
              <span>{c}</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" style={{ animationDelay: `${i * 0.3}s` }} />
                <span className="text-emerald-600">synced</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

function AnimatedChart() {
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-12 w-full">
      <defs>
        <linearGradient id="ac-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points="0,22 8,18 16,20 24,14 32,16 40,9 48,11 56,6 64,8 72,4 80,6 88,3 96,5"
        fill="none"
        stroke="#6366f1"
        strokeWidth="0.8"
        strokeDasharray="200"
        strokeDashoffset="200"
        style={{ animation: "drawLine 2s ease-out forwards" }}
      />
      <polygon
        points="0,22 8,18 16,20 24,14 32,16 40,9 48,11 56,6 64,8 72,4 80,6 88,3 96,5 96,28 0,28"
        fill="url(#ac-grad)"
        opacity="0"
        style={{ animation: "fadeIn 2s ease-out 1s forwards" }}
      />
      <style>{`
        @keyframes drawLine { to { stroke-dashoffset: 0; } }
        @keyframes fadeIn { to { opacity: 1; } }
      `}</style>
    </svg>
  );
}

/* ============================================================
   Scene 1 — Calendar with drag-to-move animation
   ============================================================ */
function CalendarScene() {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">Calendar</h3>
        <span className="text-[9px] text-zinc-500">May 20–31</span>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
        <div className="grid grid-cols-[32px_repeat(12,1fr)] gap-[2px] text-[7px]">
          <div />
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="text-center text-zinc-400">
              {i + 20}
            </div>
          ))}
          {["101", "102", "201", "202", "301", "302", "401", "402"].map((room, ri) => (
            <CalRow key={room} room={room} variant={ri} animateOn={ri === 2} />
          ))}
        </div>
      </div>

      {/* Drag tooltip that appears */}
      <div
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5"
        style={{ animation: "fadeUp 0.6s ease-out 1.2s both" }}
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3 text-indigo-600" fill="currentColor">
          <path d="M8 0a2 2 0 100 4 2 2 0 000-4zM3 6a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM8 12a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        <span className="text-[9px] font-medium text-indigo-700">Drag Room 201 · May 24–27</span>
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

function CalRow({ room, variant, animateOn }: { room: string; variant: number; animateOn: boolean }) {
  const offsets = [
    [[0, 3, "indigo"], [5, 8, "emerald"]],
    [[1, 4, "amber"], [6, 9, "fuchsia"]],
    [[0, 2, "emerald"]],
    [[2, 6, "indigo"]],
    [[1, 5, "fuchsia"], [7, 10, "amber"]],
    [[0, 3, "indigo"], [6, 9, "emerald"]],
    [[2, 5, "amber"]],
    [[0, 4, "fuchsia"], [7, 11, "indigo"]],
  ];
  const row = offsets[variant % offsets.length];
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-400",
    emerald: "bg-emerald-400",
    fuchsia: "bg-fuchsia-400",
    amber: "bg-amber-400",
  };
  return (
    <>
      <div className="text-[8px] text-zinc-500">{room}</div>
      {Array.from({ length: 12 }).map((_, i) => {
        const seg = row.find((r) => i >= (r[0] as number) && i <= (r[1] as number));
        const color = seg ? (seg[2] as string) : null;
        const isDragging = animateOn && color === "emerald";
        return (
          <div
            key={i}
            className={`h-[10px] rounded-sm ${color ? colorMap[color] : "bg-zinc-100"}`}
            style={
              isDragging
                ? {
                    animation: "dragBlock 3s ease-in-out 0.5s infinite",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
                  }
                : undefined
            }
          />
        );
      })}
      <style jsx>{`
        @keyframes dragBlock {
          0%, 20% { transform: translateX(0); }
          40%, 60% { transform: translateX(40px) scale(1.05); }
          80%, 100% { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

/* ============================================================
   Scene 2 — New booking notification + guest detail popup
   ============================================================ */
function BookingScene() {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">Bookings</h3>
        <span className="text-[9px] text-zinc-500">12 today</span>
      </div>

      {/* Bookings list */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        {[
          { name: "K. Anan", room: "201", chan: "Direct", color: "bg-zinc-900" },
          { name: "J. Smith", room: "305", chan: "Booking", color: "bg-blue-500" },
          { name: "Pim L.", room: "108", chan: "Agoda", color: "bg-rose-500", isNew: true },
          { name: "C. Lee", room: "402", chan: "Airbnb", color: "bg-pink-500" },
        ].map((b, i) => (
          <div
            key={b.name}
            className={`flex items-center justify-between border-b border-zinc-100 p-2 text-[10px] last:border-b-0 ${
              b.isNew ? "bg-emerald-50/60" : ""
            }`}
            style={b.isNew ? { animation: "newBooking 0.8s ease-out 0.3s both" } : undefined}
          >
            <div className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ${b.color}`}>
                {b.name[0]}
              </div>
              <div>
                <div className="font-semibold">{b.name}</div>
                <div className="text-[8px] text-zinc-500">Room {b.room} · {b.chan}</div>
              </div>
            </div>
            {b.isNew && (
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[7px] font-semibold uppercase text-white">
                New
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Toast notification */}
      <div
        className="absolute right-3 top-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-lg"
        style={{ animation: "toastIn 0.6s ease-out 0.1s both" }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500">
          <svg viewBox="0 0 16 16" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M3 8l4 4 6-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="text-[10px] font-semibold">New booking</div>
          <div className="text-[8px] text-zinc-500">Pim L. · Room 108 · 3 nights</div>
        </div>
      </div>

      {/* Guest detail popup */}
      <div
        className="absolute left-1/2 top-1/2 w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-3 shadow-2xl"
        style={{ animation: "popupIn 0.7s ease-out 1.8s both" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white">
            P
          </div>
          <div>
            <div className="text-[11px] font-semibold">Pim Laungsri</div>
            <div className="text-[8px] text-zinc-500">pim.l@example.com</div>
          </div>
        </div>
        <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2 text-[9px]">
          <Row k="Room" v="108 · Deluxe" />
          <Row k="Check-in" v="May 25 · 14:00" />
          <Row k="Check-out" v="May 28 · 12:00" />
          <Row k="Total" v="฿8,970" highlight />
        </div>
      </div>

      <style jsx>{`
        @keyframes newBooking {
          0% { opacity: 0; transform: translateY(-8px); background: rgba(16, 185, 129, 0.2); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastIn {
          0% { opacity: 0; transform: translateY(-20px) translateX(10px); }
          100% { opacity: 1; transform: translateY(0) translateX(0); }
        }
        @keyframes popupIn {
          0% { opacity: 0; transform: translate(-50%, -45%) scale(0.92); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{k}</span>
      <span className={highlight ? "font-bold text-zinc-900" : "text-zinc-700"}>{v}</span>
    </div>
  );
}

/* ============================================================
   Scene 3 — Channels syncing live
   ============================================================ */
function ChannelsScene() {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">Channel Manager</h3>
        <span className="flex items-center gap-1 text-[9px] text-emerald-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          All synced
        </span>
      </div>

      <div className="space-y-1.5">
        {[
          { name: "Booking.com", color: "bg-blue-500", bookings: 142, delay: 0 },
          { name: "Agoda", color: "bg-rose-500", bookings: 98, delay: 0.15 },
          { name: "Airbnb", color: "bg-pink-500", bookings: 76, delay: 0.3 },
          { name: "Expedia", color: "bg-amber-500", bookings: 54, delay: 0.45 },
        ].map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2"
            style={{ animation: `slideRight 0.5s ease-out ${c.delay}s both` }}
          >
            <div className={`h-7 w-7 rounded-md ${c.color}`} />
            <div className="flex-1">
              <div className="text-[10px] font-semibold">{c.name}</div>
              <div className="flex items-center gap-1 text-[8px] text-zinc-500">
                <span
                  className="inline-block h-1 w-1 rounded-full bg-emerald-500"
                  style={{ animation: `pulse 1.5s ease-in-out ${c.delay}s infinite` }}
                />
                synced 2s ago
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold tabular-nums">{c.bookings}</div>
              <div className="text-[8px] text-zinc-500">bookings</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sync arrows / data flow */}
      <div
        className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-zinc-50 px-3 py-2"
        style={{ animation: "fadeUp 0.6s ease-out 0.8s both" }}
      >
        <span className="text-[9px] text-zinc-600">Rate updated</span>
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block h-1 w-1 rounded-full bg-indigo-500"
              style={{ animation: `dotFlow 1.5s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </span>
        <span className="text-[9px] font-medium text-emerald-600">4 channels</span>
      </div>

      <style jsx>{`
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        @keyframes dotFlow {
          0%, 100% { opacity: 0.3; transform: translateX(0); }
          50% { opacity: 1; transform: translateX(4px); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
