"use client";

// Sales-document editor. Header (customer picker + inline create, dates/credit
// days, VAT-inclusive toggle, header discount, notes) + line items with live
// totals (computeTotals mirrors the DB trigger exactly). Drafts are editable;
// once submitted the form goes read-only and only the action rail changes state
// (submit → approve/reject → convert to a tax invoice). Credit/debit notes pick
// a reference invoice and pre-fill from it.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Printer, Trash2, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import Button from "@/components/app/ui/Button";
import Modal from "@/components/app/ui/Modal";
import { useToast } from "@/components/app/ui/Toast";
import { computeTotals } from "@/lib/accounting/money";
import { docStatusMeta, DOC_TYPES, dueDateFrom } from "@/lib/accounting/documents";
import type { SalesDocument, SalesDocumentItem, DocItemInput } from "@/lib/db/documents";
import type { Contact } from "@/lib/db/contacts";
import type { Invoice } from "@/lib/db/invoices";
import type { TenantRole } from "@/lib/active-role-server";
import {
  saveDocumentAction,
  submitDocumentAction,
  decideDocumentAction,
  voidDocumentAction,
  convertToInvoiceAction,
  cloneToBillingNoteAction,
  createCustomerAction,
  loadCreditDebitPrefillAction,
} from "@/app/app/documents/actions";

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

const STR = {
  th: {
    back: "กลับ", save: "บันทึกร่าง", saved: "บันทึกแล้ว", submit: "ส่งอนุมัติ", approve: "อนุมัติ",
    reject: "ไม่อนุมัติ", process: "ทำรายการ", voidBtn: "ยกเลิก", convert: "ออกใบกำกับภาษี",
    clone: "แปลงเป็นใบวางบิล", print: "พิมพ์", customer: "ลูกค้า", pickCustomer: "เลือกลูกค้า…",
    newCustomer: "ลูกค้าใหม่", companyTh: "ชื่อบริษัท (ไทย)", companyEn: "ชื่อบริษัท (อังกฤษ)",
    contactName: "ชื่อผู้ติดต่อ", taxId: "เลขผู้เสียภาษี", branch: "สาขา", address: "ที่อยู่",
    phone: "โทรศัพท์", email: "อีเมล", issueDate: "วันที่", dueDate: "ครบกำหนด", creditDays: "เครดิต (วัน)",
    vatIncl: "ราคารวม VAT", vatRate: "อัตรา VAT %", discount: "ส่วนลด", notes: "หมายเหตุ", reason: "เหตุผล",
    refInvoice: "อ้างอิงใบกำกับ", pickInvoice: "เลือกใบกำกับ…", items: "รายการ", desc: "รายละเอียด",
    unit: "หน่วย", qty: "จำนวน", price: "ราคา/หน่วย", amount: "จำนวนเงิน", addLine: "เพิ่มบรรทัด",
    subtotal: "ยอดรวม", net: "มูลค่าก่อนภาษี", vat: "ภาษีมูลค่าเพิ่ม", total: "รวมทั้งสิ้น",
    save2: "บันทึก", cancel: "ยกเลิก", create: "สร้าง", name: "ชื่อ", isCompany: "เป็นบริษัท",
    readonly: "เอกสารนี้ออกเลขแล้ว แก้ไขไม่ได้", converted: "แปลงเป็นใบกำกับแล้ว",
  },
  en: {
    back: "Back", save: "Save draft", saved: "Saved", submit: "Submit", approve: "Approve",
    reject: "Reject", process: "Process", voidBtn: "Void", convert: "Issue tax invoice",
    clone: "Convert to billing note", print: "Print", customer: "Customer", pickCustomer: "Pick a customer…",
    newCustomer: "New customer", companyTh: "Company name (TH)", companyEn: "Company name (EN)",
    contactName: "Contact name", taxId: "Tax ID", branch: "Branch", address: "Address",
    phone: "Phone", email: "Email", issueDate: "Issue date", dueDate: "Due date", creditDays: "Credit (days)",
    vatIncl: "VAT-inclusive prices", vatRate: "VAT rate %", discount: "Discount", notes: "Notes", reason: "Reason",
    refInvoice: "Reference invoice", pickInvoice: "Pick an invoice…", items: "Line items", desc: "Description",
    unit: "Unit", qty: "Qty", price: "Unit price", amount: "Amount", addLine: "Add line",
    subtotal: "Subtotal", net: "Net", vat: "VAT", total: "Total",
    save2: "Save", cancel: "Cancel", create: "Create", name: "Name", isCompany: "Is a company",
    readonly: "This document has a number and can no longer be edited.", converted: "Converted to a tax invoice.",
  },
} as const;

// Both language tables share their keys; widen values to string so STR[lang]
// (a th|en union) is assignable where a single-locale table is expected.
type Tr = { [K in keyof (typeof STR)["en"]]: string };

type Row = { description: string; unit: string; qty: string; unit_price: string };

const toRows = (items: SalesDocumentItem[]): Row[] =>
  items.length
    ? items.map((i) => ({ description: i.description, unit: i.unit ?? "", qty: String(i.qty), unit_price: String(i.unit_price) }))
    : [{ description: "", unit: "", qty: "1", unit_price: "" }];

export default function DocumentEditorClient({
  doc,
  items,
  customers,
  invoices,
  role,
  currency,
}: {
  doc: SalesDocument;
  items: SalesDocumentItem[];
  customers: Contact[];
  invoices: Invoice[];
  role: TenantRole | null;
  currency: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "th";
  const tr = STR[lang];

  const isApprover = role === "owner" || role === "admin";
  const editable = doc.status === "draft";
  const isCreditDebit = doc.doc_type === "credit-note" || doc.doc_type === "debit-note";
  const canConvert = ["quotation", "billing-note", "cash-sale"].includes(doc.doc_type) && !doc.converted_invoice_id;

  const [h, setH] = useState({
    contact_id: doc.contact_id ?? "",
    customer_name: doc.customer_name ?? "",
    customer_company_name: doc.customer_company_name ?? "",
    customer_company_name_th: doc.customer_company_name_th ?? "",
    customer_branch: doc.customer_branch ?? "",
    customer_tax_id: doc.customer_tax_id ?? "",
    customer_address: doc.customer_address ?? "",
    customer_phone: doc.customer_phone ?? "",
    customer_email: doc.customer_email ?? "",
    issue_date: doc.issue_date,
    due_date: doc.due_date ?? "",
    credit_days: String(doc.credit_days ?? 0),
    vat_rate: String(doc.vat_rate ?? 0),
    vat_inclusive: doc.vat_inclusive,
    discount: String(doc.discount ?? 0),
    notes: doc.notes ?? "",
    reason: doc.reason ?? "",
    ref_invoice_id: doc.ref_invoice_id ?? "",
  });
  const [rows, setRows] = useState<Row[]>(toRows(items));
  const [busy, setBusy] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [localCustomers, setLocalCustomers] = useState<Contact[]>(customers);
  const set = (k: keyof typeof h, v: string | boolean) => setH((s) => ({ ...s, [k]: v }));

  const totals = useMemo(
    () =>
      computeTotals({
        lines: rows.map((r) => ({ qty: r.qty, unit_price: r.unit_price })),
        discount: Number(h.discount) || 0,
        vatRate: Number(h.vat_rate) || 0,
        vatInclusive: h.vat_inclusive,
      }),
    [rows, h.discount, h.vat_rate, h.vat_inclusive]
  );

  const money = (n: number) => `${currency} ${Number(n).toLocaleString(lang === "en" ? "en-US" : "th-TH")}`;
  const meta = docStatusMeta(doc.status);
  const typeLabel = DOC_TYPES.find((d) => d.type === doc.doc_type);

  function pickCustomer(id: string) {
    const c = localCustomers.find((x) => x.id === id);
    if (!c) {
      set("contact_id", "");
      return;
    }
    setH((s) => ({
      ...s,
      contact_id: c.id,
      customer_name: c.is_company ? s.customer_name : c.name,
      customer_company_name: c.is_company ? c.name_en || c.name : "",
      customer_company_name_th: c.is_company ? c.name : "",
      customer_branch: c.branch ?? "",
      customer_tax_id: c.tax_id ?? "",
      customer_address: c.address ?? "",
      customer_phone: c.phone ?? "",
      customer_email: c.email ?? "",
      credit_days: String(c.credit_days ?? 0),
    }));
  }

  function headerPayload(): Record<string, unknown> {
    const due = h.due_date || dueDateFrom(h.issue_date, h.credit_days);
    return {
      doc_type: doc.doc_type,
      contact_id: h.contact_id || null,
      ref_invoice_id: h.ref_invoice_id || null,
      customer_name: h.customer_name || null,
      customer_company_name: h.customer_company_name || null,
      customer_company_name_th: h.customer_company_name_th || null,
      customer_branch: h.customer_branch || null,
      customer_tax_id: h.customer_tax_id || null,
      customer_address: h.customer_address || null,
      customer_phone: h.customer_phone || null,
      customer_email: h.customer_email || null,
      issue_date: h.issue_date,
      due_date: due || null,
      credit_days: Number(h.credit_days) || 0,
      vat_rate: Number(h.vat_rate) || 0,
      vat_inclusive: h.vat_inclusive,
      discount: Number(h.discount) || 0,
      notes: h.notes || null,
      reason: h.reason || null,
    };
  }

  function itemsPayload(): DocItemInput[] {
    return rows
      .filter((r) => r.description.trim() || Number(r.unit_price))
      .map((r, i) => ({
        sort_order: i,
        description: r.description.trim(),
        unit: r.unit.trim() || null,
        qty: Number(r.qty) || 0,
        unit_price: Number(r.unit_price) || 0,
      }));
  }

  async function save() {
    setBusy(true);
    const res = await saveDocumentAction(doc.id, headerPayload(), itemsPayload());
    setBusy(false);
    if (res.ok) {
      toast.success(tr.saved);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function run<T>(fn: () => Promise<{ ok: true; data: T } | { ok: false; code: string; message: string }>, after?: (d: T) => void) {
    setBusy(true);
    // Persist any pending edits first so the action sees the latest state.
    if (editable) await saveDocumentAction(doc.id, headerPayload(), itemsPayload());
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      after?.(res.data);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function addCustomer(input: { name: string; is_company: boolean; tax_id: string; branch: string; phone: string }) {
    const res = await createCustomerAction({ ...input, kind: "customer" });
    if (!res.ok) {
      toast.error(`${res.code} · ${res.message}`);
      return;
    }
    const c: Contact = {
      id: res.data.id, tenant_id: doc.tenant_id, property_id: doc.property_id, kind: "customer",
      is_company: input.is_company, name: res.data.name, name_en: null, tax_id: input.tax_id || null,
      branch: input.branch || null, address: null, zipcode: null, email: null, phone: input.phone || null,
      credit_days: 0, notes: null, active: true, created_at: new Date().toISOString(),
    };
    setLocalCustomers((l) => [c, ...l]);
    pickCustomer(c.id);
    setCustOpen(false);
  }

  async function pickRefInvoice(invoiceId: string) {
    set("ref_invoice_id", invoiceId);
    if (!invoiceId) return;
    const res = await loadCreditDebitPrefillAction(invoiceId, doc.doc_type as "credit-note" | "debit-note");
    if (!res.ok) {
      toast.error(`${res.code} · ${res.message}`);
      return;
    }
    const p = res.data as Record<string, unknown>;
    setH((s) => ({
      ...s,
      ref_invoice_id: invoiceId,
      contact_id: (p.contact_id as string) || "",
      customer_name: (p.customer_name as string) || "",
      customer_company_name: (p.customer_company_name as string) || "",
      customer_company_name_th: (p.customer_company_name_th as string) || "",
      customer_branch: (p.customer_branch as string) || "",
      customer_tax_id: (p.customer_tax_id as string) || "",
      customer_address: (p.customer_address as string) || "",
      vat_rate: String((p.vat_rate as number) ?? s.vat_rate),
      vat_inclusive: !!p.vat_inclusive,
    }));
    const pItems = (p.items as { description?: string; unit?: string; qty?: number; unit_price?: number }[]) || [];
    if (pItems.length)
      setRows(pItems.map((it) => ({ description: it.description || "", unit: it.unit || "", qty: String(it.qty ?? 1), unit_price: String(it.unit_price ?? 0) })));
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Header rail */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={() => router.push("/app/documents")} className="flex items-center gap-1 text-sm text-[var(--app-fg-muted)] hover:text-[var(--app-fg)]">
          <ArrowLeft size={16} /> {tr.back}
        </button>
        <h1 className="text-xl font-semibold tracking-tight">
          {lang === "en" ? typeLabel?.en : typeLabel?.th} · {doc.number ?? (lang === "en" ? "Draft" : "ฉบับร่าง")}
        </h1>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ background: meta.color }}>
          {lang === "en" ? meta.en : meta.th}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {doc.number && (
            <a href={`/print/document/${doc.id}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost"><Printer size={14} /> {tr.print}</Button>
            </a>
          )}
          {editable && <Button size="sm" variant="ghost" onClick={save} loading={busy}>{tr.save}</Button>}
          {editable && <Button size="sm" onClick={() => run(() => submitDocumentAction(doc.id))} loading={busy}>{tr.submit}</Button>}
          {doc.status === "awaiting" && isApprover && (
            <>
              <Button size="sm" variant="ghost" onClick={() => run(() => decideDocumentAction(doc.id, "rejected"))} loading={busy}>{tr.reject}</Button>
              <Button size="sm" onClick={() => run(() => decideDocumentAction(doc.id, "approved"))} loading={busy}>{tr.approve}</Button>
            </>
          )}
          {doc.doc_type === "quotation" && doc.status !== "void" && (
            <Button size="sm" variant="ghost" onClick={() => run(() => cloneToBillingNoteAction(doc.id), (d) => router.push(`/app/documents/${(d as { id: string }).id}`))} loading={busy}>{tr.clone}</Button>
          )}
          {canConvert && (doc.status === "approved" || doc.doc_type === "cash-sale") && (
            <Button size="sm" onClick={() => run(() => convertToInvoiceAction(doc.id), (d) => router.push(`/app/invoices/${(d as { invoiceId: string }).invoiceId}`))} loading={busy}>{tr.convert}</Button>
          )}
          {isApprover && doc.status !== "void" && (
            <Button size="sm" variant="danger" onClick={() => run(() => voidDocumentAction(doc.id))} loading={busy}>{tr.voidBtn}</Button>
          )}
        </div>
      </div>

      {!editable && (
        <p className="mb-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2 text-xs text-[var(--app-fg-muted)]">
          {doc.converted_invoice_id ? tr.converted : tr.readonly}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Customer + meta */}
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <label className={label + " mb-0 flex-1"}>{tr.customer}</label>
            {editable && (
              <button onClick={() => setCustOpen(true)} className="flex items-center gap-1 text-xs text-[var(--app-accent)]">
                <UserPlus size={13} /> {tr.newCustomer}
              </button>
            )}
          </div>
          {editable && (
            <select value={h.contact_id} onChange={(e) => pickCustomer(e.target.value)} className={field + " mb-3"}>
              <option value="">{tr.pickCustomer}</option>
              {localCustomers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.tax_id ? ` · ${c.tax_id}` : ""}</option>
              ))}
            </select>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label}>{tr.contactName}</label><input disabled={!editable} value={h.customer_name} onChange={(e) => set("customer_name", e.target.value)} className={field} /></div>
            <div><label className={label}>{tr.companyTh}</label><input disabled={!editable} value={h.customer_company_name_th} onChange={(e) => set("customer_company_name_th", e.target.value)} className={field} /></div>
            <div><label className={label}>{tr.companyEn}</label><input disabled={!editable} value={h.customer_company_name} onChange={(e) => set("customer_company_name", e.target.value)} className={field} /></div>
            <div><label className={label}>{tr.taxId}</label><input disabled={!editable} value={h.customer_tax_id} onChange={(e) => set("customer_tax_id", e.target.value)} className={field} /></div>
            <div><label className={label}>{tr.branch}</label><input disabled={!editable} value={h.customer_branch} onChange={(e) => set("customer_branch", e.target.value)} className={field} /></div>
            <div><label className={label}>{tr.phone}</label><input disabled={!editable} value={h.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} className={field} /></div>
            <div className="sm:col-span-2"><label className={label}>{tr.address}</label><textarea disabled={!editable} value={h.customer_address} onChange={(e) => set("customer_address", e.target.value)} rows={2} className={field} /></div>
          </div>
          {isCreditDebit && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>{tr.refInvoice}</label>
                <select disabled={!editable} value={h.ref_invoice_id} onChange={(e) => pickRefInvoice(e.target.value)} className={field}>
                  <option value="">{tr.pickInvoice}</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.number ?? inv.id.slice(0, 8)} · {inv.guest_name}</option>
                  ))}
                </select>
              </div>
              <div><label className={label}>{tr.reason}</label><input disabled={!editable} value={h.reason} onChange={(e) => set("reason", e.target.value)} className={field} /></div>
            </div>
          )}
        </div>

        {/* Dates + VAT */}
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
          <div className="grid gap-3">
            <div><label className={label}>{tr.issueDate}</label><input type="date" disabled={!editable} value={h.issue_date} onChange={(e) => set("issue_date", e.target.value)} className={field} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={label}>{tr.creditDays}</label><input type="number" disabled={!editable} value={h.credit_days} onChange={(e) => set("credit_days", e.target.value)} className={field} /></div>
              <div><label className={label}>{tr.dueDate}</label><input type="date" disabled={!editable} value={h.due_date} onChange={(e) => set("due_date", e.target.value)} className={field} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={label}>{tr.vatRate}</label><input type="number" step="0.01" disabled={!editable} value={h.vat_rate} onChange={(e) => set("vat_rate", e.target.value)} className={field} /></div>
              <div><label className={label}>{tr.discount}</label><input type="number" step="0.01" disabled={!editable} value={h.discount} onChange={(e) => set("discount", e.target.value)} className={field} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={!editable} checked={h.vat_inclusive} onChange={(e) => set("vat_inclusive", e.target.checked)} /> {tr.vatIncl}
            </label>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="app-surface mt-4 overflow-x-auto rounded-2xl border border-[var(--app-border)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">{tr.items}</span>
          {editable && (
            <Button size="sm" variant="ghost" onClick={() => setRows((r) => [...r, { description: "", unit: "", qty: "1", unit_price: "" }])}>
              <Plus size={14} /> {tr.addLine}
            </Button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
              <th className="py-1.5 pr-2 font-medium">{tr.desc}</th>
              <th className="py-1.5 px-2 font-medium">{tr.unit}</th>
              <th className="py-1.5 px-2 text-right font-medium">{tr.qty}</th>
              <th className="py-1.5 px-2 text-right font-medium">{tr.price}</th>
              <th className="py-1.5 pl-2 text-right font-medium">{tr.amount}</th>
              {editable && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const amt = (Number(r.qty) || 0) * (Number(r.unit_price) || 0);
              return (
                <tr key={i} className="border-t border-[var(--app-border)]">
                  <td className="py-1.5 pr-2"><input disabled={!editable} value={r.description} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className={field} /></td>
                  <td className="py-1.5 px-2"><input disabled={!editable} value={r.unit} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} className={field + " w-16"} /></td>
                  <td className="py-1.5 px-2"><input type="number" step="0.01" disabled={!editable} value={r.qty} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className={field + " w-20 text-right"} /></td>
                  <td className="py-1.5 px-2"><input type="number" step="0.01" disabled={!editable} value={r.unit_price} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} className={field + " w-28 text-right"} /></td>
                  <td className="py-1.5 pl-2 text-right whitespace-nowrap">{money(Math.round(amt * 100) / 100)}</td>
                  {editable && (
                    <td className="text-right">
                      <button onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))} className="text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"><Trash2 size={15} /></button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <table className="w-64 text-sm">
            <tbody>
              <tr><td className="py-1 text-[var(--app-fg-muted)]">{tr.subtotal}</td><td className="py-1 text-right">{money(totals.subtotal)}</td></tr>
              {Number(h.discount) > 0 && <tr><td className="py-1 text-[var(--app-fg-muted)]">{tr.discount}</td><td className="py-1 text-right">− {money(Number(h.discount))}</td></tr>}
              <tr><td className="py-1 text-[var(--app-fg-muted)]">{tr.net}</td><td className="py-1 text-right">{money(totals.net)}</td></tr>
              <tr><td className="py-1 text-[var(--app-fg-muted)]">{tr.vat} ({h.vat_rate}%){h.vat_inclusive ? "" : ""}</td><td className="py-1 text-right">{money(totals.vat)}</td></tr>
              <tr className="border-t border-[var(--app-border)] font-bold"><td className="py-2">{tr.total}</td><td className="py-2 text-right">{money(totals.total)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3">
          <label className={label}>{tr.notes}</label>
          <textarea disabled={!editable} value={h.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={field} />
        </div>
      </div>

      <NewCustomerModal open={custOpen} onClose={() => setCustOpen(false)} tr={tr} onCreate={addCustomer} />
    </div>
  );
}

function NewCustomerModal({
  open, onClose, tr, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  tr: Tr;
  onCreate: (i: { name: string; is_company: boolean; tax_id: string; branch: string; phone: string }) => void;
}) {
  const [name, setName] = useState("");
  const [isCompany, setIsCompany] = useState(false);
  const [taxId, setTaxId] = useState("");
  const [branch, setBranch] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={tr.newCustomer}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>{tr.cancel}</Button><Button size="sm" onClick={() => name.trim() && onCreate({ name: name.trim(), is_company: isCompany, tax_id: taxId, branch, phone })}>{tr.create}</Button></>}>
      <div className="grid gap-3">
        <div><label className={label}>{tr.name}</label><input value={name} onChange={(e) => setName(e.target.value)} className={field} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} /> {tr.isCompany}</label>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>{tr.taxId}</label><input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={field} /></div>
          <div><label className={label}>{tr.branch}</label><input value={branch} onChange={(e) => setBranch(e.target.value)} className={field} /></div>
        </div>
        <div><label className={label}>{tr.phone}</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} /></div>
      </div>
    </Modal>
  );
}
