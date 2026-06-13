"use client";

// Single-invoice workspace: full Thai B2B bill-to box, line-item editor, a
// tax-&-terms panel, the totals panel, and the issue / record-payment /
// void actions. Only DRAFT invoices are editable — once an invoice has been
// issued / partly or fully paid it becomes a locked numbered document
// (read-only here; payments are still recordable). The totals panel, status
// pill and receipt list read straight off the server `invoice`/`receipts`
// props; after any mutation we call router.refresh() to re-pull them.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Plus, Trash2, FileText, Receipt as ReceiptIcon, Lock } from "lucide-react";
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
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)] disabled:opacity-60";

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
    print: "พิมพ์ / PDF",
    docLang: "ภาษาเอกสาร",
    receipts: "ใบเสร็จ",
    locked: "เอกสารที่ออกแล้วถูกล็อก แก้ไขได้เฉพาะฉบับร่าง",
    // bill-to
    billTo: "ลูกค้า (ผู้รับใบกำกับภาษี)",
    companyEn: "ชื่อบริษัท (อังกฤษ)",
    companyTh: "ชื่อบริษัท (ไทย)",
    branch: "สาขา",
    contactName: "ชื่อผู้ติดต่อ / ลูกค้า",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    addressEn: "ที่อยู่ (อังกฤษ)",
    addressTh: "ที่อยู่ (ไทย)",
    phone: "โทรศัพท์",
    email: "อีเมล",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    // items
    items: "รายการ",
    description: "รายละเอียด",
    qty: "จำนวน",
    unitPrice: "ราคา/หน่วย",
    lineTotal: "รวม",
    isDiscount: "ส่วนลด",
    addRow: "เพิ่มรายการ",
    saveItems: "บันทึกรายการ",
    remove: "ลบ",
    // tax & terms
    taxTerms: "ภาษี ส่วนลด และเงื่อนไข",
    vatRate: "อัตราภาษี (%)",
    vatInclusive: "ราคารวมภาษีแล้ว",
    discount: "ส่วนลด (ก่อนภาษี)",
    dueDate: "ครบกำหนดชำระ",
    footer: "ข้อความท้ายเอกสาร",
    saveTerms: "บันทึก",
    // totals
    subtotal: "ยอดก่อนภาษี",
    vat: "ภาษีมูลค่าเพิ่ม",
    incl: "(รวมแล้ว)",
    total: "ยอดรวม",
    paid: "ชำระแล้ว",
    balance: "คงเหลือ",
    issue: "ออกใบกำกับภาษี",
    issued: "ออกใบแล้ว",
    recordPayment: "บันทึกการชำระเงิน",
    void: "ยกเลิกใบ",
    // void modal
    voidTitle: "ยกเลิกใบแจ้งหนี้",
    voidReason: "เหตุผลในการยกเลิก (บันทึกไว้ตรวจสอบ)",
    voidReasonPh: "เช่น ออกผิด ลูกค้ายกเลิก…",
    voided: "ยกเลิกแล้ว",
    voidedAt: "ยกเลิกเมื่อ",
    // payment modal
    amount: "จำนวนเงิน",
    method: "วิธีชำระ",
    reference: "อ้างอิง (เลขสลิป / 4 ตัวท้ายบัตร)",
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
    print: "Print / PDF",
    docLang: "Document language",
    receipts: "Receipts",
    locked: "Issued documents are locked — only drafts are editable.",
    billTo: "Bill to (tax-invoice recipient)",
    companyEn: "Company name — English",
    companyTh: "Company name — Thai",
    branch: "Branch",
    contactName: "Contact / guest name",
    taxId: "Tax ID",
    addressEn: "Address — English",
    addressTh: "Address — Thai",
    phone: "Phone",
    email: "Email",
    save: "Save",
    saved: "Saved",
    items: "Items",
    description: "Description",
    qty: "Qty",
    unitPrice: "Unit price",
    lineTotal: "Total",
    isDiscount: "Disc.",
    addRow: "Add row",
    saveItems: "Save items",
    remove: "Remove",
    taxTerms: "Tax, discount & terms",
    vatRate: "VAT rate (%)",
    vatInclusive: "VAT-inclusive prices",
    discount: "Discount (before VAT)",
    dueDate: "Due date",
    footer: "Printed footer",
    saveTerms: "Save",
    subtotal: "Subtotal",
    vat: "VAT",
    incl: "(incl.)",
    total: "Total",
    paid: "Paid",
    balance: "Balance",
    issue: "Issue invoice",
    issued: "Issued",
    recordPayment: "Record payment",
    void: "Void",
    voidTitle: "Void invoice",
    voidReason: "Reason for voiding (recorded for audit)",
    voidReasonPh: "e.g. issued in error, guest cancelled…",
    voided: "Voided",
    voidedAt: "Voided at",
    amount: "Amount",
    method: "Method",
    reference: "Reference (slip no., card last 4…)",
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

  // Only a draft is editable. Issued / partial / paid are locked numbered
  // documents — fields read-only, line items + tax/terms hidden. void too.
  const editable = invoice.status === "draft";
  const isVoid = invoice.status === "void";
  const issued = !!invoice.number;

  // Print/document language — defaults to the app locale; operator can flip
  // it per-print without changing the whole UI language.
  const [docLang, setDocLang] = useState<"th" | "en">(locale === "en" ? "en" : "th");

  // Full Thai B2B bill-to form state.
  const [guest, setGuest] = useState({
    guest_company_name: invoice.guest_company_name ?? "",
    guest_company_name_th: invoice.guest_company_name_th ?? "",
    guest_branch: invoice.guest_branch ?? "",
    guest_name: invoice.guest_name,
    guest_tax_id: invoice.guest_tax_id ?? "",
    guest_address: invoice.guest_address ?? "",
    guest_address_th: invoice.guest_address_th ?? "",
    guest_phone: invoice.guest_phone ?? "",
    guest_email: invoice.guest_email ?? "",
  });

  // Tax & terms form state.
  const [terms, setTerms] = useState({
    vat_rate: invoice.vat_rate as number | "",
    vat_inclusive:
      invoice.vat_inclusive == null ? property.vat_inclusive : !!invoice.vat_inclusive,
    discount: (invoice.discount ?? 0) as number | "",
    due_date: invoice.due_date ?? "",
    footer: invoice.footer ?? "",
  });

  const [rows, setRows] = useState<ItemRow[]>(toRows(items));
  const [savingGuest, setSavingGuest] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  // Payment modal.
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({
    amount: "" as number | "",
    method: "cash",
    reference: "",
    note: "",
  });

  // Void modal (captures a reason).
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const money = (n: number) =>
    `${invoice.currency} ${Number(n).toLocaleString(locale === "en" ? "en-US" : "th-TH")}`;
  const statusLabel = (s: InvoiceStatus) => tr[`st_${s}` as keyof typeof tr] as string;
  const lineTotal = (r: ItemRow) => (Number(r.qty) || 0) * (Number(r.unit_price) || 0);

  async function onSaveGuest() {
    setSavingGuest(true);
    const res = await saveInvoiceMeta(invoice.id, {
      guest_company_name: guest.guest_company_name.trim() || null,
      guest_company_name_th: guest.guest_company_name_th.trim() || null,
      guest_branch: guest.guest_branch.trim() || null,
      guest_name: guest.guest_name.trim() || "Guest",
      guest_tax_id: guest.guest_tax_id.trim() || null,
      guest_address: guest.guest_address.trim() || null,
      guest_address_th: guest.guest_address_th.trim() || null,
      guest_phone: guest.guest_phone.trim() || null,
      guest_email: guest.guest_email.trim() || null,
    });
    setSavingGuest(false);
    if (res.ok) {
      toast.success(tr.saved);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function onSaveTerms() {
    setSavingTerms(true);
    const res = await saveInvoiceMeta(invoice.id, {
      vat_inclusive: terms.vat_inclusive,
      discount: Number(terms.discount) || 0,
      due_date: terms.due_date || null,
      footer: terms.footer.trim() || null,
    });
    setSavingTerms(false);
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
    const note = [pay.reference.trim() ? `Ref: ${pay.reference.trim()}` : "", pay.note.trim()]
      .filter(Boolean)
      .join(" · ");
    const res = await recordPaymentAction(invoice.id, amount, pay.method, note || undefined);
    setBusy(false);
    if (res.ok) {
      toast.success(`${tr.receiptIssued} · ${res.data.receiptNumber}`);
      setPayOpen(false);
      setPay({ amount: "", method: "cash", reference: "", note: "" });
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function onVoid() {
    setBusy(true);
    const res = await voidInvoiceAction(invoice.id, voidReason.trim() || undefined);
    setBusy(false);
    if (res.ok) {
      toast.success(tr.voided);
      setVoidOpen(false);
      setVoidReason("");
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

  const printHref = `/print/invoice/${invoice.id}?lang=${docLang}`;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {invoice.number ?? <span className="text-[var(--app-fg-muted)]">{tr.draft}</span>}
        </h1>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
          style={{
            background: STATUS_COLOR[invoice.status],
            textDecoration: invoice.status === "void" ? "line-through" : "none",
          }}
        >
          {!editable && !isVoid && <Lock size={11} />}
          {statusLabel(invoice.status)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* Doc-language toggle for the print output */}
          <label className="flex items-center gap-1.5 text-xs text-[var(--app-fg-muted)]">
            {tr.docLang}
            <select
              value={docLang}
              onChange={(e) => setDocLang(e.target.value as "th" | "en")}
              className={field}
            >
              <option value="th">TH</option>
              <option value="en">EN</option>
            </select>
          </label>
          <a
            href={printHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] px-4 text-sm font-medium transition-colors hover:bg-[var(--app-surface-2)]"
          >
            <Printer size={15} /> {tr.print}
          </a>
        </div>
      </div>

      {/* Locked / void notice */}
      {!editable && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-2.5 text-sm text-[var(--app-fg-muted)]">
          <Lock size={14} />
          {isVoid && invoice.void_reason
            ? `${tr.voided}: ${invoice.void_reason}`
            : tr.locked}
          {isVoid && invoice.voided_at && (
            <span className="ml-auto text-xs">
              {tr.voidedAt} {invoice.voided_at.slice(0, 10)}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: bill-to + tax/terms + items (2 cols) */}
        <div className="space-y-4 lg:col-span-2">
          {/* Bill-to box — full Thai B2B */}
          <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
            <h2 className="mb-3 text-sm font-semibold">{tr.billTo}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={tr.companyEn}>
                <input
                  className={`${field} w-full`}
                  value={guest.guest_company_name}
                  disabled={!editable}
                  onChange={(e) => setGuest({ ...guest, guest_company_name: e.target.value })}
                />
              </Field>
              <Field label={tr.companyTh}>
                <input
                  className={`${field} w-full`}
                  value={guest.guest_company_name_th}
                  disabled={!editable}
                  onChange={(e) => setGuest({ ...guest, guest_company_name_th: e.target.value })}
                />
              </Field>
              <Field label={tr.branch}>
                <input
                  className={`${field} w-full`}
                  value={guest.guest_branch}
                  disabled={!editable}
                  onChange={(e) => setGuest({ ...guest, guest_branch: e.target.value })}
                />
              </Field>
              <Field label={tr.contactName}>
                <input
                  className={`${field} w-full`}
                  value={guest.guest_name}
                  disabled={!editable}
                  onChange={(e) => setGuest({ ...guest, guest_name: e.target.value })}
                />
              </Field>
              <Field label={tr.taxId}>
                <input
                  className={`${field} w-full`}
                  value={guest.guest_tax_id}
                  disabled={!editable}
                  onChange={(e) => setGuest({ ...guest, guest_tax_id: e.target.value })}
                />
              </Field>
              <Field label={tr.phone}>
                <input
                  className={`${field} w-full`}
                  value={guest.guest_phone}
                  disabled={!editable}
                  onChange={(e) => setGuest({ ...guest, guest_phone: e.target.value })}
                />
              </Field>
              <Field label={tr.addressEn}>
                <textarea
                  rows={2}
                  className={`${field} w-full`}
                  value={guest.guest_address}
                  disabled={!editable}
                  onChange={(e) => setGuest({ ...guest, guest_address: e.target.value })}
                />
              </Field>
              <Field label={tr.addressTh}>
                <textarea
                  rows={2}
                  className={`${field} w-full`}
                  value={guest.guest_address_th}
                  disabled={!editable}
                  onChange={(e) => setGuest({ ...guest, guest_address_th: e.target.value })}
                />
              </Field>
              <Field label={tr.email}>
                <input
                  className={`${field} w-full`}
                  value={guest.guest_email}
                  disabled={!editable}
                  onChange={(e) => setGuest({ ...guest, guest_email: e.target.value })}
                />
              </Field>
            </div>
            {editable && (
              <div className="mt-3">
                <Button variant="ghost" size="sm" onClick={onSaveGuest} loading={savingGuest}>
                  {tr.save}
                </Button>
              </div>
            )}
          </div>

          {/* Tax & terms — draft only (locked doc = numbered, immutable totals) */}
          {editable && (
            <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
              <h2 className="mb-3 text-sm font-semibold">{tr.taxTerms}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={tr.vatRate}>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={`${field} w-full`}
                    value={terms.vat_rate}
                    onChange={(e) =>
                      setTerms({
                        ...terms,
                        vat_rate: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label={tr.discount}>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={`${field} w-full`}
                    value={terms.discount}
                    onChange={(e) =>
                      setTerms({
                        ...terms,
                        discount: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label={tr.dueDate}>
                  <input
                    type="date"
                    className={`${field} w-full`}
                    value={terms.due_date}
                    onChange={(e) => setTerms({ ...terms, due_date: e.target.value })}
                  />
                </Field>
                <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={terms.vat_inclusive}
                    onChange={(e) => setTerms({ ...terms, vat_inclusive: e.target.checked })}
                  />
                  {tr.vatInclusive}
                </label>
                <Field label={tr.footer} className="sm:col-span-2">
                  <textarea
                    rows={2}
                    className={`${field} w-full`}
                    value={terms.footer}
                    onChange={(e) => setTerms({ ...terms, footer: e.target.value })}
                  />
                </Field>
              </div>
              <div className="mt-3">
                <Button variant="ghost" size="sm" onClick={onSaveTerms} loading={savingTerms}>
                  {tr.saveTerms}
                </Button>
              </div>
            </div>
          )}

          {/* Items editor — draft only */}
          {editable && (
            <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
              <h2 className="mb-3 text-sm font-semibold">{tr.items}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                      <th className="py-2 pr-2 font-medium">{tr.description}</th>
                      <th className="py-2 px-2 text-right font-medium">{tr.qty}</th>
                      <th className="py-2 px-2 text-right font-medium">{tr.unitPrice}</th>
                      <th className="py-2 px-2 text-center font-medium">{tr.isDiscount}</th>
                      <th className="py-2 pl-2 text-right font-medium">{tr.lineTotal}</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={idx} className="border-t border-[var(--app-border)]">
                        <td className="py-2 pr-2">
                          <input
                            className={`${field} w-full`}
                            value={r.description}
                            onChange={(e) => setRow(idx, { description: e.target.value })}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min={0}
                            className={`${field} w-20 text-right`}
                            value={r.qty}
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
                            onChange={(e) => setRow(idx, { is_discount: e.target.checked })}
                          />
                        </td>
                        <td className="py-2 pl-2 text-right whitespace-nowrap">
                          {r.is_discount ? "−" : ""}
                          {money(lineTotal(r))}
                        </td>
                        <td className="py-2 pl-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            aria-label={tr.remove}
                            className="text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={addRow}>
                  <Plus size={15} /> {tr.addRow}
                </Button>
                <Button size="sm" onClick={onSaveItems} loading={savingItems}>
                  {tr.saveItems}
                </Button>
              </div>
            </div>
          )}

          {/* Read-only item list for locked / void invoices */}
          {!editable && items.length > 0 && (
            <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
              <h2 className="mb-3 text-sm font-semibold">{tr.items}</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                    <th className="py-2 pr-2 font-medium">{tr.description}</th>
                    <th className="py-2 px-2 text-right font-medium">{tr.qty}</th>
                    <th className="py-2 px-2 text-right font-medium">{tr.unitPrice}</th>
                    <th className="py-2 pl-2 text-right font-medium">{tr.lineTotal}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t border-[var(--app-border)]">
                      <td className="py-2 pr-2">{it.description}</td>
                      <td className="py-2 px-2 text-right">{it.qty}</td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        {money(it.unit_price)}
                      </td>
                      <td className="py-2 pl-2 text-right whitespace-nowrap">
                        {it.is_discount ? "−" : ""}
                        {money(it.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: totals + actions + receipts */}
        <div className="space-y-4">
          <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--app-fg-muted)]">{tr.subtotal}</dt>
                <dd>{money(invoice.subtotal)}</dd>
              </div>
              {Number(invoice.discount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-[var(--app-fg-muted)]">{tr.discount}</dt>
                  <dd>− {money(invoice.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-[var(--app-fg-muted)]">
                  {tr.vat} ({invoice.vat_rate}%)
                  {invoice.vat_inclusive ? ` ${tr.incl}` : ""}
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

            <div className="mt-4 space-y-2">
              {editable && (
                <Button className="w-full" onClick={onIssue} loading={busy} disabled={issued}>
                  {issued ? tr.issued : tr.issue}
                </Button>
              )}
              {!isVoid && (
                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() => {
                    setPay({
                      amount: invoice.balance > 0 ? invoice.balance : "",
                      method: "cash",
                      reference: "",
                      note: "",
                    });
                    setPayOpen(true);
                  }}
                >
                  {tr.recordPayment}
                </Button>
              )}
              {!isVoid && (
                <Button
                  className="w-full"
                  variant="danger"
                  onClick={() => {
                    setVoidReason("");
                    setVoidOpen(true);
                  }}
                >
                  {tr.void}
                </Button>
              )}
            </div>
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
                      href={`/print/receipt/${rc.id}?lang=${docLang}`}
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
          <Field label={tr.amount}>
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
          </Field>
          <Field label={tr.method}>
            <select
              className={`${field} w-full`}
              value={pay.method}
              onChange={(e) => setPay({ ...pay, method: e.target.value })}
            >
              <option value="cash">{tr.cash}</option>
              <option value="transfer">{tr.transfer}</option>
              <option value="card">{tr.card}</option>
            </select>
          </Field>
          <Field label={tr.reference}>
            <input
              className={`${field} w-full`}
              value={pay.reference}
              onChange={(e) => setPay({ ...pay, reference: e.target.value })}
            />
          </Field>
          <Field label={tr.note}>
            <input
              className={`${field} w-full`}
              value={pay.note}
              onChange={(e) => setPay({ ...pay, note: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      {/* Void modal — captures a reason for the audit trail */}
      <Modal
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        title={tr.voidTitle}
        footer={
          <>
            <Button variant="ghost" onClick={() => setVoidOpen(false)}>
              {tr.cancel}
            </Button>
            <Button variant="danger" onClick={onVoid} loading={busy}>
              {tr.void}
            </Button>
          </>
        }
      >
        <Field label={tr.voidReason}>
          <textarea
            rows={3}
            autoFocus
            placeholder={tr.voidReasonPh}
            className={`${field} w-full`}
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">{label}</label>
      {children}
    </div>
  );
}
