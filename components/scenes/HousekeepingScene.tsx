"use client";

import { useEffect, useState } from "react";

/**
 * Housekeeping scene — mobile-style room status grid that flips
 * one cell from "dirty" → "clean" every couple of seconds.
 */
export default function HousekeepingScene() {
  const initialRooms = [
    { n: "101", s: "clean" },
    { n: "102", s: "dirty" },
    { n: "103", s: "clean" },
    { n: "104", s: "occupied" },
    { n: "201", s: "dirty" },
    { n: "202", s: "clean" },
    { n: "203", s: "occupied" },
    { n: "204", s: "dirty" },
    { n: "301", s: "clean" },
    { n: "302", s: "clean" },
    { n: "303", s: "occupied" },
    { n: "304", s: "dirty" },
  ];
  const [rooms, setRooms] = useState(initialRooms);

  useEffect(() => {
    const id = setInterval(() => {
      setRooms((prev) => {
        const dirty = prev
          .map((r, i) => (r.s === "dirty" ? i : -1))
          .filter((i) => i !== -1);
        if (dirty.length === 0) return initialRooms; // reset
        const pickIdx = dirty[Math.floor(Math.random() * dirty.length)];
        return prev.map((r, i) => (i === pickIdx ? { ...r, s: "clean" } : r));
      });
    }, 1800);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full w-full bg-white p-4 text-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">แม่บ้าน</h3>
        <span className="text-[9px] text-zinc-500">
          {rooms.filter((r) => r.s === "dirty").length} ห้องค้าง
        </span>
      </div>

      {/* Legend */}
      <div className="mb-3 flex gap-2 text-[9px]">
        <Legend color="bg-emerald-400" label="สะอาด" />
        <Legend color="bg-amber-400" label="ค้างทำ" />
        <Legend color="bg-zinc-400" label="แขกอยู่" />
      </div>

      {/* Room grid */}
      <div className="grid grid-cols-4 gap-2">
        {rooms.map((r) => (
          <div
            key={r.n}
            className={`relative aspect-square rounded-lg border p-2 transition-all duration-500 ${
              r.s === "clean"
                ? "border-emerald-200 bg-emerald-50"
                : r.s === "dirty"
                ? "border-amber-200 bg-amber-50"
                : "border-zinc-200 bg-zinc-100"
            }`}
          >
            <div className="text-[10px] font-bold">{r.n}</div>
            <div
              className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full transition-colors duration-500 ${
                r.s === "clean"
                  ? "bg-emerald-500"
                  : r.s === "dirty"
                  ? "bg-amber-500"
                  : "bg-zinc-400"
              }`}
            />
            <div
              className={`absolute bottom-1.5 left-1.5 right-1.5 text-[8px] font-medium ${
                r.s === "clean"
                  ? "text-emerald-700"
                  : r.s === "dirty"
                  ? "text-amber-700"
                  : "text-zinc-500"
              }`}
            >
              {r.s === "clean" ? "✓ done" : r.s === "dirty" ? "to do" : "in use"}
            </div>
            {r.s === "clean" && (
              <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-emerald-400/60" style={{ animation: "flashRing 0.7s ease-out forwards" }} />
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes flashRing {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-zinc-600">{label}</span>
    </span>
  );
}
