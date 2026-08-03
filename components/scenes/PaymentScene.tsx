"use client";

import { useEffect, useState } from "react";

/** PromptPay payment scene. All geometry uses container units so the scene
 * remains complete inside both the 280px showcase iPad and the 520px feature
 * iPad. The QR is a genuine version-5 matrix with a four-module quiet zone. */
export default function PaymentScene() {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => p + 1), 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pms-ll relative h-full w-full overflow-hidden p-[3.25cqw]">
      <div className="pms-ll-mesh" aria-hidden />
      <div className="relative z-10">
        <div className="mb-[2.1cqw] flex items-center justify-between">
          <h3 className="text-[2.65cqw] font-semibold tracking-tight">รับชำระเงิน</h3>
          <span className="text-[1.85cqw]" style={{ color: "var(--ll-muted)" }}>วันนี้</span>
        </div>

        <div className="grid grid-cols-[28.7cqw_1fr] gap-[2.45cqw]">
          <div className="pms-ll-surface rounded-[1.65cqw] p-[2cqw]">
            <div className="mb-[1.1cqw] flex items-center justify-center gap-[1cqw] text-[1.8cqw] font-semibold uppercase tracking-wide" style={{ color: "#164b8f" }}>
              <span className="grid h-[3cqw] w-[3cqw] place-items-center rounded-full bg-[#164b8f] text-[1.55cqw] font-bold text-white">P</span>
              PromptPay
            </div>
            <div className="relative aspect-square overflow-hidden rounded-[1.1cqw] bg-white p-[0.8cqw] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]">
              <PromptPayQR />
              <div
                key={pulse}
                className="pointer-events-none absolute inset-0 rounded-[1.1cqw]"
                style={{ boxShadow: "0 0 0 1px #16a34a", animation: "scanPulse 2.4s ease-out forwards" }}
              />
            </div>
            <div className="mt-[1.2cqw] text-center">
              <div className="text-[1.75cqw]" style={{ color: "var(--ll-muted)" }}>จำนวน</div>
              <div className="text-[2.55cqw] font-bold tabular-nums">฿4,500.00</div>
            </div>
          </div>

          <div className="pms-ll-surface rounded-[1.65cqw] p-[2cqw]">
            <div className="mb-[1.2cqw] flex items-center justify-between">
              <span className="text-[2cqw] font-semibold">รายการล่าสุด</span>
              <span className="flex items-center gap-[0.8cqw] text-[1.65cqw]" style={{ color: "#16a34a" }}>
                <span className="h-[0.9cqw] w-[0.9cqw] animate-pulse rounded-full bg-[#16a34a]" /> live
              </span>
            </div>
            <div className="space-y-[0.8cqw]">
              {[
                { n: "คุณนภา", amt: "+฿4,500", t: "เมื่อสักครู่", fresh: true },
                { n: "Mr. James", amt: "+฿4,800", t: "5 นาที", fresh: false },
                { n: "คุณสมชาย", amt: "+฿4,500", t: "12 นาที", fresh: false },
                { n: "Pim L.", amt: "+฿8,970", t: "1 ชม.", fresh: false },
              ].map((tx) => (
                <div
                  key={tx.n}
                  className="flex items-center justify-between rounded-[1cqw] px-[1.2cqw] py-[0.8cqw] text-[1.8cqw]"
                  style={{
                    background: tx.fresh ? "rgba(22,163,74,0.1)" : "var(--ll-surface-2)",
                    ...(tx.fresh ? { animation: "slideRight 0.6s ease-out both" } : {}),
                  }}
                >
                  <div className="flex items-center gap-[1cqw]">
                    {tx.fresh && <span className="h-[1.1cqw] w-[1.1cqw] rounded-full bg-[#16a34a]" />}
                    <span className="font-medium">{tx.n}</span>
                  </div>
                  <div className="flex items-center gap-[1.5cqw]">
                    <span className="font-bold tabular-nums text-[#16a34a]">{tx.amt}</span>
                    <span style={{ color: "var(--ll-muted)" }}>{tx.t}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-[2.2cqw] flex flex-wrap gap-[1.1cqw]">
          {[
            { l: "PromptPay", bg: "var(--ll-accent-soft)", fg: "var(--ll-accent)" },
            { l: "บัตรเครดิต", bg: "rgba(48,200,192,0.16)", fg: "#0f766e" },
            { l: "โอนผ่านธนาคาร", bg: "rgba(139,92,246,0.16)", fg: "#6d28d9" },
            { l: "เงินสด", bg: "rgba(245,158,11,0.16)", fg: "#b45309" },
          ].map((m) => (
            <span key={m.l} className="rounded-full px-[1.55cqw] py-[0.45cqw] text-[1.75cqw] font-medium" style={{ background: m.bg, color: m.fg }}>
              {m.l}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes scanPulse { 0% { opacity: 1; transform: scale(1); } 70% { opacity: 0; transform: scale(1.08); } 100% { opacity: 0; transform: scale(1.1); } }
        @keyframes slideRight { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}

function PromptPayQR() {
  return (
    <svg viewBox="0 0 41 41" className="h-full w-full" shapeRendering="crispEdges" aria-label="PromptPay QR code">
      <rect width="41" height="41" fill="white" />
      <path
        stroke="#111827"
        d="M4 4.5h7m1 0h1m1 0h2m2 0h1m2 0h3m1 0h1m2 0h1m1 0h7M4 5.5h1m5 0h1m2 0h1m5 0h1m1 0h1m2 0h2m2 0h1m1 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m3 0h4m1 0h1m3 0h1m1 0h1m1 0h2m1 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m1 0h2m2 0h1m1 0h1m2 0h2m1 0h1m1 0h1m1 0h1m1 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m1 0h7m2 0h4m1 0h2m2 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m1 0h3m5 0h4m3 0h1m2 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M12 11.5h1m5 0h4m3 0h3M4 12.5h1m3 0h1m1 0h3m1 0h2m2 0h1m1 0h2m1 0h1m5 0h5m2 0h1M4 13.5h6m2 0h9m2 0h1m3 0h2m2 0h2m1 0h1m1 0h1M6 14.5h2m2 0h1m2 0h1m1 0h2m3 0h2m1 0h1m1 0h1m3 0h1m1 0h1m2 0h1M5 15.5h1m1 0h3m2 0h1m1 0h1m3 0h1m2 0h3m1 0h3m1 0h3m1 0h1M4 16.5h7m1 0h1m1 0h2m1 0h3m2 0h3m5 0h1m5 0h1M5 17.5h2m6 0h1m6 0h1m2 0h1m3 0h1m6 0h3M5 18.5h1m1 0h5m2 0h1m5 0h4m1 0h2m1 0h1m2 0h2M4 19.5h3m4 0h1m1 0h1m1 0h2m1 0h1m2 0h1m1 0h6m3 0h1m1 0h1M4 20.5h2m1 0h1m2 0h5m1 0h1m2 0h3m2 0h2m3 0h1m1 0h1m3 0h2M7 21.5h1m3 0h2m1 0h1m3 0h2m1 0h1m1 0h3m2 0h4m1 0h4M5 22.5h1m2 0h1m1 0h8m2 0h1m1 0h1m1 0h1m2 0h1m1 0h1m1 0h1m1 0h1M4 23.5h1m1 0h2m1 0h1m5 0h1m1 0h1m1 0h1m3 0h2m1 0h1m3 0h4M5 24.5h1m1 0h1m1 0h2m1 0h4m2 0h1m1 0h1m5 0h7m1 0h3M4 25.5h1m6 0h2m5 0h1m2 0h5m3 0h2m1 0h2m1 0h2M6 26.5h7m1 0h2m1 0h3m4 0h1m1 0h1m1 0h1m2 0h3M7 27.5h2m2 0h4m1 0h7m2 0h3m1 0h1m2 0h1m2 0h1M4 28.5h4m1 0h5m3 0h1m2 0h2m1 0h2m1 0h1m1 0h5m1 0h1m1 0h1M12 29.5h5m1 0h1m7 0h1m1 0h1m3 0h1m3 0h1M4 30.5h7m1 0h2m2 0h4m1 0h1m3 0h4m1 0h1m1 0h3m1 0h1M4 31.5h1m5 0h1m4 0h8m2 0h1m2 0h1m3 0h2m2 0h1M4 32.5h1m1 0h3m1 0h1m1 0h1m2 0h2m1 0h1m3 0h1m1 0h1m3 0h6M4 33.5h1m1 0h3m1 0h1m2 0h1m1 0h3m2 0h1m2 0h1m2 0h1m1 0h4m2 0h3M4 34.5h1m1 0h3m1 0h1m2 0h3m4 0h1m2 0h1m1 0h3m3 0h3M4 35.5h1m5 0h1m4 0h1m2 0h1m2 0h1m1 0h7m2 0h2m1 0h1M4 36.5h7m1 0h1m2 0h1m1 0h6m1 0h2m2 0h2m1 0h1m1 0h4"
      />
    </svg>
  );
}
