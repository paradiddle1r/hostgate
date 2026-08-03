"use client";

/**
 * Monthly rental scene — for apartment / dorm owners.
 * Shows tenants list with rent status, utility tracking, and auto-collection.
 */
export default function MonthlyRentalScene() {
  return (
    <div className="pms-ll relative h-full w-full overflow-hidden p-[3.25cqw]">
      <div className="pms-ll-mesh" aria-hidden />
      <div className="relative z-10">
        <div className="mb-[2.45cqw] flex items-center justify-between">
          <div>
            <h3 className="text-[2.65cqw] font-semibold tracking-tight">หอพัก · รายเดือน</h3>
            <p className="text-[1.85cqw]" style={{ color: "var(--ll-faint)" }}>เดือนพฤษภาคม 2026</p>
          </div>
          <div className="flex items-center gap-[1.2cqw]">
            <span className="rounded-[1cqw] px-[1.2cqw] py-[0.4cqw] text-[1.85cqw] font-medium" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
              เก็บแล้ว 38/40
            </span>
          </div>
        </div>

        {/* KPI row */}
        <div className="mb-[2.45cqw] grid grid-cols-3 gap-[1.65cqw]">
          {[
            { l: "ค่าเช่ารวม", v: "฿182,400", chip: "#16a34a" },
            { l: "ค้างชำระ", v: "฿9,600", chip: "#fb7185" },
            { l: "ห้องว่าง", v: "2 ห้อง", chip: "var(--ll-muted)" },
          ].map((k) => (
            <div key={k.l} className="pms-ll-surface rounded-[1.65cqw] p-[1.65cqw]">
              <div className="text-[1.65cqw] uppercase tracking-wide" style={{ color: "var(--ll-faint)" }}>{k.l}</div>
              <div className="mt-[0.4cqw] text-[2.65cqw] font-bold tabular-nums" style={{ color: k.chip }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Tenant table */}
        <div className="pms-ll-surface rounded-[1.65cqw]">
          <div className="grid grid-cols-[1fr_12.3cqw_12.3cqw_14.3cqw] gap-[0.8cqw] px-[1.65cqw] py-[1.2cqw] text-[1.65cqw] font-semibold uppercase tracking-wide" style={{ borderBottom: "1px solid var(--ll-border)", background: "var(--ll-surface-2)", color: "var(--ll-faint)" }}>
            <span>ผู้เช่า</span>
            <span>ห้อง</span>
            <span>ค่าเช่า</span>
            <span>สถานะ</span>
          </div>
          {[
            { n: "คุณสมชาย", r: "101", amt: "฿4,500", status: "paid", color: "#0a84ff" },
            { n: "คุณนภา", r: "102", amt: "฿4,500", status: "paid", color: "#fb7185" },
            { n: "คุณวินัย", r: "201", amt: "฿4,800", status: "pending", color: "#f59e0b" },
            { n: "Mr. James", r: "202", amt: "฿4,800", status: "paid", color: "#30c8c0" },
            { n: "คุณภัทร", r: "301", amt: "฿5,200", status: "overdue", color: "#8b5cf6" },
          ].map((t, i) => (
            <div
              key={t.n}
              className="grid grid-cols-[1fr_12.3cqw_12.3cqw_14.3cqw] items-center gap-[0.8cqw] px-[1.65cqw] py-[1.2cqw] text-[2.05cqw] last:border-b-0"
              style={{ borderBottom: "1px solid var(--ll-border)", animation: `slideIn 0.5s ease-out ${i * 0.1}s both` }}
            >
              <div className="flex items-center gap-[1.2cqw]">
                <div className="flex h-[4.1cqw] w-[4.1cqw] items-center justify-center rounded-full text-[1.65cqw] font-bold text-white" style={{ background: t.color }}>
                  {t.n[t.n.length - 2] || t.n[0]}
                </div>
                <span className="font-medium">{t.n}</span>
              </div>
              <span style={{ color: "var(--ll-muted)" }}>{t.r}</span>
              <span className="font-semibold tabular-nums">{t.amt}</span>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </div>

        {/* Auto-collect indicator */}
        <div
          className="mt-[2.45cqw] flex items-center gap-[1.65cqw] rounded-[1.65cqw] px-[2cqw] py-[1.2cqw]"
          style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)", animation: "fadeUp 0.6s ease-out 0.8s both" }}
        >
          <span className="relative flex h-[1.65cqw] w-[1.65cqw]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "#16a34a" }} />
            <span className="relative inline-flex h-[1.65cqw] w-[1.65cqw] rounded-full" style={{ background: "#16a34a" }} />
          </span>
          <span className="text-[1.85cqw] font-medium" style={{ color: "#0f766e" }}>เก็บค่าเช่าอัตโนมัติผ่าน PromptPay</span>
          <span className="ml-auto text-[1.85cqw]" style={{ color: "#16a34a" }}>เปิดอยู่</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    paid: { label: "ชำระแล้ว", bg: "rgba(22,163,74,0.12)", text: "#16a34a" },
    pending: { label: "รอเรียกเก็บ", bg: "rgba(245,158,11,0.14)", text: "#b45309" },
    overdue: { label: "ค้างชำระ", bg: "rgba(251,113,133,0.14)", text: "#e11d48" },
  };
  const m = map[status] || map.pending;
  return (
    <span className="inline-flex items-center justify-center rounded-full px-[1.2cqw] py-[0.4cqw] text-[1.65cqw] font-semibold" style={{ background: m.bg, color: m.text }}>
      {m.label}
    </span>
  );
}
