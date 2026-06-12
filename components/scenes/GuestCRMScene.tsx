"use client";

/**
 * Guest CRM scene — profile + booking history + tags.
 */
export default function GuestCRMScene() {
  return (
    <div className="pms-ll relative h-full w-full overflow-hidden p-4">
      <div className="pms-ll-mesh" aria-hidden />
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold tracking-tight">ข้อมูลลูกค้า</h3>
          <span className="text-[9px]" style={{ color: "var(--ll-muted)" }}>2,418 รายชื่อ</span>
        </div>

        <div className="grid grid-cols-[140px_1fr] gap-3">
          {/* Profile card */}
          <div className="pms-ll-surface rounded-lg p-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: "var(--ll-accent)" }}>
              P
            </div>
            <div className="mt-2 text-[11px] font-semibold">Pim Laungsri</div>
            <div className="text-[8px]" style={{ color: "var(--ll-muted)" }}>VIP · 12 stays</div>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              <Tag bg="rgba(245,158,11,0.16)" fg="#b45309">VIP</Tag>
              <Tag bg="var(--ll-accent-soft)" fg="var(--ll-accent)">Repeat</Tag>
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
                  className="pms-ll-surface rounded-md p-1.5"
                  style={{ animation: `fadeUp 0.5s ease-out ${i * 0.1}s both` }}
                >
                  <div className="text-[8px] uppercase tracking-wide" style={{ color: "var(--ll-faint)" }}>{s.l}</div>
                  <div className="text-[12px] font-bold tabular-nums">{s.v}</div>
                </div>
              ))}
            </div>

            {/* Recent stays */}
            <div className="pms-ll-surface rounded-lg p-2">
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--ll-faint)" }}>
                ประวัติเข้าพัก
              </div>
              {[
                { d: "พ.ค. 2026", r: "Deluxe 108", a: "฿8,970" },
                { d: "มี.ค. 2026", r: "Suite 305", a: "฿14,500" },
                { d: "ม.ค. 2026", r: "Deluxe 201", a: "฿8,970" },
              ].map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1 text-[9px] first:border-t-0"
                  style={{
                    borderTop: i ? "1px solid var(--ll-border)" : "none",
                    animation: `slideRight 0.5s ease-out ${0.3 + i * 0.1}s both`,
                  }}
                >
                  <div>
                    <div className="font-medium">{h.r}</div>
                    <div className="text-[8px]" style={{ color: "var(--ll-muted)" }}>{h.d}</div>
                  </div>
                  <span className="font-semibold tabular-nums">{h.a}</span>
                </div>
              ))}
            </div>
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

function Tag({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span className="rounded-full px-1.5 py-0.5 text-[8px] font-medium" style={{ background: bg, color: fg }}>{children}</span>
  );
}
