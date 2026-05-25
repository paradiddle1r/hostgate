"use client";

/**
 * Monthly rental scene — for apartment / dorm owners.
 * Shows tenants list with rent status, utility tracking, and auto-collection.
 */
export default function MonthlyRentalScene() {
  return (
    <div className="h-full w-full bg-white p-4 text-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight">หอพัก · รายเดือน</h3>
          <p className="text-[9px] text-zinc-500">เดือนพฤษภาคม 2026</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
            เก็บแล้ว 38/40
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          { l: "ค่าเช่ารวม", v: "฿182,400", chip: "text-emerald-600" },
          { l: "ค้างชำระ", v: "฿9,600", chip: "text-rose-600" },
          { l: "ห้องว่าง", v: "2 ห้อง", chip: "text-zinc-600" },
        ].map((k) => (
          <div key={k.l} className="rounded-lg border border-zinc-200 bg-white p-2">
            <div className="text-[8px] uppercase tracking-wide text-zinc-500">{k.l}</div>
            <div className={`mt-0.5 text-[13px] font-bold tabular-nums ${k.chip}`}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Tenant table */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1fr_60px_60px_70px] gap-1 border-b border-zinc-100 bg-zinc-50 px-2 py-1.5 text-[8px] font-semibold uppercase tracking-wide text-zinc-500">
          <span>ผู้เช่า</span>
          <span>ห้อง</span>
          <span>ค่าเช่า</span>
          <span>สถานะ</span>
        </div>
        {[
          { n: "คุณสมชาย", r: "101", amt: "฿4,500", status: "paid", color: "bg-zinc-900" },
          { n: "คุณนภา", r: "102", amt: "฿4,500", status: "paid", color: "bg-rose-500" },
          { n: "คุณวินัย", r: "201", amt: "฿4,800", status: "pending", color: "bg-amber-500" },
          { n: "Mr. James", r: "202", amt: "฿4,800", status: "paid", color: "bg-blue-500" },
          { n: "คุณภัทร", r: "301", amt: "฿5,200", status: "overdue", color: "bg-fuchsia-500" },
        ].map((t, i) => (
          <div
            key={t.n}
            className="grid grid-cols-[1fr_60px_60px_70px] items-center gap-1 border-b border-zinc-100 px-2 py-1.5 text-[10px] last:border-b-0"
            style={{ animation: `slideIn 0.5s ease-out ${i * 0.1}s both` }}
          >
            <div className="flex items-center gap-1.5">
              <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ${t.color}`}>
                {t.n[t.n.length - 2] || t.n[0]}
              </div>
              <span className="font-medium">{t.n}</span>
            </div>
            <span className="text-zinc-600">{t.r}</span>
            <span className="font-semibold tabular-nums">{t.amt}</span>
            <StatusBadge status={t.status} />
          </div>
        ))}
      </div>

      {/* Auto-collect indicator */}
      <div
        className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5"
        style={{ animation: "fadeUp 0.6s ease-out 0.8s both" }}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[9px] font-medium text-emerald-700">เก็บค่าเช่าอัตโนมัติผ่าน PromptPay</span>
        <span className="ml-auto text-[9px] text-emerald-600">เปิดอยู่</span>
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
    paid: { label: "ชำระแล้ว", bg: "bg-emerald-50", text: "text-emerald-700" },
    pending: { label: "รอเรียกเก็บ", bg: "bg-amber-50", text: "text-amber-700" },
    overdue: { label: "ค้างชำระ", bg: "bg-rose-50", text: "text-rose-700" },
  };
  const m = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}
