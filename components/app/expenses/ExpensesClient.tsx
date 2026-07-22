"use client";

// Expenses (AP) + withholding-tax (WHT) console. Two pill tabs: a searchable/
// filterable expense register with an editor modal (vendor picker + inline
// create, VAT + WHT math, receipt upload, draft → pending → paid lifecycle),
// and a WHT certificate register with a "from a paid expense" prefill flow
// plus PND3/PND53 CSV + RD-Prep .txt export for filing.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Receipt,
  FileSpreadsheet,
  UserPlus,
  Trash2,
  Printer,
  Paperclip,
  Download,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import Button from "@/components/app/ui/Button";
import Modal from "@/components/app/ui/Modal";
import EmptyState from "@/components/app/ui/EmptyState";
import { useToast } from "@/components/app/ui/Toast";
import {
  computeExpenseTotals,
  EXPENSE_STATUSES,
  expenseStatusMeta,
  PND_TYPES,
  pndTypeMeta,
  INCOME_TYPES,
  WHT_RATE_OPTIONS,
  whtAmountFor,
  whtCertPrefillFromExpense,
  newWhtCertDraft,
  buildRdPrepTxt,
  todayBkk,
  type WhtRowInput,
} from "@/lib/accounting/expenses";
import {
  newExpense,
  loadExpenseDetail,
  saveExpenseHeader,
  saveExpenseItemsAction,
  markExpensePaid,
  setExpenseStatusAction,
  voidExpenseAction,
  uploadReceipt,
  getReceiptUrl,
  createVendorContact,
  newWht,
  voidWhtAction,
} from "@/app/app/expenses/actions";
import type {
  Expense,
  ExpenseItem,
  ExpenseStatus,
  ExpenseHeaderInput,
  ExpenseItemInput,
  WhtCertificate,
  WhtInput,
  PndType,
} from "@/lib/db/expenses";
import type { Contact, ContactInput } from "@/lib/db/contacts";

const field =
  "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

const STR = {
  th: {
    pageTitle: "ค่าใช้จ่ายและภาษีหัก ณ ที่จ่าย",
    tabExpenses: "ค่าใช้จ่าย",
    tabWht: "ภาษีหัก ณ ที่จ่าย",
    search: "ค้นหาผู้ขาย / รายละเอียด / เลขที่เอกสาร",
    all: "ทั้งหมด",
    newExpense: "สร้างค่าใช้จ่าย",
    count: "รายการ",
    colDate: "วันที่",
    colVendor: "ผู้ขาย / รายละเอียด",
    colTotal: "ยอดรวม",
    colWht: "หัก ณ ที่จ่าย",
    colStatus: "สถานะ",
    emptyExpenses: "ยังไม่มีค่าใช้จ่าย",
    emptyExpensesHint: "บันทึกบิลค่าใช้จ่ายใบแรกของคุณ",
    editExpenseTitle: "แก้ไขค่าใช้จ่าย",
    newExpenseTitle: "ค่าใช้จ่ายใหม่",
    vendorLabel: "ผู้ขาย",
    pickVendor: "เลือกผู้ขาย…",
    newVendor: "ผู้ขายใหม่",
    expenseDate: "วันที่",
    docRef: "เลขที่เอกสาร",
    description: "รายละเอียด",
    categoryCode: "รหัสบัญชีค่าใช้จ่าย",
    vatRate: "อัตรา VAT %",
    vatInclusive: "ราคารวม VAT",
    whtRate: "อัตราหัก ณ ที่จ่าย",
    notes: "หมายเหตุ",
    items: "รายการสินค้า/บริการ",
    descCol: "รายละเอียด",
    unitCol: "หน่วย",
    qtyCol: "จำนวน",
    priceCol: "ราคา/หน่วย",
    amountCol: "จำนวนเงิน",
    addLine: "เพิ่มบรรทัด",
    subtotal: "ยอดรวม",
    net: "มูลค่าก่อนภาษี",
    vat: "ภาษีมูลค่าเพิ่ม",
    total: "รวมทั้งสิ้น",
    whtAmount: "ภาษีหัก ณ ที่จ่าย",
    netPayable: "ยอดสุทธิที่ต้องจ่าย",
    receipt: "ใบเสร็จ/ใบกำกับ",
    uploadReceipt: "แนบไฟล์",
    viewReceipt: "ดูใบเสร็จ",
    receiptHint: "บันทึกร่างก่อนเพื่อแนบไฟล์",
    save: "บันทึก",
    saved: "บันทึกแล้ว",
    markPending: "รอจ่าย",
    markPaid: "จ่ายแล้ว",
    confirmPaid: "ยืนยันจ่ายแล้ว",
    paymentMethod: "วิธีชำระ",
    paymentRef: "เลขที่อ้างอิง",
    paidAt: "วันที่จ่าย",
    voidBtn: "ยกเลิก",
    close: "ปิด",
    cancel: "ยกเลิก",
    create: "สร้าง",
    name: "ชื่อ",
    isCompany: "เป็นบริษัท",
    taxId: "เลขผู้เสียภาษี",
    branch: "สาขา",
    phone: "โทรศัพท์",
    address: "ที่อยู่",
    newWht: "สร้างหนังสือรับรองหัก ณ ที่จ่าย",
    colNumber: "เลขที่",
    colPayee: "ผู้รับเงิน",
    colPnd: "ประเภท",
    colPaymentDate: "วันที่จ่าย",
    colAmountPaid: "ยอดจ่าย",
    colWhtRate: "อัตรา",
    colWhtAmount: "ภาษีหัก",
    emptyWht: "ยังไม่มีหนังสือรับรองหัก ณ ที่จ่าย",
    emptyWhtHint: "ออกหนังสือรับรองใบแรกจากค่าใช้จ่ายที่จ่ายแล้ว หรือเริ่มสร้างใหม่",
    print: "พิมพ์",
    exportPnd3: "CSV ภ.ง.ด.3",
    exportPnd53: "CSV ภ.ง.ด.53",
    exportRdPrep: "ไฟล์ RD-Prep .txt",
    issued: "ออกแล้ว",
    voidStatus: "ยกเลิก",
    newWhtTitle: "หนังสือรับรองหัก ณ ที่จ่ายใหม่",
    fromExpense: "จากค่าใช้จ่ายที่จ่ายแล้ว",
    pickExpenseOpt: "เริ่มจากว่าง…",
    payeeName: "ชื่อผู้รับเงิน",
    pndType: "ประเภทแบบ",
    incomeType: "ประเภทเงินได้",
    pickIncomeType: "เลือกประเภทเงินได้…",
    paymentDate: "วันที่จ่าย",
    amountPaid: "ยอดที่จ่าย",
    taxCondition: "เงื่อนไขการหัก",
  },
  en: {
    pageTitle: "Expenses & withholding tax",
    tabExpenses: "Expenses",
    tabWht: "Withholding tax",
    search: "Search vendor / description / doc ref",
    all: "All",
    newExpense: "New expense",
    count: "records",
    colDate: "Date",
    colVendor: "Vendor / description",
    colTotal: "Total",
    colWht: "WHT",
    colStatus: "Status",
    emptyExpenses: "No expenses yet",
    emptyExpensesHint: "Record your first vendor bill.",
    editExpenseTitle: "Edit expense",
    newExpenseTitle: "New expense",
    vendorLabel: "Vendor",
    pickVendor: "Pick a vendor…",
    newVendor: "New vendor",
    expenseDate: "Date",
    docRef: "Doc reference",
    description: "Description",
    categoryCode: "Expense account code",
    vatRate: "VAT rate %",
    vatInclusive: "VAT-inclusive prices",
    whtRate: "Withholding rate",
    notes: "Notes",
    items: "Line items",
    descCol: "Description",
    unitCol: "Unit",
    qtyCol: "Qty",
    priceCol: "Unit price",
    amountCol: "Amount",
    addLine: "Add line",
    subtotal: "Subtotal",
    net: "Net",
    vat: "VAT",
    total: "Total",
    whtAmount: "Withholding tax",
    netPayable: "Net payable",
    receipt: "Receipt",
    uploadReceipt: "Upload file",
    viewReceipt: "View receipt",
    receiptHint: "Save as a draft first to attach a file.",
    save: "Save",
    saved: "Saved",
    markPending: "Mark pending",
    markPaid: "Mark paid",
    confirmPaid: "Confirm paid",
    paymentMethod: "Payment method",
    paymentRef: "Payment ref",
    paidAt: "Paid on",
    voidBtn: "Void",
    close: "Close",
    cancel: "Cancel",
    create: "Create",
    name: "Name",
    isCompany: "Is a company",
    taxId: "Tax ID",
    branch: "Branch",
    phone: "Phone",
    address: "Address",
    newWht: "New WHT certificate",
    colNumber: "Number",
    colPayee: "Payee",
    colPnd: "Type",
    colPaymentDate: "Payment date",
    colAmountPaid: "Amount paid",
    colWhtRate: "Rate",
    colWhtAmount: "WHT amount",
    emptyWht: "No withholding-tax certificates yet",
    emptyWhtHint: "Issue your first certificate from a paid expense, or start blank.",
    print: "Print",
    exportPnd3: "P.N.D.3 CSV",
    exportPnd53: "P.N.D.53 CSV",
    exportRdPrep: "RD-Prep .txt",
    issued: "Issued",
    voidStatus: "Void",
    newWhtTitle: "New withholding-tax certificate",
    fromExpense: "From a paid expense",
    pickExpenseOpt: "Start blank…",
    payeeName: "Payee name",
    pndType: "P.N.D. type",
    incomeType: "Income type",
    pickIncomeType: "Pick an income type…",
    paymentDate: "Payment date",
    amountPaid: "Amount paid",
    taxCondition: "Tax condition",
  },
} as const;

// Both language tables share their keys; widen values to string so STR[lang]
// (a th|en union) is assignable where a single-locale table is expected.
type Tr = { [K in keyof (typeof STR)["en"]]: string };

type Row = { description: string; unit: string; qty: string; unit_price: string };
const emptyRow = (): Row => ({ description: "", unit: "", qty: "1", unit_price: "" });
const toRows = (items: ExpenseItem[]): Row[] =>
  items.length
    ? items.map((i) => ({ description: i.description, unit: i.unit ?? "", qty: String(i.qty), unit_price: String(i.unit_price) }))
    : [emptyRow()];

// Explicit shape (rather than ReturnType<typeof newWhtCertDraft>) so both
// newWhtCertDraft(...) AND whtCertPrefillFromExpense(...) — whose expense_id/
// contact_id types are widened by the underlying ExpenseLike/ContactLike id
// (`string | number | null`) — assign into the same state without friction.
type WhtDraft = {
  expense_id: string | number | null;
  contact_id: string | number | null;
  pnd_type: string;
  income_type: string;
  income_desc: string;
  payee_name: string;
  payee_tax_id: string;
  payee_branch: string;
  payee_address: string;
  payment_date: string;
  amount_paid: number;
  wht_rate: number;
  wht_amount: number;
  tax_condition: string;
};

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExpensesClient({
  expenses,
  certs,
  vendors,
  currency,
  canApprove,
}: {
  expenses: Expense[];
  certs: WhtCertificate[];
  vendors: Contact[];
  currency: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "th";
  const tr = STR[lang];

  const money = (n: number) =>
    `${currency} ${Number(n).toLocaleString(lang === "en" ? "en-US" : "th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [tab, setTab] = useState<"expenses" | "wht">("expenses");
  const [localVendors, setLocalVendors] = useState<Contact[]>(vendors);

  // ── Expenses tab ──────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "all">("all");
  const [q, setQ] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editItems, setEditItems] = useState<ExpenseItem[]>([]);
  const [loadingRow, setLoadingRow] = useState(false);

  const filteredExpenses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return expenses.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (!needle) return true;
      const vendorName = localVendors.find((v) => v.id === e.contact_id)?.name ?? "";
      return (
        (e.description ?? "").toLowerCase().includes(needle) ||
        (e.doc_ref ?? "").toLowerCase().includes(needle) ||
        vendorName.toLowerCase().includes(needle)
      );
    });
  }, [expenses, statusFilter, q, localVendors]);

  function openNewExpense() {
    setEditExpense(null);
    setEditItems([]);
    setEditorOpen(true);
  }

  async function openExpense(row: Expense) {
    setLoadingRow(true);
    const res = await loadExpenseDetail(row.id);
    setLoadingRow(false);
    if (!res.ok) {
      toast.error(`${res.code} · ${res.message}`);
      return;
    }
    setEditExpense(res.data.expense);
    setEditItems(res.data.items);
    setEditorOpen(true);
  }

  function vendorLabelFor(contactId: string | null): string {
    return localVendors.find((v) => v.id === contactId)?.name ?? "";
  }

  // ── WHT tab ───────────────────────────────────────────────────────────────
  const [whtModalOpen, setWhtModalOpen] = useState(false);
  const [rdPnd, setRdPnd] = useState<PndType>("pnd3");

  function exportCsv(pnd: PndType) {
    const rows = certs.filter((c) => c.pnd_type === pnd);
    const header = [
      "number",
      "payee_name",
      "payee_tax_id",
      "payee_branch",
      "payee_address",
      "payment_date",
      "income_type",
      "wht_rate",
      "amount_paid",
      "wht_amount",
      "status",
    ];
    const lines = [header.join(",")].concat(
      rows.map((c) =>
        [
          c.number ?? "",
          c.payee_name ?? "",
          c.payee_tax_id ?? "",
          c.payee_branch ?? "",
          c.payee_address ?? "",
          c.payment_date ?? "",
          c.income_type ?? "",
          c.wht_rate,
          c.amount_paid,
          c.wht_amount,
          c.status,
        ]
          .map(csvCell)
          .join(",")
      )
    );
    downloadText(`${pnd}.csv`, "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8;");
  }

  function exportRdPrep(pnd: PndType) {
    const rows: WhtRowInput[] = certs
      .filter((c) => c.pnd_type === pnd && c.status !== "void")
      .map((c) => ({
        payee_name: c.payee_name,
        payee_tax_id: c.payee_tax_id,
        payee_address: c.payee_address,
        payment_date: c.payment_date,
        income_type: c.income_type,
        wht_rate: c.wht_rate,
        amount_paid: c.amount_paid,
        wht_amount: c.wht_amount,
        tax_condition: c.tax_condition,
      }));
    const txt = buildRdPrepTxt(rows, { pndType: pnd === "pnd53" ? "pnd53" : "pnd3" });
    downloadText(`rdprep-${pnd}.txt`, txt, "text/plain;charset=utf-8;");
  }

  async function doVoidWht(id: string) {
    const res = await voidWhtAction(id);
    if (res.ok) {
      toast.success(tr.saved);
      router.refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  return (
    <div className="mx-auto max-w-[1700px]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.pageTitle}</h1>
      </div>

      {/* Pill tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["expenses", "wht"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
              tab === t
                ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
            }`}
          >
            {t === "expenses" ? tr.tabExpenses : tr.tabWht}
          </button>
        ))}
      </div>

      {tab === "expenses" ? (
        <>
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-[var(--app-fg-muted)]">
              {filteredExpenses.length} {tr.count}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={openNewExpense} loading={loadingRow}>
                <Plus size={14} /> {tr.newExpense}
              </Button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                statusFilter === "all"
                  ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                  : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
              }`}
            >
              {tr.all}
            </button>
            {EXPENSE_STATUSES.map((s) => (
              <button
                key={s.v}
                onClick={() => setStatusFilter(s.v as ExpenseStatus)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                  statusFilter === s.v
                    ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                    : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
                }`}
              >
                {lang === "en" ? s.en : s.th}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-fg-muted)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr.search} className={`${field} pl-8`} />
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="app-surface rounded-2xl border border-[var(--app-border)]">
              <EmptyState icon={<Receipt size={22} />} title={tr.emptyExpenses} hint={tr.emptyExpensesHint} />
            </div>
          ) : (
            <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                    <th className="px-4 py-2.5 font-medium">{tr.colDate}</th>
                    <th className="px-4 py-2.5 font-medium">{tr.colVendor}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr.colTotal}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr.colWht}</th>
                    <th className="px-4 py-2.5 font-medium">{tr.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => {
                    const meta = expenseStatusMeta(e.status);
                    const vName = vendorLabelFor(e.contact_id);
                    return (
                      <tr
                        key={e.id}
                        onClick={() => openExpense(e)}
                        className="cursor-pointer border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap text-[var(--app-fg-muted)]">{e.expense_date}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{vName || e.description || "—"}</div>
                          {vName && e.description && (
                            <div className="text-xs text-[var(--app-fg-muted)]">{e.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">{money(e.total)}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">{money(e.wht_amount)}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                            style={{ background: meta.color, opacity: e.status === "void" ? 0.7 : 1 }}
                          >
                            {lang === "en" ? meta.en : meta.th}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {editorOpen && (
            <ExpenseEditorModal
              tr={tr}
              lang={lang}
              money={money}
              currency={currency}
              canApprove={canApprove}
              vendors={localVendors}
              initial={editExpense}
              initialItems={editItems}
              onClose={() => setEditorOpen(false)}
              onVendorCreated={(c) => setLocalVendors((l) => [c, ...l])}
              onSaved={() => router.refresh()}
            />
          )}
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-[var(--app-fg-muted)]">
              {certs.length} {tr.count}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => exportCsv("pnd3")}>
                <Download size={14} /> {tr.exportPnd3}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => exportCsv("pnd53")}>
                <Download size={14} /> {tr.exportPnd53}
              </Button>
              <select
                value={rdPnd}
                onChange={(e) => setRdPnd(e.target.value as PndType)}
                className={field + " w-auto"}
                aria-label={tr.pndType}
              >
                {PND_TYPES.map((p) => (
                  <option key={p.v} value={p.v}>{lang === "en" ? p.en : p.th}</option>
                ))}
              </select>
              <Button size="sm" variant="ghost" onClick={() => exportRdPrep(rdPnd)}>
                <Download size={14} /> {tr.exportRdPrep}
              </Button>
              <Button size="sm" onClick={() => setWhtModalOpen(true)}>
                <Plus size={14} /> {tr.newWht}
              </Button>
            </div>
          </div>

          {certs.length === 0 ? (
            <div className="app-surface rounded-2xl border border-[var(--app-border)]">
              <EmptyState icon={<FileSpreadsheet size={22} />} title={tr.emptyWht} hint={tr.emptyWhtHint} />
            </div>
          ) : (
            <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                    <th className="px-4 py-2.5 font-medium">{tr.colNumber}</th>
                    <th className="px-4 py-2.5 font-medium">{tr.colPayee}</th>
                    <th className="px-4 py-2.5 font-medium">{tr.colPnd}</th>
                    <th className="px-4 py-2.5 font-medium">{tr.colPaymentDate}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr.colAmountPaid}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr.colWhtRate}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr.colWhtAmount}</th>
                    <th className="px-4 py-2.5 font-medium">{tr.colStatus}</th>
                    <th className="px-4 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c) => {
                    const pndMeta = pndTypeMeta(c.pnd_type);
                    const isVoid = c.status === "void";
                    return (
                      <tr key={c.id} className="border-t border-[var(--app-border)]">
                        <td className="px-4 py-2.5 font-medium">{c.number ?? "—"}</td>
                        <td className={`px-4 py-2.5 ${isVoid ? "text-[var(--app-fg-muted)] line-through" : ""}`}>{c.payee_name ?? "—"}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-[var(--app-fg-muted)]">{lang === "en" ? pndMeta.en : pndMeta.th}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-[var(--app-fg-muted)]">{c.payment_date ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">{money(c.amount_paid)}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">{c.wht_rate}%</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">{money(c.wht_amount)}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                            style={{ background: isVoid ? "#6b7280" : "#16a34a" }}
                          >
                            {isVoid ? tr.voidStatus : tr.issued}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {c.number && (
                              <a href={`/print/wht/${c.id}`} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="ghost"><Printer size={14} /> {tr.print}</Button>
                              </a>
                            )}
                            {canApprove && !isVoid && (
                              <Button size="sm" variant="danger" onClick={() => doVoidWht(c.id)}>{tr.voidBtn}</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {whtModalOpen && (
            <NewWhtModal
              tr={tr}
              lang={lang}
              expenses={expenses}
              vendors={localVendors}
              onClose={() => setWhtModalOpen(false)}
              onCreated={() => router.refresh()}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Expense editor modal ──────────────────────────────────────────────────
function ExpenseEditorModal({
  tr,
  lang,
  money,
  currency,
  canApprove,
  vendors,
  initial,
  initialItems,
  onClose,
  onVendorCreated,
  onSaved,
}: {
  tr: Tr;
  lang: "th" | "en";
  money: (n: number) => string;
  currency: string;
  canApprove: boolean;
  vendors: Contact[];
  initial: Expense | null;
  initialItems: ExpenseItem[];
  onClose: () => void;
  onVendorCreated: (c: Contact) => void;
  onSaved: (exp: Expense) => void;
}) {
  const toast = useToast();
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [status, setStatus] = useState<ExpenseStatus>(initial?.status ?? "draft");
  const [receiptPath, setReceiptPath] = useState<string | null>(initial?.receipt_image_path ?? null);
  const [h, setH] = useState({
    contact_id: initial?.contact_id ?? "",
    expense_date: initial?.expense_date ?? todayBkk(),
    doc_ref: initial?.doc_ref ?? "",
    description: initial?.description ?? "",
    category_account_code: initial?.category_account_code ?? "",
    vat_rate: String(initial?.vat_rate ?? 7),
    vat_inclusive: initial?.vat_inclusive ?? false,
    wht_rate: String(initial?.wht_rate ?? 0),
    notes: initial?.notes ?? "",
  });
  const [rows, setRows] = useState<Row[]>(toRows(initialItems));
  const [busy, setBusy] = useState(false);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({
    paymentMethod: initial?.payment_method ?? "",
    paymentRef: initial?.payment_ref ?? "",
    paidAt: initial?.paid_at ? initial.paid_at.slice(0, 10) : todayBkk(),
  });

  const editable = status === "draft";
  const set = (k: keyof typeof h, v: string | boolean) => setH((s) => ({ ...s, [k]: v }));

  const totals = useMemo(
    () =>
      computeExpenseTotals({
        lines: rows.map((r) => ({ qty: r.qty, unit_price: r.unit_price })),
        vatRate: Number(h.vat_rate) || 0,
        vatInclusive: h.vat_inclusive,
        whtRate: Number(h.wht_rate) || 0,
      }),
    [rows, h.vat_rate, h.vat_inclusive, h.wht_rate]
  );

  function headerPayload(): ExpenseHeaderInput {
    return {
      expense_date: h.expense_date,
      contact_id: h.contact_id || null,
      category_account_code: h.category_account_code || null,
      description: h.description || null,
      doc_ref: h.doc_ref || null,
      currency,
      vat_rate: Number(h.vat_rate) || 0,
      vat_inclusive: h.vat_inclusive,
      wht_rate: Number(h.wht_rate) || 0,
      notes: h.notes || null,
    };
  }

  function itemsPayload(): ExpenseItemInput[] {
    return rows
      .filter((r) => r.description.trim() || Number(r.unit_price))
      .map((r) => ({
        description: r.description.trim(),
        unit: r.unit.trim() || null,
        qty: Number(r.qty) || 0,
        unit_price: Number(r.unit_price) || 0,
      }));
  }

  async function save() {
    setBusy(true);
    if (!id) {
      const res = await newExpense(headerPayload(), itemsPayload());
      setBusy(false);
      if (res.ok) {
        setId(res.data.id);
        setStatus(res.data.status);
        setReceiptPath(res.data.receipt_image_path);
        toast.success(tr.saved);
        onSaved(res.data);
      } else toast.error(`${res.code} · ${res.message}`);
      return;
    }
    const r1 = await saveExpenseHeader(id, headerPayload());
    if (!r1.ok) {
      setBusy(false);
      toast.error(`${r1.code} · ${r1.message}`);
      return;
    }
    const r2 = await saveExpenseItemsAction(id, itemsPayload());
    setBusy(false);
    if (r2.ok) {
      setStatus(r2.data.status);
      toast.success(tr.saved);
      onSaved(r2.data);
    } else toast.error(`${r2.code} · ${r2.message}`);
  }

  async function doSetStatus(next: "draft" | "pending") {
    if (!id) return;
    setBusy(true);
    const res = await setExpenseStatusAction(id, next);
    setBusy(false);
    if (res.ok) {
      setStatus(res.data.status);
      toast.success(tr.saved);
      onSaved(res.data);
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function confirmPaid() {
    if (!id) return;
    setBusy(true);
    const res = await markExpensePaid(id, {
      paymentMethod: pay.paymentMethod || null,
      paymentRef: pay.paymentRef || null,
      paidAt: pay.paidAt || null,
    });
    setBusy(false);
    if (res.ok) {
      setStatus(res.data.status);
      setPayOpen(false);
      toast.success(tr.saved);
      onSaved(res.data);
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function doVoid() {
    if (!id) return;
    setBusy(true);
    const res = await voidExpenseAction(id);
    setBusy(false);
    if (res.ok) {
      setStatus(res.data.status);
      toast.success(tr.saved);
      onSaved(res.data);
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!id) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    const res = await uploadReceipt(id, fd);
    setBusy(false);
    e.target.value = "";
    if (res.ok) {
      setReceiptPath(res.data.receipt_image_path);
      toast.success(tr.saved);
      onSaved(res.data);
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function viewReceipt() {
    if (!receiptPath) return;
    const res = await getReceiptUrl(receiptPath);
    if (res.ok) window.open(res.data.url, "_blank");
    else toast.error(`${res.code} · ${res.message}`);
  }

  async function addVendor(input: ContactInput) {
    const res = await createVendorContact(input);
    if (!res.ok) {
      toast.error(`${res.code} · ${res.message}`);
      return;
    }
    onVendorCreated(res.data);
    set("contact_id", res.data.id);
    setVendorModalOpen(false);
  }

  const meta = expenseStatusMeta(status);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={
          <span className="flex items-center gap-2">
            {id ? tr.editExpenseTitle : tr.newExpenseTitle}
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ background: meta.color }}>
              {lang === "en" ? meta.en : meta.th}
            </span>
          </span>
        }
        className="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>{tr.close}</Button>
            {editable && <Button size="sm" onClick={save} loading={busy}>{tr.save}</Button>}
            {id && status === "draft" && (
              <Button variant="ghost" size="sm" onClick={() => doSetStatus("pending")} loading={busy}>{tr.markPending}</Button>
            )}
            {id && status === "pending" && (
              <Button variant="ghost" size="sm" onClick={() => setPayOpen((v) => !v)} loading={busy}>{tr.markPaid}</Button>
            )}
            {id && canApprove && status !== "void" && (
              <Button variant="danger" size="sm" onClick={doVoid} loading={busy}>{tr.voidBtn}</Button>
            )}
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <label className={label + " mb-0 flex-1"}>{tr.vendorLabel}</label>
              {editable && (
                <button onClick={() => setVendorModalOpen(true)} className="flex items-center gap-1 text-xs text-[var(--app-accent)]">
                  <UserPlus size={13} /> {tr.newVendor}
                </button>
              )}
            </div>
            <select disabled={!editable} value={h.contact_id} onChange={(e) => set("contact_id", e.target.value)} className={field + " mb-3"}>
              <option value="">{tr.pickVendor}</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}{v.tax_id ? ` · ${v.tax_id}` : ""}</option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={label}>{tr.description}</label><input disabled={!editable} value={h.description} onChange={(e) => set("description", e.target.value)} className={field} /></div>
              <div><label className={label}>{tr.docRef}</label><input disabled={!editable} value={h.doc_ref} onChange={(e) => set("doc_ref", e.target.value)} className={field} /></div>
              <div className="sm:col-span-2"><label className={label}>{tr.categoryCode}</label><input disabled={!editable} value={h.category_account_code} onChange={(e) => set("category_account_code", e.target.value)} className={field} /></div>
            </div>

            <div className="mt-3">
              <label className={label}>{tr.receipt}</label>
              {id ? (
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--app-surface-2)]">
                    <Paperclip size={13} /> {tr.uploadReceipt}
                    <input type="file" className="hidden" onChange={handleFile} accept="image/*,application/pdf" />
                  </label>
                  {receiptPath && (
                    <Button size="sm" variant="ghost" onClick={viewReceipt}>{tr.viewReceipt}</Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--app-fg-muted)]">{tr.receiptHint}</p>
              )}
            </div>
          </div>

          <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
            <div className="grid gap-3">
              <div><label className={label}>{tr.expenseDate}</label><input type="date" disabled={!editable} value={h.expense_date} onChange={(e) => set("expense_date", e.target.value)} className={field} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={label}>{tr.vatRate}</label><input type="number" step="0.01" disabled={!editable} value={h.vat_rate} onChange={(e) => set("vat_rate", e.target.value)} className={field} /></div>
                <div>
                  <label className={label}>{tr.whtRate}</label>
                  <select disabled={!editable} value={h.wht_rate} onChange={(e) => set("wht_rate", e.target.value)} className={field}>
                    {WHT_RATE_OPTIONS.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={!editable} checked={h.vat_inclusive} onChange={(e) => set("vat_inclusive", e.target.checked)} /> {tr.vatInclusive}
              </label>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="app-surface mt-4 overflow-x-auto rounded-2xl border border-[var(--app-border)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{tr.items}</span>
            {editable && (
              <Button size="sm" variant="ghost" onClick={() => setRows((r) => [...r, emptyRow()])}>
                <Plus size={14} /> {tr.addLine}
              </Button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                <th className="py-1.5 pr-2 font-medium">{tr.descCol}</th>
                <th className="py-1.5 px-2 font-medium">{tr.unitCol}</th>
                <th className="py-1.5 px-2 text-right font-medium">{tr.qtyCol}</th>
                <th className="py-1.5 px-2 text-right font-medium">{tr.priceCol}</th>
                <th className="py-1.5 pl-2 text-right font-medium">{tr.amountCol}</th>
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

          <div className="mt-4 flex justify-end">
            <table className="w-72 text-sm">
              <tbody>
                <tr><td className="py-1 text-[var(--app-fg-muted)]">{tr.subtotal}</td><td className="py-1 text-right">{money(totals.subtotal)}</td></tr>
                <tr><td className="py-1 text-[var(--app-fg-muted)]">{tr.net}</td><td className="py-1 text-right">{money(totals.net)}</td></tr>
                <tr><td className="py-1 text-[var(--app-fg-muted)]">{tr.vat} ({h.vat_rate}%)</td><td className="py-1 text-right">{money(totals.vat)}</td></tr>
                <tr><td className="py-1 text-[var(--app-fg-muted)]">{tr.total}</td><td className="py-1 text-right">{money(totals.total)}</td></tr>
                <tr><td className="py-1 text-[var(--app-fg-muted)]">{tr.whtAmount} ({h.wht_rate}%)</td><td className="py-1 text-right">− {money(totals.whtAmount)}</td></tr>
                <tr className="border-t border-[var(--app-border)] font-bold"><td className="py-2">{tr.netPayable}</td><td className="py-2 text-right">{money(totals.netPayable)}</td></tr>
              </tbody>
            </table>
          </div>

          {payOpen && (
            <div className="mt-3 grid gap-2 rounded-lg border border-[var(--app-border)] p-3 sm:grid-cols-3">
              <div><label className={label}>{tr.paymentMethod}</label><input value={pay.paymentMethod} onChange={(e) => setPay((s) => ({ ...s, paymentMethod: e.target.value }))} className={field} /></div>
              <div><label className={label}>{tr.paymentRef}</label><input value={pay.paymentRef} onChange={(e) => setPay((s) => ({ ...s, paymentRef: e.target.value }))} className={field} /></div>
              <div><label className={label}>{tr.paidAt}</label><input type="date" value={pay.paidAt} onChange={(e) => setPay((s) => ({ ...s, paidAt: e.target.value }))} className={field} /></div>
              <div className="flex items-center justify-end gap-2 sm:col-span-3">
                <Button variant="ghost" size="sm" onClick={() => setPayOpen(false)}>{tr.cancel}</Button>
                <Button size="sm" onClick={confirmPaid} loading={busy}>{tr.confirmPaid}</Button>
              </div>
            </div>
          )}

          <div className="mt-3">
            <label className={label}>{tr.notes}</label>
            <textarea disabled={!editable} value={h.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={field} />
          </div>
        </div>
      </Modal>

      <NewVendorModal open={vendorModalOpen} onClose={() => setVendorModalOpen(false)} tr={tr} onCreate={addVendor} />
    </>
  );
}

function NewVendorModal({
  open,
  onClose,
  tr,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  tr: Tr;
  onCreate: (i: ContactInput) => void;
}) {
  const [name, setName] = useState("");
  const [isCompany, setIsCompany] = useState(false);
  const [taxId, setTaxId] = useState("");
  const [branch, setBranch] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr.newVendor}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>{tr.cancel}</Button>
          <Button
            size="sm"
            onClick={() => name.trim() && onCreate({ name: name.trim(), is_company: isCompany, tax_id: taxId || null, branch: branch || null, phone: phone || null })}
          >
            {tr.create}
          </Button>
        </>
      }
    >
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

// ── New WHT certificate modal ─────────────────────────────────────────────
function NewWhtModal({
  tr,
  lang,
  expenses,
  vendors,
  onClose,
  onCreated,
}: {
  tr: Tr;
  lang: "th" | "en";
  expenses: Expense[];
  vendors: Contact[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const paidExpenses = useMemo(() => expenses.filter((e) => e.status === "paid"), [expenses]);
  const [fromExpenseId, setFromExpenseId] = useState("");
  const [f, setF] = useState<WhtDraft>(() => newWhtCertDraft(null));
  const [busy, setBusy] = useState(false);

  function pickExpense(expenseId: string) {
    setFromExpenseId(expenseId);
    if (!expenseId) {
      setF(newWhtCertDraft(null));
      return;
    }
    const exp = paidExpenses.find((e) => e.id === expenseId);
    if (!exp) return;
    const vendor = vendors.find((v) => v.id === exp.contact_id) ?? null;
    setF(whtCertPrefillFromExpense(exp, vendor));
  }

  function pickIncomeType(code: string) {
    const meta = INCOME_TYPES.find((i) => i.code === code);
    setF((s) => ({ ...s, income_type: code, wht_rate: meta ? meta.rate : s.wht_rate }));
  }

  const whtAmount = whtAmountFor(f.amount_paid, f.wht_rate);

  async function create() {
    if (!f.payee_name.trim()) {
      toast.error(`HG-VALIDATION-422 · ${lang === "en" ? "Payee name is required." : "กรุณาระบุชื่อผู้รับเงิน"}`);
      return;
    }
    const payload: WhtInput = {
      expense_id: f.expense_id != null ? String(f.expense_id) : null,
      contact_id: f.contact_id != null ? String(f.contact_id) : null,
      pnd_type: f.pnd_type as PndType,
      income_type: f.income_type || null,
      income_desc: f.income_desc || null,
      payee_name: f.payee_name,
      payee_tax_id: f.payee_tax_id || null,
      payee_branch: f.payee_branch || null,
      payee_address: f.payee_address || null,
      payment_date: f.payment_date,
      amount_paid: Number(f.amount_paid) || 0,
      wht_rate: Number(f.wht_rate) || 0,
      wht_amount: whtAmount,
      tax_condition: f.tax_condition || "1",
    };
    setBusy(true);
    const res = await newWht(payload);
    setBusy(false);
    if (res.ok) {
      toast.success(tr.saved);
      onCreated();
      onClose();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={tr.newWhtTitle}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>{tr.cancel}</Button>
          <Button size="sm" onClick={create} loading={busy}>{tr.create}</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div>
          <label className={label}>{tr.fromExpense}</label>
          <select value={fromExpenseId} onChange={(e) => pickExpense(e.target.value)} className={field}>
            <option value="">{tr.pickExpenseOpt}</option>
            {paidExpenses.map((e) => (
              <option key={e.id} value={e.id}>
                {e.expense_date} · {vendors.find((v) => v.id === e.contact_id)?.name || e.description || e.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={label}>{tr.payeeName}</label><input value={f.payee_name} onChange={(e) => setF((s) => ({ ...s, payee_name: e.target.value }))} className={field} /></div>
          <div><label className={label}>{tr.taxId}</label><input value={f.payee_tax_id} onChange={(e) => setF((s) => ({ ...s, payee_tax_id: e.target.value }))} className={field} /></div>
          <div><label className={label}>{tr.branch}</label><input value={f.payee_branch} onChange={(e) => setF((s) => ({ ...s, payee_branch: e.target.value }))} className={field} /></div>
          <div>
            <label className={label}>{tr.pndType}</label>
            <select value={f.pnd_type} onChange={(e) => setF((s) => ({ ...s, pnd_type: e.target.value as WhtDraft["pnd_type"] }))} className={field}>
              {PND_TYPES.map((p) => <option key={p.v} value={p.v}>{lang === "en" ? p.en : p.th}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label className={label}>{tr.address}</label><textarea value={f.payee_address} onChange={(e) => setF((s) => ({ ...s, payee_address: e.target.value }))} rows={2} className={field} /></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>{tr.incomeType}</label>
            <select value={f.income_type} onChange={(e) => pickIncomeType(e.target.value)} className={field}>
              <option value="">{tr.pickIncomeType}</option>
              {INCOME_TYPES.map((i) => <option key={i.code} value={i.code}>{lang === "en" ? i.en : i.th}</option>)}
            </select>
          </div>
          <div><label className={label}>{tr.paymentDate}</label><input type="date" value={f.payment_date} onChange={(e) => setF((s) => ({ ...s, payment_date: e.target.value }))} className={field} /></div>
          <div><label className={label}>{tr.amountPaid}</label><input type="number" step="0.01" value={f.amount_paid} onChange={(e) => setF((s) => ({ ...s, amount_paid: Number(e.target.value) || 0 }))} className={field} /></div>
          <div><label className={label}>{tr.whtRate}</label><input type="number" step="0.01" value={f.wht_rate} onChange={(e) => setF((s) => ({ ...s, wht_rate: Number(e.target.value) || 0 }))} className={field} /></div>
          <div><label className={label}>{tr.taxCondition}</label><input value={f.tax_condition} onChange={(e) => setF((s) => ({ ...s, tax_condition: e.target.value }))} className={field} /></div>
          <div>
            <label className={label}>{tr.whtAmount}</label>
            <div className={field + " bg-[var(--app-surface-2)]"}>{whtAmount.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
