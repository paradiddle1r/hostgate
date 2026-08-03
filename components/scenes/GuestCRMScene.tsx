"use client";

/**
 * Guest CRM scene — profile + booking history + tags.
 */
export default function GuestCRMScene() {
  return (
    <div className="pms-ll relative h-full w-full overflow-hidden p-[3.25cqw]">
      <div className="pms-ll-mesh" aria-hidden />
      <div className="relative z-10">
        <div className="mb-[2.45cqw] flex items-center justify-between">
          <h3 className="text-[2.65cqw] font-semibold tracking-tight">ข้อมูลลูกค้า</h3>
          <span className="text-[1.85cqw]" style={{ color: "var(--ll-muted)" }}>2,418 รายชื่อ</span>
        </div>

        <div className="grid grid-cols-[28.7cqw_1fr] gap-[2.45cqw]">
          {/* Profile card */}
          <div className="pms-ll-surface rounded-[1.65cqw] p-[2.45cqw] text-center">
            <div className="mx-auto flex h-[11.5cqw] w-[11.5cqw] items-center justify-center rounded-full text-[3.7cqw] font-bold text-white" style={{ background: "var(--ll-accent)" }}>
              P
            </div>
            <div className="mt-[1.65cqw] text-[2.25cqw] font-semibold">Pim Laungsri</div>
            <div className="text-[1.65cqw]" style={{ color: "var(--ll-muted)" }}>VIP · 12 stays</div>
            <div className="mt-[1.65cqw] flex flex-wrap justify-center gap-[0.8cqw]">
              <Tag bg="rgba(245,158,11,0.16)" fg="#b45309">VIP</Tag>
              <Tag bg="var(--ll-accent-soft)" fg="var(--ll-accent)">Repeat</Tag>
            </div>
          </div>

          {/* Stats + history */}
          <div className="space-y-[1.65cqw]">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-[1.2cqw]">
              {[
                { l: "Stays", v: "12" },
                { l: "Spent", v: "฿98K" },
                { l: "Nights", v: "34" },
              ].map((s, i) => (
                <div
                  key={s.l}
                  className="pms-ll-surface rounded-[1cqw] p-[1.2cqw]"
                  style={{ animation: `fadeUp 0.5s ease-out ${i * 0.1}s both` }}
                >
                  <div className="text-[1.65cqw] uppercase tracking-wide" style={{ color: "var(--ll-faint)" }}>{s.l}</div>
                  <div className="text-[2.45cqw] font-bold tabular-nums">{s.v}</div>
                </div>
              ))}
            </div>

            {/* Recent stays */}
            <div className="pms-ll-surface rounded-[1.65cqw] p-[1.65cqw]">
              <div className="mb-[0.8cqw] text-[1.85cqw] font-semibold uppercase tracking-wide" style={{ color: "var(--ll-faint)" }}>
                ประวัติเข้าพัก
              </div>
              {[
                { d: "พ.ค. 2026", r: "Deluxe 108", a: "฿8,970" },
                { d: "มี.ค. 2026", r: "Suite 305", a: "฿14,500" },
                { d: "ม.ค. 2026", r: "Deluxe 201", a: "฿8,970" },
              ].map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-[0.8cqw] text-[1.85cqw] first:border-t-0"
                  style={{
                    borderTop: i ? "1px solid var(--ll-border)" : "none",
                    animation: `slideRight 0.5s ease-out ${0.3 + i * 0.1}s both`,
                  }}
                >
                  <div>
                    <div className="font-medium">{h.r}</div>
                    <div className="text-[1.65cqw]" style={{ color: "var(--ll-muted)" }}>{h.d}</div>
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
    <span className="rounded-full px-[1.2cqw] py-[0.4cqw] text-[1.65cqw] font-medium" style={{ background: bg, color: fg }}>{children}</span>
  );
}
