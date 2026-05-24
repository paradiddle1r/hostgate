"use client";

import { useState } from "react";
import { useI18n, pick } from "@/lib/i18n";
import { SectionHeader } from "./Features";

type Tab = "dashboard" | "calendar" | "channels" | "reports";

export default function Screenshots() {
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<Tab>("dashboard");

  const tabs: { key: Tab; label: { th: string; en: string } }[] = [
    { key: "dashboard", label: { th: "แดชบอร์ด", en: "Dashboard" } },
    { key: "calendar", label: { th: "ปฏิทินจองห้อง", en: "Booking Calendar" } },
    { key: "channels", label: { th: "Channel Manager", en: "Channel Manager" } },
    { key: "reports", label: { th: "รายงาน", en: "Reports" } },
  ];

  return (
    <section id="screenshots" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeader
          badge={pick(t.screenshots.badge, locale)}
          title={pick(t.screenshots.title, locale)}
          subtitle={pick(t.screenshots.subtitle, locale)}
        />

        {/* Tabs */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                tab === tb.key
                  ? "border-white/20 bg-white/[0.06] text-white"
                  : "border-white/5 text-zinc-400 hover:border-white/10 hover:text-white"
              }`}
            >
              {pick(tb.label, locale)}
            </button>
          ))}
        </div>

        {/* Screenshot panel */}
        <div className="mx-auto mt-10 max-w-6xl">
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-1.5 shadow-2xl shadow-indigo-500/20">
            <div className="overflow-hidden rounded-xl bg-[#0a0f24] ring-1 ring-white/5">
              {/* Chrome */}
              <div className="flex items-center gap-2 border-b border-white/5 bg-[#080c1d] px-4 py-2.5">
                <span className="h-3 w-3 rounded-full bg-rose-500/70" />
                <span className="h-3 w-3 rounded-full bg-amber-400/70" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
              </div>

              {tab === "dashboard" && <DashboardView />}
              {tab === "calendar" && <CalendarView />}
              {tab === "channels" && <ChannelsView />}
              {tab === "reports" && <ReportsView />}
            </div>
            <div className="pointer-events-none absolute -bottom-10 left-1/2 h-40 w-3/4 -translate-x-1/2 bg-gradient-to-t from-indigo-500/20 to-transparent blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardView() {
  return (
    <div className="p-6">
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Today Check-ins", v: "12", chip: "bg-emerald-500/10 text-emerald-400" },
          { l: "Check-outs", v: "8", chip: "bg-indigo-500/10 text-indigo-400" },
          { l: "Occupancy", v: "87%", chip: "bg-fuchsia-500/10 text-fuchsia-400" },
          { l: "Revenue", v: "฿128,400", chip: "bg-cyan-500/10 text-cyan-400" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-xs text-zinc-500">{k.l}</div>
            <div className="mt-1 text-xl font-bold text-white">{k.v}</div>
            <div className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] ${k.chip}`}>
              ▲ 12% vs last week
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="col-span-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Revenue this month</div>
            <div className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">May 2026</div>
          </div>
          <RevenueChart />
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="mb-3 text-sm font-semibold text-white">Arrivals today</div>
          <div className="space-y-2">
            {[
              { name: "K. Anan", room: "201", time: "14:00" },
              { name: "J. Smith", room: "305", time: "15:30" },
              { name: "C. Lee", room: "108", time: "16:00" },
              { name: "M. Garcia", room: "402", time: "18:00" },
            ].map((a) => (
              <div key={a.name} className="flex items-center justify-between rounded-md bg-white/[0.02] px-2.5 py-1.5">
                <div>
                  <div className="text-xs text-white">{a.name}</div>
                  <div className="text-[10px] text-zinc-500">Room {a.room}</div>
                </div>
                <div className="text-[10px] text-zinc-400">{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueChart() {
  const data = [40, 55, 48, 70, 60, 85, 75, 90, 82, 95, 88, 110, 100, 120, 115, 130, 125, 145, 140, 155];
  const max = Math.max(...data);
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 90}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-32 w-full">
      <defs>
        <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a855f7" stopOpacity="0.4" />
          <stop offset="1" stopColor="#a855f7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`${points} 100,100 0,100`} fill="url(#rev-grad)" />
      <polyline points={points} fill="none" stroke="#c084fc" strokeWidth="0.8" />
    </svg>
  );
}

function CalendarView() {
  return (
    <div className="p-6">
      <div className="grid grid-cols-[60px_repeat(20,1fr)] gap-[2px] text-[10px]">
        <div />
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="text-center text-zinc-500">
            {i + 20}
          </div>
        ))}
        {[101, 102, 103, 201, 202, 203, 301, 302, 303, 401].map((room, ri) => {
          const colors = ["bg-indigo-500/60", "bg-emerald-500/60", "bg-fuchsia-500/60", "bg-amber-500/60"];
          const rowBlocks = [
            [(ri * 3) % 18, ((ri * 3) % 18) + 3, colors[ri % 4]],
            [((ri * 5) + 7) % 17, ((ri * 5) + 7) % 17 + 3, colors[(ri + 1) % 4]],
          ];
          return (
            <RoomLine key={room} room={`${room}`} blocks={rowBlocks as [number, number, string][]} />
          );
        })}
      </div>
    </div>
  );
}

function RoomLine({ room, blocks }: { room: string; blocks: [number, number, string][] }) {
  return (
    <>
      <div className="py-1 text-zinc-400">Room {room}</div>
      {Array.from({ length: 20 }).map((_, i) => {
        const seg = blocks.find((b) => i >= b[0] && i <= b[1]);
        return (
          <div
            key={i}
            className={`h-6 rounded-[3px] ${seg ? seg[2] : "bg-white/[0.04]"}`}
          />
        );
      })}
    </>
  );
}

function ChannelsView() {
  const channels = [
    { name: "Booking.com", status: "Connected", bookings: 142, rev: "฿412,300", color: "bg-blue-500" },
    { name: "Agoda", status: "Connected", bookings: 98, rev: "฿268,150", color: "bg-rose-500" },
    { name: "Airbnb", status: "Connected", bookings: 76, rev: "฿198,400", color: "bg-pink-500" },
    { name: "Expedia", status: "Connected", bookings: 54, rev: "฿147,800", color: "bg-amber-500" },
    { name: "Direct booking", status: "Active", bookings: 64, rev: "฿182,100", color: "bg-emerald-500" },
  ];
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Channel performance</h3>
          <p className="text-[11px] text-zinc-500">Last 30 days · all properties</p>
        </div>
        <div className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-400">
          All channels synced
        </div>
      </div>
      <div className="space-y-2">
        {channels.map((c) => (
          <div key={c.name} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-md ${c.color} opacity-80`} />
              <div>
                <div className="text-sm font-medium text-white">{c.name}</div>
                <div className="text-[10px] text-zinc-500">{c.status} · synced 2 min ago</div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-right">
              <div>
                <div className="text-[10px] text-zinc-500">Bookings</div>
                <div className="text-sm font-semibold text-white">{c.bookings}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500">Revenue</div>
                <div className="text-sm font-semibold text-white">{c.rev}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsView() {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Performance · May 2026</div>
        <div className="flex gap-1.5">
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">Export CSV</span>
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">Export PDF</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { l: "Total Revenue", v: "฿1,248,300", trend: "+18.4%" },
          { l: "Average ADR", v: "฿2,490", trend: "+6.2%" },
          { l: "Average Occupancy", v: "82%", trend: "+4.1%" },
          { l: "RevPAR", v: "฿2,041", trend: "+10.5%" },
        ].map((m) => (
          <div key={m.l} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-xs text-zinc-500">{m.l}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-2xl font-bold text-white">{m.v}</div>
              <div className="text-[10px] text-emerald-400">{m.trend}</div>
            </div>
            <MiniSpark />
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniSpark() {
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-3 h-8 w-full">
      <polyline
        points="0,25 10,20 20,22 30,15 40,17 50,10 60,12 70,7 80,9 90,4 100,5"
        fill="none"
        stroke="#34d399"
        strokeWidth="1.5"
      />
    </svg>
  );
}
