"use client";

// Flat, filterable list of every invoice for the active property. Data arrives
// once via server props; search (guest/number) + status filter run in-memory.
// "New invoice" mints a blank draft; "New from booking" opens a picker. Both
// push to the detail page on success. Row click → /app/invoices/<id>.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Plus, CalendarRange } from "lucide-react";
import type { Invoice, InvoiceStatus } from "@/lib/db/invoices";
import type { Booking } from "@/lib/db/bookings";
import { useI18n } from "@/lib/i18n";
import EmptyState from "@/components/app/ui/EmptyState";
import Button from "@/components/app/ui/Button";
import Modal from "@/components/app/ui/Modal";
import { useToast } from "@/components/app/ui/Toast";
import { newBlankInvoice, newInvoiceFromBooking } from "@/app/app/invoices/actions";

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

const STATUSES: InvoiceStatus[] = ["draft", "issued", "partial", "paid", "void"];

// Pill colours per status. void reads as muted/struck-out.
const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: "#6b7280",
  issued: "var(--app-accent)",
  partial: "#d97706",
  paid: "var(--app-success)",
  void: "#6b7280",
};

const STR = {
  th: {
    title: "ใบแจ้งหนี้",
    count: "รายการ",
    search: "ค้นหาชื่อ / เลขที่",
    status: "สถานะ",
    all: "ทั้งหมด",
    newInvoice: "สร้างใบใหม่",
    newFromBooking: "สร้างจากการจอง",
    number: "เลขที่",
    draft: "ฉบับร่าง",
    guest: "ลูกค้า",
    issueDate: "วันที่ออก",
    total: "ยอดรวม",
    paid: "ชำระแล้ว",
    balance: "คงเหลือ",
    empty: "ยังไม่มีใบแจ้งหนี้",
    emptyHint: "สร้างใบแจ้งหนี้ใบแรกของคุณ",
    pickBooking: "เลือกการจอง",
    noBookings: "ไม่มีการจอง",
    cancel: "ยกเลิก",
    st_draft: "ฉบับร่าง",
    st_issued: "ออกแล้ว",
    st_partial: "ชำระบางส่วน",
    st_paid: "ชำระครบ",
    st_void: "ยกเลิก",
  },
  en: {
    title: "Invoices",
    count: "invoices",
    search: "Search guest / number",
    status: "Status",
    all: "All",
    newInvoice: "New invoice",
    newFromBooking: "New from booking",
    number: "Number",
    draft: "Draft",
    guest: "Guest",
    issueDate: "Issue date",
    total: "Total",
    paid: "Paid",
    balance: "Balance",
    empty: "No invoices yet",
    emptyHint: "Create your first invoice.",
    pickBooking: "Pick a booking",
    noBookings: "No bookings",
    cancel: "Cancel",
    st_draft: "Draft",
    st_issued: "Issued",
    st_partial: "Partial",
    st_paid: "Paid",
    st_void: "Void",
  },
} as const;

export default function InvoicesClient({
  invoices,
  bookings,
  currency,
}: {
  invoices: Invoice[];
  bookings: Booking[];
  currency: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useI18n();
  const tr = STR[locale === "en" ? "en" : "th"];

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const statusLabel = (s: InvoiceStatus) => tr[`st_${s}` as keyof typeof tr] as string;
  const money = (n: number) =>
    `${currency} ${Number(n).toLocaleString(locale === "en" ? "en-US" : "th-TH")}`;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (status !== "all" && inv.status !== status) return false;
      if (!needle) return true;
      return (
        inv.guest_name.toLowerCase().includes(needle) ||
        (inv.number ?? "").toLowerCase().includes(needle)
      );
    });
  }, [invoices, q, status]);

  async function createBlank() {
    setBusy(true);
    const res = await newBlankInvoice();
    setBusy(false);
    if (res.ok) router.push(`/app/invoices/${res.data.id}`);
    else toast.error(`${res.code} · ${res.message}`);
  }

  async function createFromBooking(bookingId: string) {
    setBusy(true);
    const res = await newInvoiceFromBooking(bookingId);
    setBusy(false);
    if (res.ok) {
      setPickerOpen(false);
      router.push(`/app/invoices/${res.data.id}`);
    } else toast.error(`${res.code} · ${res.message}`);
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <span className="text-sm text-[var(--app-fg-muted)]">
          {rows.length} {tr.count}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
            <CalendarRange size={15} /> {tr.newFromBooking}
          </Button>
          <Button size="sm" onClick={createBlank} loading={busy}>
            <Plus size={15} /> {tr.newInvoice}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-fg-muted)]"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr.search}
            className={`${field} w-full pl-8`}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as InvoiceStatus | "all")}
          className={field}
        >
          <option value="all">
            {tr.status}: {tr.all}
          </option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState
            icon={<FileText size={22} />}
            title={tr.empty}
            hint={tr.emptyHint}
            action={
              <Button onClick={createBlank} loading={busy}>
                <Plus size={16} /> {tr.newInvoice}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                <th className="px-4 py-2.5 font-medium">{tr.number}</th>
                <th className="px-4 py-2.5 font-medium">{tr.guest}</th>
                <th className="px-4 py-2.5 font-medium">{tr.issueDate}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.total}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.paid}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.balance}</th>
                <th className="px-4 py-2.5 font-medium">{tr.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const isVoid = inv.status === "void";
                return (
                  <tr
                    key={inv.id}
                    onClick={() => router.push(`/app/invoices/${inv.id}`)}
                    className="cursor-pointer border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {inv.number ?? (
                        <span className="text-[var(--app-fg-muted)]">{tr.draft}</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2.5 ${
                        isVoid ? "text-[var(--app-fg-muted)] line-through" : ""
                      }`}
                    >
                      {inv.guest_name}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-[var(--app-fg-muted)]">
                      {inv.issue_date ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {money(inv.total)}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {money(inv.amount_paid)}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {money(inv.balance)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{
                          background: STATUS_COLOR[inv.status],
                          opacity: isVoid ? 0.7 : 1,
                          textDecoration: isVoid ? "line-through" : "none",
                        }}
                      >
                        {statusLabel(inv.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New-from-booking picker */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={tr.pickBooking}
        className="max-w-xl"
      >
        {bookings.length === 0 ? (
          <EmptyState icon={<CalendarRange size={20} />} title={tr.noBookings} />
        ) : (
          <div className="max-h-[60vh] divide-y divide-[var(--app-border)] overflow-y-auto">
            {bookings.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={busy}
                onClick={() => createFromBooking(b.id)}
                className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left text-sm transition-colors hover:bg-[var(--app-surface-2)] disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="font-medium">{b.guest_name}</span>{" "}
                  <span className="text-[var(--app-fg-muted)]">· {b.code}</span>
                  <span className="block text-xs text-[var(--app-fg-muted)]">
                    {b.check_in} → {b.check_out}
                  </span>
                </span>
                <span className="whitespace-nowrap text-[var(--app-fg-muted)]">
                  {b.total_amount == null ? "—" : money(b.total_amount)}
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
