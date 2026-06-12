"use client";

import { useEffect, useState } from "react";

/**
 * Payment scene — PromptPay QR + recent transactions ticking in.
 */
export default function PaymentScene() {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => p + 1), 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pms-ll relative h-full w-full overflow-hidden p-4">
      <div className="pms-ll-mesh" aria-hidden />
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold tracking-tight">รับชำระเงิน</h3>
          <span className="text-[9px]" style={{ color: "var(--ll-muted)" }}>วันนี้</span>
        </div>

        <div className="grid grid-cols-[140px_1fr] gap-3">
          {/* QR code area */}
          <div className="pms-ll-surface rounded-lg p-2.5">
            <div className="mb-1.5 text-center text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--ll-faint)" }}>
              PromptPay
            </div>
            <div className="relative aspect-square rounded-md p-1.5" style={{ background: "rgba(255,255,255,0.7)" }}>
              <FakeQR />
              {/* Pulsing scan ring */}
              <div
                key={pulse}
                className="pointer-events-none absolute inset-0 rounded-md"
                style={{ boxShadow: "0 0 0 2px #16a34a", animation: "scanPulse 2.4s ease-out forwards" }}
              />
            </div>
            <div className="mt-2 text-center">
              <div className="text-[9px]" style={{ color: "var(--ll-muted)" }}>จำนวน</div>
              <div className="text-[13px] font-bold tabular-nums">฿4,500.00</div>
            </div>
          </div>

          {/* Recent transactions */}
          <div className="pms-ll-surface rounded-lg p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold">รายการล่าสุด</span>
              <span className="flex items-center gap-1 text-[8px]" style={{ color: "#16a34a" }}>
                <span className="h-1 w-1 animate-pulse rounded-full" style={{ background: "#16a34a" }} />
                live
              </span>
            </div>
            <div className="space-y-1">
              {[
                { n: "คุณนภา", amt: "+฿4,500", t: "เมื่อสักครู่", new: true },
                { n: "Mr. James", amt: "+฿4,800", t: "5 นาที", new: false },
                { n: "คุณสมชาย", amt: "+฿4,500", t: "12 นาที", new: false },
                { n: "Pim L.", amt: "+฿8,970", t: "1 ชม.", new: false },
              ].map((tx) => (
                <div
                  key={tx.n}
                  className="flex items-center justify-between rounded-md px-1.5 py-1 text-[9px]"
                  style={{
                    background: tx.new ? "rgba(22,163,74,0.1)" : "var(--ll-surface-2)",
                    ...(tx.new ? { animation: "slideRight 0.6s ease-out both" } : {}),
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    {tx.new && (
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#16a34a" }} />
                    )}
                    <span className="font-medium">{tx.n}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums" style={{ color: "#16a34a" }}>{tx.amt}</span>
                    <span style={{ color: "var(--ll-muted)" }}>{tx.t}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payment methods */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            { l: "PromptPay", bg: "var(--ll-accent-soft)", fg: "var(--ll-accent)" },
            { l: "บัตรเครดิต", bg: "rgba(48,200,192,0.16)", fg: "#0f766e" },
            { l: "โอนผ่านธนาคาร", bg: "rgba(139,92,246,0.16)", fg: "#6d28d9" },
            { l: "เงินสด", bg: "rgba(245,158,11,0.16)", fg: "#b45309" },
          ].map((m) => (
            <span key={m.l} className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ background: m.bg, color: m.fg }}>
              {m.l}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes scanPulse {
          0% { opacity: 1; transform: scale(1); }
          70% { opacity: 0; transform: scale(1.15); }
          100% { opacity: 0; transform: scale(1.2); }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function FakeQR() {
  // Stylized QR matrix — 9x9 grid with corner finders
  const cells = Array.from({ length: 9 * 9 }, (_, i) => {
    const row = Math.floor(i / 9);
    const col = i % 9;
    // Corner finders (3x3 blocks at 3 corners)
    const inCorner =
      (row < 3 && col < 3) ||
      (row < 3 && col > 5) ||
      (row > 5 && col < 3);
    if (inCorner) {
      const onEdge =
        (row === 0 || row === 2 || row === 6 || row === 8) ||
        (col === 0 || col === 2 || col === 6 || col === 8);
      const onCenter =
        (row === 1 && col === 1) ||
        (row === 1 && col === 7) ||
        (row === 7 && col === 1);
      return onEdge || onCenter ? 1 : 0;
    }
    return (row * 7 + col * 11) % 3 === 0 ? 1 : 0;
  });
  return (
    <div className="grid h-full w-full grid-cols-9 grid-rows-9 gap-[1px]">
      {cells.map((c, i) => (
        <div key={i} style={{ background: c ? "var(--ll-fg)" : "transparent" }} />
      ))}
    </div>
  );
}
