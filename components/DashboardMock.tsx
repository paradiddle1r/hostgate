"use client";

/**
 * Desktop dashboard mockup — designed to render inside MacBookFrame.
 * Light theme, Apple-clean.
 */
export default function DashboardMock() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-white text-zinc-900">
      {/* Sidebar */}
      <aside className="hidden w-[160px] flex-none border-r border-zinc-100 bg-zinc-50/60 px-3 py-4 md:block">
        <div className="mb-5 flex items-center gap-2 px-2">
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
          <span className="text-[11px] font-semibold tracking-tight">HostGate</span>
        </div>
        {["Dashboard", "Bookings", "Calendar", "Guests", "Channels", "Reports", "Settings"].map(
          (item, i) => (
            <div
              key={item}
              className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] ${
                i === 0 ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <span className={`h-[6px] w-[6px] rounded-full ${i === 0 ? "bg-white" : "bg-zinc-300"}`} />
              {item}
            </div>
          )
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-hidden p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-semibold tracking-tight">Today</h3>
            <p className="text-[9px] text-zinc-500">Monday, May 25 · 14:23</p>
          </div>
          <div className="flex gap-1.5">
            <div className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[9px] text-zinc-600">May 2026</div>
            <div className="rounded-md bg-zinc-900 px-2 py-1 text-[9px] font-medium text-white">+ Booking</div>
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-3 grid grid-cols-4 gap-2">
          {[
            { l: "Occupancy", v: "87%", t: "▲ 12%", chip: "text-emerald-600" },
            { l: "ADR", v: "฿2,490", t: "▲ 6%", chip: "text-indigo-600" },
            { l: "RevPAR", v: "฿2,166", t: "▲ 11%", chip: "text-fuchsia-600" },
            { l: "Today", v: "฿42.8K", t: "▲ 18%", chip: "text-cyan-600" },
          ].map((k) => (
            <div key={k.l} className="rounded-lg border border-zinc-200 bg-white p-2">
              <div className="text-[8px] uppercase tracking-wide text-zinc-500">{k.l}</div>
              <div className="mt-0.5 text-[13px] font-bold tracking-tight">{k.v}</div>
              <div className={`mt-0.5 text-[8px] ${k.chip}`}>{k.t}</div>
            </div>
          ))}
        </div>

        {/* Chart + arrivals */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 rounded-lg border border-zinc-200 bg-white p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-semibold">Revenue this month</div>
              <div className="text-[9px] text-zinc-500">฿1.24M</div>
            </div>
            <RevenueChart />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
            <div className="mb-2 text-[10px] font-semibold">Arrivals</div>
            <div className="space-y-1">
              {[
                { n: "K. Anan", r: "201" },
                { n: "J. Smith", r: "305" },
                { n: "C. Lee", r: "108" },
                { n: "M. Garcia", r: "402" },
              ].map((a) => (
                <div key={a.n} className="flex items-center justify-between rounded-md bg-zinc-50 px-1.5 py-1">
                  <span className="text-[9px] font-medium">{a.n}</span>
                  <span className="text-[8px] text-zinc-500">#{a.r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[10px] font-semibold">Room calendar</div>
            <div className="flex gap-1 text-[8px]">
              <span className="rounded-full bg-emerald-50 px-1.5 text-emerald-700">Booked</span>
              <span className="rounded-full bg-zinc-100 px-1.5 text-zinc-600">Vacant</span>
            </div>
          </div>
          <div className="grid grid-cols-[28px_repeat(14,1fr)] gap-[2px] text-[7px]">
            <div />
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="text-center text-zinc-400">
                {i + 20}
              </div>
            ))}
            {["101", "102", "201", "202"].map((room, ri) => (
              <RoomRow key={room} room={room} variant={ri} />
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
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 90}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 w-full">
      <defs>
        <linearGradient id="rev-grad-d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`${points} 100,100 0,100`} fill="url(#rev-grad-d)" />
      <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="0.8" />
    </svg>
  );
}

function RoomRow({ room, variant }: { room: string; variant: number }) {
  const offsets = [
    [[0, 5, "indigo"], [6, 9, "emerald"]],
    [[1, 3, "amber"], [4, 10, "emerald"]],
    [[0, 2, "emerald"], [3, 6, "indigo"], [9, 13, "fuchsia"]],
    [[0, 7, "indigo"], [8, 11, "emerald"]],
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
      <div className="text-zinc-500">{room}</div>
      {Array.from({ length: 14 }).map((_, i) => {
        const seg = row.find((r) => i >= (r[0] as number) && i <= (r[1] as number));
        const color = seg ? (seg[2] as string) : null;
        return (
          <div
            key={i}
            className={`h-[10px] rounded-sm ${color ? colorMap[color] : "bg-zinc-100"}`}
          />
        );
      })}
    </>
  );
}
