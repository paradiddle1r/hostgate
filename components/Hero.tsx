"use client";

import Link from "next/link";
import { useI18n, pick } from "@/lib/i18n";

export default function Hero() {
  const { locale, t } = useI18n();

  return (
    <section className="relative isolate overflow-hidden pt-32 pb-20 lg:pt-44 lg:pb-32">
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_40%,transparent_80%)]" />
        <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 spotlight" />
      </div>

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="reveal mx-auto inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            {pick(t.hero.badge, locale)}
          </div>

          {/* Headline */}
          <h1
            className="reveal mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-zinc-900 sm:text-5xl lg:text-7xl"
            style={{ animationDelay: "0.1s" }}
          >
            {pick(t.hero.title1, locale)}{" "}
            <span className="gradient-text-brand">{pick(t.hero.title2, locale)}</span>
          </h1>

          {/* Subtitle */}
          <p
            className="reveal mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg"
            style={{ animationDelay: "0.2s" }}
          >
            {pick(t.hero.subtitle, locale)}
          </p>

          {/* CTAs */}
          <div
            className="reveal mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "0.3s" }}
          >
            <Link
              href="#pricing"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 sm:w-auto"
            >
              {pick(t.hero.ctaPrimary, locale)}
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="#screenshots"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 sm:w-auto"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M4 2.5v11l9-5.5z" />
              </svg>
              {pick(t.hero.ctaSecondary, locale)}
            </Link>
          </div>

          <p className="reveal mt-5 text-xs text-zinc-500" style={{ animationDelay: "0.4s" }}>
            {pick(t.hero.note, locale)}
          </p>
        </div>

        {/* Dashboard mockup */}
        <div className="reveal relative mx-auto mt-16 max-w-6xl" style={{ animationDelay: "0.5s" }}>
          <div className="relative rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-2xl shadow-zinc-200/60">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-rose-400" />
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="h-3 w-3 rounded-full bg-emerald-400" />
        <span className="ml-3 rounded-md bg-white px-2.5 py-0.5 text-[10px] text-zinc-500 ring-1 ring-zinc-200">
          app.hostgate.app/dashboard
        </span>
      </div>

      <div className="grid grid-cols-12 gap-px bg-zinc-100">
        {/* Sidebar */}
        <aside className="col-span-2 hidden bg-zinc-50 p-3 md:block">
          <div className="mb-4 flex items-center gap-2 px-2 py-1.5">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-400 to-fuchsia-500" />
            <span className="text-xs font-semibold text-zinc-900">HostGate</span>
          </div>
          {["Dashboard", "Bookings", "Calendar", "Guests", "Channels", "Reports", "Settings"].map(
            (item, i) => (
              <div
                key={item}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] ${
                  i === 0 ? "bg-zinc-900 text-white" : "text-zinc-600"
                }`}
              >
                <span className="h-1 w-1 rounded-full bg-current" />
                {item}
              </div>
            )
          )}
        </aside>

        {/* Main */}
        <div className="col-span-12 bg-white p-4 md:col-span-10">
          {/* Header row */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Today&apos;s Overview</h3>
              <p className="text-[10px] text-zinc-500">Tuesday, May 25</p>
            </div>
            <div className="flex gap-1.5">
              <div className="rounded-md bg-zinc-100 px-2.5 py-1 text-[10px] text-zinc-700">May 2026</div>
              <div className="rounded-md bg-zinc-900 px-2.5 py-1 text-[10px] font-medium text-white">
                + New booking
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="mb-3 grid grid-cols-4 gap-2">
            {[
              { label: "Occupancy", v: "87%", chip: "bg-emerald-50 text-emerald-700" },
              { label: "ADR", v: "฿2,490", chip: "bg-indigo-50 text-indigo-700" },
              { label: "RevPAR", v: "฿2,166", chip: "bg-fuchsia-50 text-fuchsia-700" },
              { label: "Today's revenue", v: "฿42,800", chip: "bg-cyan-50 text-cyan-700" },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-zinc-200 bg-white p-2.5">
                <div className="text-[9px] uppercase tracking-wide text-zinc-500">{k.label}</div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">{k.v}</div>
                <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] ${k.chip}`}>
                  <span>▲</span> 12%
                </div>
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-medium text-zinc-900">Room calendar</div>
              <div className="flex gap-1">
                <span className="rounded-full bg-emerald-50 px-1.5 text-[8px] text-emerald-700">Booked</span>
                <span className="rounded-full bg-amber-50 px-1.5 text-[8px] text-amber-700">Hold</span>
                <span className="rounded-full bg-zinc-100 px-1.5 text-[8px] text-zinc-600">Vacant</span>
              </div>
            </div>
            <div className="grid grid-cols-[40px_repeat(14,1fr)] gap-[2px] text-[8px]">
              <div />
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="text-center text-zinc-400">
                  {i + 20}
                </div>
              ))}
              {["101", "102", "201", "202", "301", "302"].map((room, ri) => (
                <RoomRow key={room} room={room} variant={ri} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomRow({ room, variant }: { room: string; variant: number }) {
  const offsets = [
    [[0, 5, "indigo"], [6, 9, "emerald"]],
    [[1, 3, "amber"], [4, 10, "emerald"], [11, 13, "fuchsia"]],
    [[0, 2, "emerald"], [3, 6, "indigo"], [9, 13, "fuchsia"]],
    [[0, 7, "indigo"], [8, 11, "emerald"]],
    [[2, 5, "fuchsia"], [6, 9, "emerald"], [10, 13, "indigo"]],
    [[1, 4, "amber"], [5, 9, "indigo"], [10, 12, "emerald"]],
  ];
  const row = offsets[variant % offsets.length];

  return (
    <>
      <div className="text-zinc-600">{room}</div>
      {Array.from({ length: 14 }).map((_, i) => {
        const seg = row.find((r) => i >= (r[0] as number) && i <= (r[1] as number));
        const color = seg ? (seg[2] as string) : null;
        const colorMap: Record<string, string> = {
          indigo: "bg-indigo-400",
          emerald: "bg-emerald-400",
          fuchsia: "bg-fuchsia-400",
          amber: "bg-amber-400",
        };
        return (
          <div
            key={i}
            className={`h-3 rounded-sm ${color ? colorMap[color] : "bg-zinc-100"}`}
          />
        );
      })}
    </>
  );
}
