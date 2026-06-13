"use client";

// /app/rentals/bills — batch monthly billing. Pick a period, see every active
// monthly tenant with a computed rent/elec/water/total, tick the ones to bill,
// and issue them all in one pass. Each issue = generateBill (upsert on
// booking_id,period_month) → issueBillAction (assigns a number + status issued).
// No invoice creation here — bills are the system of record for monthly rent.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Receipt, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import Button from "@/components/app/ui/Button";
import { calcStructuredBill } from "@/components/app/rentals/TenantDetailClient";
import { generateBill, issueBillAction } from "@/app/app/rentals/actions";

export interface BatchTenant {
  bookingId: string;
  roomNumber: string;
  guestName: string;
  monthlyRent: number;
  electricRate: number;
  waterRate: number;
  waterMinimumCharge: number;
  internetFee: number;
  parkingFee: number;
  otherFees: number;
  startElectric: number | null;
  startWater: number | null;
  latestElectric: number | null;
  latestWater: number | null;
}

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    back: "เช่ารายเดือน",
    title: "ออกบิลรายเดือน",
    sub: "เลือกช่วงเวลา ติ๊กห้องที่จะออกบิล แล้วออกพร้อมกัน",
    periodStart: "ตั้งแต่",
    periodEnd: "ถึง",
    selected: "เลือก",
    rooms: "ห้อง",
    grandTotal: "รวมทั้งหมด",
    room: "ห้อง",
    tenant: "ผู้เช่า",
    rent: "ค่าเช่า",
    electric: "ไฟ",
    water: "น้ำ",
    other: "อื่นๆ",
    total: "รวม",
    status: "สถานะ",
    billed: "ออกบิลแล้ว",
    outstanding: "ค้าง",
    generate: "ออกบิล",
    generating: "กำลังออกบิล…",
    none: "ไม่มีผู้เช่ารายเดือนที่ใช้งานอยู่",
    done: "ออกบิลสำเร็จ",
    failed: "ผิดพลาด",
    selectAll: "เลือกทั้งหมด",
  },
  en: {
    back: "Monthly rentals",
    title: "Batch billing",
    sub: "Pick a period, tick rooms to bill, issue them together.",
    periodStart: "Period start",
    periodEnd: "Period end",
    selected: "Selected",
    rooms: "rooms",
    grandTotal: "Grand total",
    room: "Room",
    tenant: "Tenant",
    rent: "Rent",
    electric: "Electric",
    water: "Water",
    other: "Other",
    total: "Total",
    status: "Status",
    billed: "Billed",
    outstanding: "Outstanding",
    generate: "Issue bills",
    generating: "Issuing…",
    none: "No active monthly tenants.",
    done: "Bills issued",
    failed: "failed",
    selectAll: "Select all",
  },
};

const th = "px-2 py-2 text-xs font-medium uppercase tracking-wide text-[var(--app-fg-muted)]";
const td = "px-2 py-2";

function defaultPeriod() {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const s = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  return { start: s.toISOString().slice(0, 10), end };
}

export default function BatchBillsClient({
  tenants,
  existingBills,
  currency,
}: {
  tenants: BatchTenant[];
  existingBills: Array<{ booking_id: string; period_month: string }>;
  currency: string;
}) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const money = (v: number) => `${currency} ${Number(v || 0).toLocaleString()}`;

  const dp = defaultPeriod();
  const [periodStart, setPeriodStart] = useState(dp.start);
  const [periodEnd, setPeriodEnd] = useState(dp.end);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ ok: number; failed: number } | null>(null);

  const periodMonth = `${periodEnd.slice(0, 7)}-01`;
  const billedSet = useMemo(
    () =>
      new Set(
        existingBills
          .filter((b) => b.period_month.slice(0, 7) === periodEnd.slice(0, 7))
          .map((b) => b.booking_id)
      ),
    [existingBills, periodEnd]
  );

  const rows = useMemo(
    () =>
      tenants.map((t) => {
        const calc = calcStructuredBill({
          rent: t.monthlyRent,
          electricPrev: t.startElectric,
          electricCurr: t.latestElectric,
          electricRate: t.electricRate,
          waterPrev: t.startWater,
          waterCurr: t.latestWater,
          waterRate: t.waterRate,
          waterMinimumCharge: t.waterMinimumCharge,
          internet: t.internetFee,
          parking: t.parkingFee,
          other: t.otherFees,
        });
        const otherSum = calc.internet_amount + calc.parking_amount + t.otherFees;
        return { t, calc, otherSum, billed: billedSet.has(t.bookingId) };
      }),
    [tenants, billedSet]
  );

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(tenants.map((t) => t.bookingId))
  );
  // When the period changes (which rooms are already billed), default-tick the
  // not-yet-billed rooms and clear the previous run's result banner.
  useEffect(() => {
    setSelected(new Set(rows.filter((r) => !r.billed).map((r) => r.t.bookingId)));
    setResults(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodEnd]);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.t.bookingId));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.t.bookingId)));

  const selectedRows = rows.filter((r) => selected.has(r.t.bookingId));
  const grandTotal = selectedRows.reduce((sum, r) => sum + r.calc.total, 0);

  async function generate() {
    if (selectedRows.length === 0) return;
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const r of selectedRows) {
      const gen = await generateBill(r.t.bookingId, {
        period_month: periodMonth,
        period_start: periodStart,
        period_end: periodEnd,
        rent: r.t.monthlyRent,
        electric_prev: r.t.startElectric,
        electric_curr: r.t.latestElectric,
        electric_rate: r.t.electricRate,
        electric_units: r.calc.electric_units,
        electric_amount: r.calc.electric_amount,
        water_prev: r.t.startWater,
        water_curr: r.t.latestWater,
        water_rate: r.t.waterRate,
        water_units: r.calc.water_units,
        water_amount: r.calc.water_amount,
        internet_amount: r.calc.internet_amount,
        parking_amount: r.calc.parking_amount,
        other: r.t.otherFees,
        subtotal: r.calc.total,
        total: r.calc.total,
      });
      if (gen.ok) {
        const iss = await issueBillAction(gen.data.id, r.t.bookingId);
        iss.ok ? ok++ : failed++;
      } else {
        failed++;
      }
    }
    setBusy(false);
    setResults({ ok, failed });
    if (ok > 0) toast.success(`${s("done")} (${ok})`);
    if (failed > 0) toast.error(`${failed} ${s("failed")}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <button
        type="button"
        onClick={() => router.push("/app/rentals")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--app-fg-muted)] transition-colors hover:text-[var(--app-fg)]"
      >
        <ArrowLeft size={15} /> {s("back")}
      </button>
      <h1 className="text-2xl font-semibold tracking-tight">{s("title")}</h1>
      <p className="mb-5 text-sm text-[var(--app-fg-muted)]">{s("sub")}</p>

      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              {s("periodStart")}
            </label>
            <input
              type="date"
              className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              {s("periodEnd")}
            </label>
            <input
              type="date"
              className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-[var(--app-fg-muted)]">
              {s("selected")} {selectedRows.length} {s("rooms")} · {s("grandTotal")}
            </div>
            <div className="text-2xl font-semibold tracking-tight text-[var(--app-accent)]">
              {money(grandTotal)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--app-border)] text-left">
                <th className={th}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label={s("selectAll")}
                  />
                </th>
                <th className={th}>{s("room")}</th>
                <th className={th}>{s("tenant")}</th>
                <th className={`${th} text-right`}>{s("rent")}</th>
                <th className={`${th} text-right`}>{s("electric")}</th>
                <th className={`${th} text-right`}>{s("water")}</th>
                <th className={`${th} text-right`}>{s("other")}</th>
                <th className={`${th} text-right`}>{s("total")}</th>
                <th className={th}>{s("status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-2 py-6 text-center text-[var(--app-fg-muted)]"
                  >
                    {s("none")}
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const on = selected.has(r.t.bookingId);
                return (
                  <tr
                    key={r.t.bookingId}
                    className="border-b border-[var(--app-border)]"
                    style={{
                      background: on
                        ? "color-mix(in srgb, var(--app-accent) 10%, transparent)"
                        : "transparent",
                    }}
                  >
                    <td className={td}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(r.t.bookingId)}
                      />
                    </td>
                    <td className={`${td} font-semibold`}>{r.t.roomNumber}</td>
                    <td className={`${td} max-w-[160px] truncate`}>{r.t.guestName}</td>
                    <td className={`${td} text-right`}>{money(r.t.monthlyRent)}</td>
                    <td className={`${td} text-right`}>
                      {money(r.calc.electric_amount)}
                      <span className="ml-1 text-[10px] text-[var(--app-fg-muted)]">
                        {r.calc.electric_units}u
                      </span>
                    </td>
                    <td className={`${td} text-right`}>
                      {money(r.calc.water_amount)}
                      <span className="ml-1 text-[10px] text-[var(--app-fg-muted)]">
                        {r.calc.water_units}u
                      </span>
                    </td>
                    <td className={`${td} text-right`}>{money(r.otherSum)}</td>
                    <td className={`${td} text-right font-semibold`}>{money(r.calc.total)}</td>
                    <td className={td}>
                      {r.billed ? (
                        <span className="text-xs text-[var(--app-fg-muted)]">{s("billed")}</span>
                      ) : (
                        <span className="text-xs text-[var(--app-accent)]">{s("outstanding")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={busy || selectedRows.length === 0}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />}
            {busy ? s("generating") : `${s("generate")} (${selectedRows.length})`}
          </Button>
          {results && (
            <span
              className="text-sm"
              style={{ color: results.failed ? "var(--app-danger)" : "var(--app-fg-muted)" }}
            >
              {s("done")} {results.ok}
              {results.failed ? ` · ${results.failed} ${s("failed")}` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
