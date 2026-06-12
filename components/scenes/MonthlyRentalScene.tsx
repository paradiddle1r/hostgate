"use client";

/**
 * Monthly rental scene — for apartment / dorm owners.
 * Shows tenants list with rent status, utility tracking, and auto-collection.
 */
export default function MonthlyRentalScene() {
  return (
    <div className="pms-ll relative h-full w-full overflow-hidden p-4">
      <div className="pms-ll-mesh" aria-hidden />
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-semibold tracking-tight">หอพัก · รายเดือน</h3>
            <p className="text-[9px]" style={{ color: "var(--ll-faint)" }}>เดือนพฤษภาคม 2026</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-md px-1.5 py-0.5 text-[9px] font-medium" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
              เก็บแล้ว 38/40
            </span>
          </div>
        </div>

        {/* KPI row */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            { l: "ค่าเช่ารวม", v: "฿182,400", chip: "#16a34a" },
            { l: "ค้างชำระ", v: "฿9,600", chip: "#fb7185" },
            { l: "ห้องว่าง", v: "2 ห้อง", chip: "var(--ll-muted)" },
          ].map((k) => (
            <div key={k.l} className="pms-ll-surface rounded-lg p-2">
              <div className="text-[8px] uppercase tracking-wide" style={{ color: "var(--ll-faint)" }}>{k.l}</div>
              <div className="mt-0.5 text-[13px] font-bold tabular-nums" style={{ color: k.chip }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Tenant table */}
        <div className="pms-ll-surface rounded-lg">
          <div className="grid grid-cols-[1fr_60px_60px_70px] gap-1 px-2 py-1.5 text-[8px] font-semibold uppercase tracking-wide" style={{ borderBottom: "1px solid var(--ll-border)", background: "var(--ll-surface-2)", color: "var(--ll-faint)" }}>
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
              className="grid grid-cols-[1fr_60px_60px_70px] items-center gap-1 px-2 py-1.5 text-[10px] last:border-b-0"
              style={{ borderBottom: "1px solid var(--ll-border)", animation: `slideIn 0.5s ease-out ${i * 0.1}s both` }}
            >
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: t.color }}>
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
          className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
          style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)", animation: "fadeUp 0.6s ease-out 0.8s both" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "#16a34a" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#16a34a" }} />
          </span>
          <span className="text-[9px] font-medium" style={{ color: "#0f766e" }}>เก็บค่าเช่าอัตโนมัติผ่าน PromptPay</span>
          <span className="ml-auto text-[9px]" style={{ color: "#16a34a" }}>เปิดอยู่</span>
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
    <span className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold" style={{ background: m.bg, color: m.text }}>
      {m.label}
    </span>
  );
}
