"use client";

// /app/rentals/payments — payment-tracking board. Driven by active monthly
// tenants joined to the bill covering the selected month. Rooms with no bill
// for that month show as "not billed" (an outstanding state). Per-row toggle
// flips the bill paid ↔ issued via setBillStatusAction.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Receipt,
  Undo2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/app/ui/Toast";
import EmptyState from "@/components/app/ui/EmptyState";
import { setBillStatusAction } from "@/app/app/rentals/actions";

export interface PaymentTenant {
  bookingId: string;
  roomNumber: string;
  guestName: string;
}

export interface PaymentBill {
  id: string;
  booking_id: string;
  period_month: string;
  period_end: string | null;
  total: number;
  status: string;
}

type State = "paid" | "out" | "notbilled";

const STR: Record<"th" | "en", Record<string, string>> = {
  th: {
    back: "เช่ารายเดือน",
    title: "การชำระเงิน",
    sub: "ติดตามการชำระค่าเช่ารายเดือน",
    month: "เดือน",
    all: "ทั้งหมด",
    paidTab: "ชำระแล้ว",
    outTab: "ค้างชำระ",
    sumRooms: "ห้องทั้งหมด",
    sumPaid: "ชำระแล้ว",
    sumOutstanding: "ค้างชำระ",
    sumCollected: "เก็บได้",
    sumDue: "ยอดค้าง",
    room: "ห้อง",
    tenant: "ผู้เช่า",
    amount: "ยอด",
    status: "สถานะ",
    paid: "ชำระแล้ว",
    outstanding: "ค้างชำระ",
    notBilled: "ยังไม่ออกบิล",
    markPaid: "ทำเครื่องหมายชำระ",
    markUnpaid: "ยกเลิกชำระ",
    generate: "ออกบิล",
    empty: "ไม่มีผู้เช่ารายเดือน",
    updated: "อัปเดตแล้ว",
  },
  en: {
    back: "Monthly rentals",
    title: "Payments",
    sub: "Track monthly rent collection.",
    month: "Month",
    all: "All",
    paidTab: "Paid",
    outTab: "Outstanding",
    sumRooms: "Rooms",
    sumPaid: "Paid",
    sumOutstanding: "Outstanding",
    sumCollected: "Collected",
    sumDue: "Due",
    room: "Room",
    tenant: "Tenant",
    amount: "Amount",
    status: "Status",
    paid: "Paid",
    outstanding: "Outstanding",
    notBilled: "Not billed",
    markPaid: "Mark paid",
    markUnpaid: "Mark unpaid",
    generate: "Bill",
    empty: "No monthly tenants.",
    updated: "Updated",
  },
};

const monthKey = (d: string | null) => (d ? String(d).slice(0, 7) : "");

const chip =
  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors";

export default function PaymentsClient({
  tenants,
  bills: initialBills,
  currency,
}: {
  tenants: PaymentTenant[];
  bills: PaymentBill[];
  currency: string;
}) {
  const { locale: raw } = useI18n();
  const locale = raw === "en" ? "en" : "th";
  const s = (k: string) => STR[locale][k] ?? k;
  const router = useRouter();
  const toast = useToast();

  const money = (v: number) => `${currency} ${Number(v || 0).toLocaleString()}`;

  const [bills, setBills] = useState(initialBills);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "out">("all");

  const thisMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const months = useMemo(() => {
    const set = new Set(
      bills.map((b) => monthKey(b.period_end) || b.period_month.slice(0, 7)).filter(Boolean)
    );
    set.add(thisMonth);
    return [...set].sort((a, b) => (a < b ? 1 : -1));
  }, [bills, thisMonth]);

  const [month, setMonth] = useState(thisMonth);

  // booking_id → bill covering `month`.
  const billByBooking = useMemo(() => {
    const m = new Map<string, PaymentBill>();
    for (const b of bills) {
      const mk = monthKey(b.period_end) || b.period_month.slice(0, 7);
      if (mk !== month) continue;
      if (!m.has(b.booking_id)) m.set(b.booking_id, b);
    }
    return m;
  }, [bills, month]);

  const rows = useMemo(
    () =>
      tenants.map((tn) => {
        const bill = billByBooking.get(tn.bookingId) ?? null;
        let state: State;
        if (!bill) state = "notbilled";
        else if (bill.status === "paid") state = "paid";
        else state = "out";
        return { tn, bill, state };
      }),
    [tenants, billByBooking]
  );

  const visibleRows = useMemo(() => {
    if (statusFilter === "paid") return rows.filter((r) => r.state === "paid");
    if (statusFilter === "out")
      return rows.filter((r) => r.state === "out" || r.state === "notbilled");
    return rows;
  }, [rows, statusFilter]);

  const summary = useMemo(() => {
    let paid = 0;
    let outstanding = 0;
    let collected = 0;
    let due = 0;
    for (const r of rows) {
      if (r.state === "paid") {
        paid++;
        collected += r.bill?.total ?? 0;
      } else if (r.state === "out") {
        outstanding++;
        due += r.bill?.total ?? 0;
      } else {
        outstanding++;
      }
    }
    return { rooms: rows.length, paid, outstanding, collected, due };
  }, [rows]);

  async function togglePaid(bill: PaymentBill, next: "paid" | "issued") {
    setBusyId(bill.id);
    const prev = bill.status;
    setBills((xs) => xs.map((b) => (b.id === bill.id ? { ...b, status: next } : b)));
    const res = await setBillStatusAction(bill.id, bill.booking_id, next);
    setBusyId(null);
    if (res.ok) {
      toast.success(s("updated"));
      router.refresh();
    } else {
      setBills((xs) => xs.map((b) => (b.id === bill.id ? { ...b, status: prev } : b)));
      toast.error(`${res.code} · ${res.message}`);
    }
  }

  const StatusBadge = ({ state }: { state: State }) => {
    const map: Record<State, { bg: string; fg: string; Icon: typeof Clock; label: string }> = {
      paid: { bg: "rgba(22,163,74,0.15)", fg: "#16a34a", Icon: CheckCircle2, label: s("paid") },
      out: { bg: "rgba(180,83,9,0.14)", fg: "#b45309", Icon: Clock, label: s("outstanding") },
      notbilled: {
        bg: "var(--app-surface-2)",
        fg: "var(--app-fg-muted)",
        Icon: Clock,
        label: s("notBilled"),
      },
    };
    const cfg = map[state];
    const Icon = cfg.Icon;
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ background: cfg.bg, color: cfg.fg }}
      >
        <Icon size={12} /> {cfg.label}
      </span>
    );
  };

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

      {/* summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label={s("sumRooms")} value={String(summary.rooms)} />
        <Stat label={s("sumPaid")} value={String(summary.paid)} tone="#16a34a" />
        <Stat label={s("sumOutstanding")} value={String(summary.outstanding)} tone="#b45309" />
        <Stat label={s("sumCollected")} value={money(summary.collected)} tone="#16a34a" />
        <Stat label={s("sumDue")} value={money(summary.due)} tone="#b45309" />
      </div>

      {/* controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-[var(--app-fg-muted)]">
          {s("month")}
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <div className="inline-flex gap-1.5">
          {(
            [
              ["all", s("all")],
              ["paid", s("paidTab")],
              ["out", s("outTab")],
            ] as const
          ).map(([k, lbl]) => {
            const on = statusFilter === k;
            return (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={chip}
                style={{
                  background: on ? "var(--app-accent)" : "transparent",
                  color: on ? "var(--app-accent-fg)" : "var(--app-fg)",
                  borderColor: on ? "var(--app-accent)" : "var(--app-border)",
                }}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Receipt size={20} />} title={s("empty")} />
      ) : (
        <div className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--app-surface-2)] text-left text-xs text-[var(--app-fg-muted)]">
                  <th className="px-4 py-2.5 font-medium">{s("room")}</th>
                  <th className="px-4 py-2.5 font-medium">{s("tenant")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{s("amount")}</th>
                  <th className="px-4 py-2.5 font-medium">{s("status")}</th>
                  <th className="px-4 py-2.5 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ tn, bill, state }) => (
                  <tr key={tn.bookingId} className="border-t border-[var(--app-border)]">
                    <td className="px-4 py-3 font-semibold">{tn.roomNumber}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => router.push("/app/rentals/" + tn.bookingId)}
                        className="hover:underline"
                      >
                        {tn.guestName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {bill ? money(bill.total) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge state={state} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {state === "notbilled" && (
                          <button
                            type="button"
                            onClick={() => router.push("/app/rentals/" + tn.bookingId)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--app-accent)] hover:underline"
                          >
                            <FileText size={13} /> {s("generate")}
                          </button>
                        )}
                        {state === "out" && bill && (
                          <button
                            type="button"
                            onClick={() => togglePaid(bill, "paid")}
                            disabled={busyId === bill.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#16a34a] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                          >
                            <Check size={13} /> {s("markPaid")}
                          </button>
                        )}
                        {state === "paid" && bill && (
                          <button
                            type="button"
                            onClick={() => togglePaid(bill, "issued")}
                            disabled={busyId === bill.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-fg-muted)] disabled:opacity-60"
                          >
                            <Undo2 size={13} /> {s("markUnpaid")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="app-surface rounded-2xl border border-[var(--app-border)] p-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--app-fg-muted)]">{label}</div>
      <div
        className="mt-0.5 text-lg font-semibold tabular-nums"
        style={{ color: tone ?? "var(--app-fg)" }}
      >
        {value}
      </div>
    </div>
  );
}
