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

  // Liquid-light status palette: clean = teal-green (success), dirty = amber, occupied = neutral.
  const cellStyle = (s: string) => {
    if (s === "clean") return { background: "rgba(48,200,192,0.14)", borderColor: "rgba(48,200,192,0.4)" };
    if (s === "dirty") return { background: "rgba(245,158,11,0.14)", borderColor: "rgba(245,158,11,0.4)" };
    return { background: "var(--ll-surface-2)", borderColor: "var(--ll-border)" };
  };
  const dotColor = (s: string) => (s === "clean" ? "#16a34a" : s === "dirty" ? "#f59e0b" : "var(--ll-faint)");
  const labelColor = (s: string) => (s === "clean" ? "#0f766e" : s === "dirty" ? "#b45309" : "var(--ll-muted)");

  return (
    <div
      className="pms-ll relative h-full w-full overflow-hidden p-4"
      style={{ paddingTop: "calc(var(--hg-safe-top, 10px) + 6px)" }}
    >
      <div className="pms-ll-mesh" aria-hidden />
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold tracking-tight">แม่บ้าน</h3>
          <span className="text-[9px]" style={{ color: "var(--ll-muted)" }}>
            {rooms.filter((r) => r.s === "dirty").length} ห้องค้าง
          </span>
        </div>

        {/* Legend */}
        <div className="mb-3 flex gap-2 text-[9px]">
          <Legend color="#30c8c0" label="สะอาด" />
          <Legend color="#f59e0b" label="ค้างทำ" />
          <Legend color="var(--ll-faint)" label="แขกอยู่" />
        </div>

        {/* Room grid */}
        <div className="grid grid-cols-4 gap-2">
          {rooms.map((r) => (
            <div
              key={r.n}
              className="pms-ll-surface relative aspect-square rounded-lg p-2 transition-all duration-500"
              style={cellStyle(r.s)}
            >
              <div className="text-[10px] font-bold">{r.n}</div>
              <div
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full transition-colors duration-500"
                style={{ background: dotColor(r.s) }}
              />
              <div
                className="absolute bottom-1.5 left-1.5 right-1.5 text-[8px] font-medium"
                style={{ color: labelColor(r.s) }}
              >
                {r.s === "clean" ? "✓ done" : r.s === "dirty" ? "to do" : "in use"}
              </div>
              {r.s === "clean" && (
                <div className="pointer-events-none absolute inset-0 rounded-lg" style={{ boxShadow: "0 0 0 2px rgba(48,200,192,0.6)", animation: "flashRing 0.7s ease-out forwards" }} />
              )}
            </div>
          ))}
        </div>
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
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span style={{ color: "var(--ll-muted)" }}>{label}</span>
    </span>
  );
}
