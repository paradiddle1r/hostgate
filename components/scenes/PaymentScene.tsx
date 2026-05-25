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
    <div className="h-full w-full bg-white p-4 text-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">รับชำระเงิน</h3>
        <span className="text-[9px] text-zinc-500">วันนี้</span>
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-3">
        {/* QR code area */}
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
          <div className="mb-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
            PromptPay
          </div>
          <div className="relative aspect-square rounded-md bg-white p-1.5">
            <FakeQR />
            {/* Pulsing scan ring */}
            <div
              key={pulse}
              className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-emerald-400"
              style={{ animation: "scanPulse 2.4s ease-out forwards" }}
            />
          </div>
          <div className="mt-2 text-center">
            <div className="text-[9px] text-zinc-500">จำนวน</div>
            <div className="text-[13px] font-bold tabular-nums">฿4,500.00</div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold">รายการล่าสุด</span>
            <span className="flex items-center gap-1 text-[8px] text-emerald-600">
              <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-500" />
              live
            </span>
          </div>
          <div className="space-y-1">
            {[
              { n: "คุณนภา", amt: "+฿4,500", t: "เมื่อสักครู่", new: true },
              { n: "Mr. James", amt: "+฿4,800", t: "5 นาที", new: false },
              { n: "คุณสมชาย", amt: "+฿4,500", t: "12 นาที", new: false },
              { n: "Pim L.", amt: "+฿8,970", t: "1 ชม.", new: false },
            ].map((tx, i) => (
              <div
                key={tx.n}
                className={`flex items-center justify-between rounded-md px-1.5 py-1 text-[9px] ${
                  tx.new ? "bg-emerald-50" : "bg-zinc-50"
                }`}
                style={tx.new ? { animation: "slideRight 0.6s ease-out both" } : undefined}
              >
                <div className="flex items-center gap-1.5">
                  {tx.new && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                  <span className="font-medium">{tx.n}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-700 tabular-nums">{tx.amt}</span>
                  <span className="text-zinc-500">{tx.t}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment methods */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          { l: "PromptPay", c: "bg-violet-100 text-violet-700" },
          { l: "บัตรเครดิต", c: "bg-blue-100 text-blue-700" },
          { l: "โอนผ่านธนาคาร", c: "bg-emerald-100 text-emerald-700" },
          { l: "เงินสด", c: "bg-amber-100 text-amber-700" },
        ].map((m) => (
          <span key={m.l} className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${m.c}`}>
            {m.l}
          </span>
        ))}
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
        <div key={i} className={c ? "bg-zinc-900" : "bg-transparent"} />
      ))}
    </div>
  );
}
