"use client";

// Single-invoice workspace: guest box, line-item editor, totals panel, and the
// issue / record-payment / void actions. The totals panel, status pill and
// receipt list read straight off the server `invoice`/`receipts` props; after
// any mutation we call router.refresh() to re-pull them. Only the editable form
// fields (guest box + item rows) live in local state.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Plus, Trash2, FileText, Receipt as ReceiptIcon } from "lucide-react";
import type { Invoice, InvoiceItem, Payment, Receipt, InvoiceStatus } from "@/lib/db/invoices";
import type { Property } from "@/lib/db/properties";
import { useI18n } from "@/lib/i18n";
import Button from "@/components/app/ui/Button";
import Modal from "@/components/app/ui/Modal";
import { useToast } from "@/components/app/ui/Toast";
import {
  saveInvoiceMeta,
  saveInvoiceItems,
  issueInvoiceAction,
  recordPaymentAction,
  voidInvoiceAction,
} from "@/app/app/invoices/actions";

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: "#6b7280",
  issued: "var(--app-accent)",
  partial: "#d97706",
  paid: "var(--app-success)",
  void: "#6b7280",
};

const STR = {
  th: {
    draft: "ฉบับร่าง",
    print: "พิมพ์",
    receipts: "ใบเสร็จ",
    guestInfo: "ข้อมูลลูกค้า",
    guestName: "ชื่อลูกค้า",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    address: "ที่อยู่",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    items: "รายการ",
    description: "รายละเอียด",
    qty: "จำนวน",
    unitPrice: "ราคา/หน่วย",
    lineTotal: "รวม",
    discount: "ส่วนลด",
    addRow: "เพิ่มรายการ",
    saveItems: "บันทึกรายการ",
    subtotal: "ยอดก่อนภาษี",
    vat: "ภาษีมูลค่าเพิ่ม",
    total: "ยอดรวม",
    paid: "ชำระแล้ว",
    balance: "คงเหลือ",
    issue: "ออกใบ",
    issued: "ออกใบแล้ว",
    recordPayment: "บันทึกการชำระเงิน",
    void: "ยกเลิกใบ",
    voidConfirm: "ยกเลิกใบแจ้งหนี้นี้?",
    voided: "ยกเลิกแล้ว",
    amount: "จำนวนเงิน",
    method: "วิธีชำระ",
    note: "หมายเหตุ",
    cash: "เงินสด",
    transfer: "โอน",
    card: "บัตร",
    cancel: "ยกเลิก",
    confirm: "ยืนยัน",
    receiptIssued: "ออกใบเสร็จ",
    st_draft: "ฉบับร่าง",
    st_issued: "ออกแล้ว",
    st_partial: "ชำระบางส่วน",
    st_paid: "ชำระครบ",
    st_void: "ยกเลิก",
  },
  en: {
    draft: "Draft",
    print: "Print",
    receipts: "Receipts",
    guestInfo: "Bill to",
    guestName: "Guest name",
    taxId: "Tax ID",
    address: "Address",
    save: "Save",
    saved: "Saved",
    items: "Items",
    description: "Description",
    qty: "Qty",
    unitPrice: "Unit price",
    lineTotal: "Total",
    discount: "Discount",
    addRow: "Add row",
    saveItems: "Save items",
    subtotal: "Subtotal",
    vat: "VAT",
    total: "Total",
    paid: "Paid",
    balance: "Balance",
    issue: "Issue",
    issued: "Issued",
    recordPayment: "Record payment",
    void: "Void",
    voidConfirm: "Void this invoice?",
    voided: "Voided",
    amount: "Amount",
    method: "Method",
    note: "Note",
    cash: "Cash",
    transfer: "Transfer",
    card: "Card",
    cancel: "Cancel",
    confirm: "Confirm",
    receiptIssued: "Receipt issued",
    st_draft: "Draft",
    st_issued: "Issued",
    st_partial: "Partial",
    st_paid: "Paid",
    st_void: "Void",
  },
} as const;

interface ItemRow {
  description: string;
  qty: number | "";
  unit_price: number | "";
  is_discount: boolean;
}

function toRows(items: InvoiceItem[]): ItemRow[] {
  return items.map((i) => ({
    description: i.description,
    qty: i.qty,
    unit_price: i.unit_price,
    is_discount: i.is_discount,
  }));
}

export default function InvoiceDetailClient({
  invoice,
  items,
  payments,
  receipts,
  property,
}: {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: Payment[];
  receipts: Receipt[];
  property: Property;
}) {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useI18n();
  const tr = STR[locale === "en" ? "en" : "th"];

  const readOnly = invoice.status === "void";
  const issued = !!invoice.number;

  // Editable form state (everything else reads off props).
  const [guest, setGuest] = useState({
    guest_name: invoice.guest_name,
    guest_tax_id: invoice.guest_tax_id ?? "",
    guest_address: invoice.guest_address ?? "",
  });
  const [rows, setRows] = useState<ItemRow[]>(toRows(items));
  const [savingGuest, setSavingGuest] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [busy, setBusy] = useState(false);

  // Payment modal.
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: "" as number | "", method: "cash", note: "" });

  const money = (n: number) =>
    `${invoice.currency} ${Number(n).toLocaleString(locale === "en" ? "en-US" : "th-TH")}`;
  const statusLabel = (s: InvoiceStatus) => tr[`st_${s}` as keyof typeof tr] as string;
  const lineTotal = (r: ItemRow) => (Number(r.qty) || 0) * (Number(r.unit_price) || 0);

  async function onSaveGuest() {
    setSavingGuest(true);
    const res = await saveInvoiceMeta(invoice.id, {
      guest_name: guest.guest_name.trim() || "Guest",
      guest_tax_id: guest.guest_tax_id.trim() || null,
      guest_address: guest.guest_address.trim() || null,
    });
    setSavingGuest(false);
    if (res.ok) {
      toast.success(tr.saved);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function onSaveItems() {
    setSavingItems(true);
    const res = await saveInvoiceItems(
      invoice.id,
      rows
        .filter((r) => r.description.trim() || r.unit_price)
        .map((r) => ({
          description: r.description.trim(),
          qty: Number(r.qty) || 0,
          unit_price: Number(r.unit_price) || 0,
          is_discount: r.is_discount,
        }))
    );
    setSavingItems(false);
    if (res.ok) {
      toast.success(tr.saved);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function onIssue() {
    setBusy(true);
    const res = await issueInvoiceAction(invoice.id);
    setBusy(false);
    if (res.ok) {
      toast.success(tr.issued);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function onRecordPayment() {
    const amount = Number(pay.amount) || 0;
    if (!(amount > 0)) return;
    setBusy(true);
    const res = await recordPaymentAction(invoice.id, amount, pay.method, pay.note.trim() || undefined);
    setBusy(false);
    if (res.ok) {
      toast.success(`${tr.receiptIssued} · ${res.data.receiptNumber}`);
      setPayOpen(false);
      setPay({ amount: "", method: "cash", note: "" });
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function onVoid() {
    if (!window.confirm(tr.voidConfirm)) return;
    setBusy(true);
    const res = await voidInvoiceAction(invoice.id);
    setBusy(false);
    if (res.ok) {
      toast.success(tr.voided);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  function setRow(idx: number, patch: Partial<ItemRow>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { description: "", qty: 1, unit_price: "", is_discount: false }]);
  }
  function removeRow(idx: number) {
    setRows((rs) => rs.filter((_, i) => i !== idx));
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {invoice.number ?? <span className="text-[var(--app-fg-muted)]">{tr.draft}</span>}
        </h1>
        <span
          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
          style={{
            background: STATUS_COLOR[invoice.status],
            textDecoration: invoice.status === "void" ? "line-through" : "none",
          }}
        >
          {statusLabel(invoice.status)}
        </span>
        <div className="ml-auto">
          <a
            href={`/print/invoice/${invoice.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] px-4 text-sm font-medium transition-colors hover:bg-[var(--app-surface-2)]"
          >
            <Printer size={15} /> {tr.print}
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: guest + items (2 cols) */}
        <div className="space-y-4 lg:col-span-2">
          {/* Guest box */}
          <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
            <h2 className="mb-3 text-sm font-semibold">{tr.guestInfo}</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
                  {tr.guestName}
                </label>
                <input
                  className={`${field} w-full`}
                  value={guest.guest_name}
                  disabled={readOnly}
                  onChange={(e) => setGuest({ ...guest, guest_name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
                    {tr.taxId}
                  </label>
                  <input
                    className={`${field} w-full`}
                    value={guest.guest_tax_id}
                    disabled={readOnly}
                    onChange={(e) => setGuest({ ...guest, guest_tax_id: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
                    {tr.address}
                  </label>
                  <input
                    className={`${field} w-full`}
                    value={guest.guest_address}
                    disabled={readOnly}
                    onChange={(e) => setGuest({ ...guest, guest_address: e.target.value })}
                  />
                </div>
              </div>
              {!readOnly && (
                <div>
                  <Button variant="ghost" size="sm" onClick={onSaveGuest} loading={savingGuest}>
                    {tr.save}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Items editor */}
          <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
            <h2 className="mb-3 text-sm font-semibold">{tr.items}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                    <th className="py-2 pr-2 font-medium">{tr.description}</th>
                    <th className="py-2 px-2 text-right font-medium">{tr.qty}</th>
                    <th className="py-2 px-2 text-right font-medium">{tr.unitPrice}</th>
                    <th className="py-2 px-2 text-center font-medium">{tr.discount}</th>
                    <th className="py-2 pl-2 text-right font-medium">{tr.lineTotal}</th>
                    {!readOnly && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className="border-t border-[var(--app-border)]">
                      <td className="py-2 pr-2">
                        <input
                          className={`${field} w-full`}
                          value={r.description}
                          disabled={readOnly}
                          onChange={(e) => setRow(idx, { description: e.target.value })}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={0}
                          className={`${field} w-20 text-right`}
                          value={r.qty}
                          disabled={readOnly}
                          onChange={(e) =>
                            setRow(idx, { qty: e.target.value === "" ? "" : Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={0}
                          className={`${field} w-28 text-right`}
                          value={r.unit_price}
                          disabled={readOnly}
                          onChange={(e) =>
                            setRow(idx, {
                              unit_price: e.target.value === "" ? "" : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={r.is_discount}
                          disabled={readOnly}
                          onChange={(e) => setRow(idx, { is_discount: e.target.checked })}
                        />
                      </td>
                      <td className="py-2 pl-2 text-right whitespace-nowrap">
                        {r.is_discount ? "−" : ""}
                        {money(lineTotal(r))}
                      </td>
                      {!readOnly && (
                        <td className="py-2 pl-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            aria-label={tr.discount}
                            className="text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!readOnly && (
              <div className="mt-3 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={addRow}>
                  <Plus size={15} /> {tr.addRow}
                </Button>
                <Button size="sm" onClick={onSaveItems} loading={savingItems}>
                  {tr.saveItems}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: totals + actions + receipts */}
        <div className="space-y-4">
          <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--app-fg-muted)]">{tr.subtotal}</dt>
                <dd>{money(invoice.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--app-fg-muted)]">
                  {tr.vat} ({invoice.vat_rate}%)
                </dt>
                <dd>{money(invoice.vat_amount)}</dd>
              </div>
              <div className="flex justify-between border-t border-[var(--app-border)] pt-2 font-semibold">
                <dt>{tr.total}</dt>
                <dd>{money(invoice.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--app-fg-muted)]">{tr.paid}</dt>
                <dd>{money(invoice.amount_paid)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>{tr.balance}</dt>
                <dd>{money(invoice.balance)}</dd>
              </div>
            </dl>

            {!readOnly && (
              <div className="mt-4 space-y-2">
                <Button
                  className="w-full"
                  onClick={onIssue}
                  loading={busy}
                  disabled={issued}
                >
                  {issued ? tr.issued : tr.issue}
                </Button>
                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() => {
                    setPay({
                      amount: invoice.balance > 0 ? invoice.balance : "",
                      method: "cash",
                      note: "",
                    });
                    setPayOpen(true);
                  }}
                >
                  {tr.recordPayment}
                </Button>
                <Button className="w-full" variant="danger" onClick={onVoid} loading={busy}>
                  {tr.void}
                </Button>
              </div>
            )}
          </div>

          {/* Receipts */}
          {receipts.length > 0 && (
            <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ReceiptIcon size={15} /> {tr.receipts}
              </h2>
              <ul className="space-y-1.5 text-sm">
                {receipts.map((rc) => (
                  <li key={rc.id}>
                    <a
                      href={`/print/receipt/${rc.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-[var(--app-accent)] hover:underline"
                    >
                      <FileText size={14} /> {rc.number}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Record-payment modal */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={tr.recordPayment}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              {tr.cancel}
            </Button>
            <Button onClick={onRecordPayment} loading={busy}>
              {tr.confirm}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              {tr.amount}
            </label>
            <input
              type="number"
              min={0}
              autoFocus
              className={`${field} w-full`}
              value={pay.amount}
              onChange={(e) =>
                setPay({ ...pay, amount: e.target.value === "" ? "" : Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              {tr.method}
            </label>
            <select
              className={`${field} w-full`}
              value={pay.method}
              onChange={(e) => setPay({ ...pay, method: e.target.value })}
            >
              <option value="cash">{tr.cash}</option>
              <option value="transfer">{tr.transfer}</option>
              <option value="card">{tr.card}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              {tr.note}
            </label>
            <input
              className={`${field} w-full`}
              value={pay.note}
              onChange={(e) => setPay({ ...pay, note: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
