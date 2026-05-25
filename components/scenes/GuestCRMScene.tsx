"use client";

/**
 * Guest CRM scene — profile + booking history + tags.
 */
export default function GuestCRMScene() {
  return (
    <div className="h-full w-full bg-white p-4 text-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">ข้อมูลลูกค้า</h3>
        <span className="text-[9px] text-zinc-500">2,418 รายชื่อ</span>
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-3">
        {/* Profile card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-lg font-bold text-white">
            P
          </div>
          <div className="mt-2 text-[11px] font-semibold">Pim Laungsri</div>
          <div className="text-[8px] text-zinc-500">VIP · 12 stays</div>
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            <Tag color="bg-amber-100 text-amber-700">VIP</Tag>
            <Tag color="bg-rose-100 text-rose-700">Repeat</Tag>
          </div>
        </div>

        {/* Stats + history */}
        <div className="space-y-2">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { l: "Stays", v: "12" },
              { l: "Spent", v: "฿98K" },
              { l: "Nights", v: "34" },
            ].map((s, i) => (
              <div
                key={s.l}
                className="rounded-md border border-zinc-200 bg-white p-1.5"
                style={{ animation: `fadeUp 0.5s ease-out ${i * 0.1}s both` }}
              >
                <div className="text-[8px] uppercase tracking-wide text-zinc-500">{s.l}</div>
                <div className="text-[12px] font-bold tabular-nums">{s.v}</div>
              </div>
            ))}
          </div>

          {/* Recent stays */}
          <div className="rounded-lg border border-zinc-200 bg-white p-2">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
              ประวัติเข้าพัก
            </div>
            {[
              { d: "พ.ค. 2026", r: "Deluxe 108", a: "฿8,970" },
              { d: "มี.ค. 2026", r: "Suite 305", a: "฿14,500" },
              { d: "ม.ค. 2026", r: "Deluxe 201", a: "฿8,970" },
            ].map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-t border-zinc-100 py-1 text-[9px] first:border-t-0"
                style={{ animation: `slideRight 0.5s ease-out ${0.3 + i * 0.1}s both` }}
              >
                <div>
                  <div className="font-medium">{h.r}</div>
                  <div className="text-[8px] text-zinc-500">{h.d}</div>
                </div>
                <span className="font-semibold tabular-nums">{h.a}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${color}`}>{children}</span>
  );
}
