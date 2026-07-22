"use client";

// General-ledger workspace: 5-book journals, chart of accounts, trial balance,
// P&L, balance sheet, VAT reports, and period close — one page, 7 pill tabs.
// Reads are fetch-on-open per tab (the server-loaded props only seed the first
// paint); writes route through the shared server actions in
// app/app/accounting/actions.ts, which re-gate every approve/void/CoA/period
// write against canApprove() server-side — the client-side canApprove prop is
// only for hiding controls a staff role would be rejected for anyway.

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Landmark, Scale, TrendingUp, Receipt, Lock, Plus, Download, Printer, Trash2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import Button from "@/components/app/ui/Button";
import Modal from "@/components/app/ui/Modal";
import EmptyState from "@/components/app/ui/EmptyState";
import { useToast } from "@/components/app/ui/Toast";
import {
  JOURNAL_BOOKS,
  bookMeta,
  ENTRY_STATUSES,
  entryStatusMeta,
  ACCOUNT_CATEGORIES,
  categoryMeta,
  validateEntryLines,
  summarizeTrialBalance,
  buildProfitAndLoss,
  buildBalanceSheet,
  parseCoaCsv,
  type JournalBook,
} from "@/lib/accounting/posting";
import {
  monthLabel,
  summarizeReport,
  pho30FromReports,
  buildSalesReportCsv,
  buildPurchaseReportCsv,
  formatBEDate,
  type ReportSummary,
} from "@/lib/accounting/vat";
import {
  loadJournalEntries,
  loadJournalEntry,
  createEntryAction,
  updateEntryAction,
  approveEntryAction,
  voidEntryAction,
  loadAccounts,
  createAccountAction,
  updateAccountAction,
  deactivateAccountAction,
  importAccountsAction,
  loadTrialBalance,
  loadLedger,
  loadVatReports,
  loadPeriods,
  closePeriodAction,
  reopenPeriodAction,
} from "@/app/app/accounting/actions";
import type {
  JournalEntry,
  JournalHeaderInput,
  JournalLineInput,
  Account,
  AccountCategory,
  TbRow,
  LedgerLine,
  AccountingPeriod,
  ReportRow,
  EntryStatus,
} from "@/lib/db/gl";

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

const STR = {
  th: {
    title: "บัญชี",
    tabJournals: "สมุดรายวัน",
    tabCoa: "ผังบัญชี",
    tabTb: "งบทดลอง",
    tabPl: "งบกำไรขาดทุน",
    tabBs: "งบแสดงฐานะการเงิน",
    tabVat: "ภาษีมูลค่าเพิ่ม",
    tabClose: "ปิดงวด",

    cancel: "ยกเลิก",
    save2: "บันทึก",
    saved: "บันทึกแล้ว",

    allBooks: "ทุกสมุด",
    allStatuses: "ทุกสถานะ",
    newEntry: "สร้างรายการ",
    date: "วันที่",
    book: "สมุดรายวัน",
    number: "เลขที่",
    description: "รายละเอียด",
    status: "สถานะ",
    draft: "ฉบับร่าง",
    noEntries: "ยังไม่มีรายการบัญชี",
    noEntriesHint: "สร้างรายการบัญชีรายการแรกของคุณ",
    entryDate: "วันที่รายการ",
    account: "บัญชี",
    debit: "เดบิต",
    credit: "เครดิต",
    memo: "หมายเหตุ",
    addLine: "เพิ่มบรรทัด",
    pickAccount: "เลือกบัญชี…",
    totalDebit: "รวมเดบิต",
    totalCredit: "รวมเครดิต",
    balanced: "ยอดตรงกัน ✓",
    notBalanced: "ยอดไม่ตรงกัน ✗",
    approve: "อนุมัติ",
    approved: "อนุมัติแล้ว",
    voidBtn: "ยกเลิกรายการ",
    voided: "ยกเลิกรายการแล้ว",
    voidReason: "เหตุผลที่ยกเลิก (ถ้ามี)",
    entryDetail: "รายละเอียดรายการบัญชี",

    addAccount: "เพิ่มบัญชี",
    editAccount: "แก้ไขบัญชี",
    importCsv: "นำเข้า CSV",
    code: "รหัสบัญชี",
    name: "ชื่อบัญชี",
    nameTh: "ชื่อ (ไทย)",
    nameEn: "ชื่อ (อังกฤษ)",
    category: "หมวดบัญชี",
    parentCode: "รหัสบัญชีแม่",
    sortOrder: "ลำดับการแสดงผล",
    deactivate: "ปิดการใช้งาน",
    active: "ใช้งานอยู่",
    inactive: "ปิดใช้งาน",
    noAccounts: "ยังไม่มีผังบัญชี",
    noAccountsHint: "เพิ่มบัญชีแรก หรือนำเข้าจากไฟล์ CSV",
    csvPlaceholder: "วางข้อมูล CSV (code,name,name_en,category,parent_code)",
    preview: "ตัวอย่างข้อมูล",
    imported: "นำเข้าสำเร็จ",

    from: "จากวันที่",
    to: "ถึงวันที่",
    includeDrafts: "รวมรายการฉบับร่าง",
    run: "แสดงผล",
    opening: "ยอดยกมา",
    periodDebit: "เดบิตระหว่างงวด",
    periodCredit: "เครดิตระหว่างงวด",
    closing: "ยอดคงเหลือ",
    totals: "รวม",
    noData: "ไม่มีข้อมูล",
    ledgerFor: "สมุดบัญชีแยกประเภท",

    month: "เดือน",
    revenue: "รายได้",
    expense: "ค่าใช้จ่าย",
    monthCol: "เดือนนี้",
    ytdCol: "สะสมทั้งปี",
    netProfit: "กำไรสุทธิ",
    totalRevenue: "รวมรายได้",
    totalExpense: "รวมค่าใช้จ่าย",

    asOf: "ณ วันที่",
    assets: "สินทรัพย์",
    liabilities: "หนี้สิน",
    equity: "ส่วนของเจ้าของ",
    balancedOk: "งบสมดุล ✓",
    diff: "ผลต่าง",

    year: "ปี",
    salesReport: "รายงานภาษีขาย",
    purchaseReport: "รายงานภาษีซื้อ",
    seq: "ลำดับ",
    docDate: "วันที่",
    docNumber: "เลขที่เอกสาร",
    customerName: "ชื่อผู้ซื้อ",
    vendorName: "ชื่อผู้ขาย",
    taxId: "เลขผู้เสียภาษี",
    branch: "สาขา",
    netAmount: "มูลค่าสินค้า/บริการ",
    vatAmount: "ภาษีมูลค่าเพิ่ม",
    pp30: "สรุป ภ.พ.30",
    salesTotal: "ยอดขาย",
    outputVat: "ภาษีขาย",
    purchaseTotal: "ยอดซื้อ",
    inputVat: "ภาษีซื้อ",
    vatPayable: "ภาษีที่ต้องชำระ",
    vatCreditCarry: "ภาษีที่ยกไปเดือนถัดไป",
    exportCsv: "ส่งออก CSV",
    printReport: "พิมพ์รายงาน",

    period: "งวดบัญชี",
    openStatus: "เปิด",
    closedStatus: "ปิดแล้ว",
    close: "ปิดงวด",
    reopen: "เปิดงวดใหม่",
  },
  en: {
    title: "Accounting",
    tabJournals: "Journals",
    tabCoa: "Chart of accounts",
    tabTb: "Trial balance",
    tabPl: "P&L",
    tabBs: "Balance sheet",
    tabVat: "VAT",
    tabClose: "Period close",

    cancel: "Cancel",
    save2: "Save",
    saved: "Saved",

    allBooks: "All books",
    allStatuses: "All statuses",
    newEntry: "New entry",
    date: "Date",
    book: "Book",
    number: "Number",
    description: "Description",
    status: "Status",
    draft: "Draft",
    noEntries: "No journal entries yet",
    noEntriesHint: "Create your first journal entry.",
    entryDate: "Entry date",
    account: "Account",
    debit: "Debit",
    credit: "Credit",
    memo: "Memo",
    addLine: "Add line",
    pickAccount: "Pick an account…",
    totalDebit: "Total debit",
    totalCredit: "Total credit",
    balanced: "Balanced ✓",
    notBalanced: "Not balanced ✗",
    approve: "Approve",
    approved: "Approved",
    voidBtn: "Void",
    voided: "Voided",
    voidReason: "Reason for voiding (optional)",
    entryDetail: "Journal entry",

    addAccount: "Add account",
    editAccount: "Edit account",
    importCsv: "Import CSV",
    code: "Code",
    name: "Name",
    nameTh: "Name (Thai)",
    nameEn: "Name (English)",
    category: "Category",
    parentCode: "Parent code",
    sortOrder: "Sort order",
    deactivate: "Deactivate",
    active: "Active",
    inactive: "Inactive",
    noAccounts: "No chart of accounts yet",
    noAccountsHint: "Add your first account, or import a CSV.",
    csvPlaceholder: "Paste CSV data (code,name,name_en,category,parent_code)",
    preview: "Preview",
    imported: "Imported",

    from: "From",
    to: "To",
    includeDrafts: "Include draft entries",
    run: "Run",
    opening: "Opening",
    periodDebit: "Period debit",
    periodCredit: "Period credit",
    closing: "Closing",
    totals: "Totals",
    noData: "No data",
    ledgerFor: "Ledger",

    month: "Month",
    revenue: "Revenue",
    expense: "Expenses",
    monthCol: "Month",
    ytdCol: "YTD",
    netProfit: "Net profit",
    totalRevenue: "Total revenue",
    totalExpense: "Total expenses",

    asOf: "As of",
    assets: "Assets",
    liabilities: "Liabilities",
    equity: "Equity",
    balancedOk: "Balanced ✓",
    diff: "Difference",

    year: "Year",
    salesReport: "Sales VAT report",
    purchaseReport: "Purchase VAT report",
    seq: "Seq",
    docDate: "Date",
    docNumber: "Document no.",
    customerName: "Customer",
    vendorName: "Vendor",
    taxId: "Tax ID",
    branch: "Branch",
    netAmount: "Net amount",
    vatAmount: "VAT amount",
    pp30: "PP.30 summary",
    salesTotal: "Sales total",
    outputVat: "Output VAT",
    purchaseTotal: "Purchase total",
    inputVat: "Input VAT",
    vatPayable: "VAT payable",
    vatCreditCarry: "Credit carried forward",
    exportCsv: "Export CSV",
    printReport: "Print report",

    period: "Period",
    openStatus: "Open",
    closedStatus: "Closed",
    close: "Close period",
    reopen: "Reopen",
  },
} as const;

// Both language tables share their keys; widen values to string so STR[lang]
// (a th|en union) is assignable where a single-locale table is expected.
type Tr = { [K in keyof (typeof STR)["en"]]: string };
type Lang = "th" | "en";
type ToastApi = ReturnType<typeof useToast>;
type RouterApi = ReturnType<typeof useRouter>;

// ── date helpers ──────────────────────────────────────────────────────────────
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function lastOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function firstOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

// ── journal-line editor shared types ────────────────────────────────────────
type LineRow = { account_code: string; debit: string; credit: string; memo: string };
const blankLine = (): LineRow => ({ account_code: "", debit: "", credit: "", memo: "" });

function toLineInputs(rows: LineRow[]): JournalLineInput[] {
  return rows
    .filter((r) => r.account_code && (Number(r.debit) || Number(r.credit)))
    .map((r, i) => ({
      account_code: r.account_code,
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
      memo: r.memo.trim() || null,
      sort_order: i,
    }));
}

type TabId = "journals" | "coa" | "tb" | "pl" | "bs" | "vat" | "close";

export default function AccountingClient({
  entries,
  accounts,
  periods,
  canApprove,
  currency,
}: {
  entries: JournalEntry[];
  accounts: Account[];
  periods: AccountingPeriod[];
  canApprove: boolean;
  currency: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useI18n();
  const lang: Lang = locale === "en" ? "en" : "th";
  const tr = STR[lang];

  const [tab, setTab] = useState<TabId>("journals");
  const [accountList, setAccountList] = useState<Account[]>(accounts);

  const money = (n: number) =>
    `${currency} ${Number(n).toLocaleString(lang === "en" ? "en-US" : "th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: "journals", label: tr.tabJournals, icon: <BookOpen size={14} /> },
    { id: "coa", label: tr.tabCoa, icon: <Landmark size={14} /> },
    { id: "tb", label: tr.tabTb, icon: <Scale size={14} /> },
    { id: "pl", label: tr.tabPl, icon: <TrendingUp size={14} /> },
    { id: "bs", label: tr.tabBs, icon: <Landmark size={14} /> },
    { id: "vat", label: tr.tabVat, icon: <Receipt size={14} /> },
    ...(canApprove ? [{ id: "close" as TabId, label: tr.tabClose, icon: <Lock size={14} /> }] : []),
  ];

  return (
    <div className="mx-auto max-w-[1700px]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
              tab === t.id
                ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "journals" && (
        <JournalsTab
          initialEntries={entries}
          accounts={accountList}
          canApprove={canApprove}
          lang={lang}
          tr={tr}
          money={money}
          toast={toast}
          router={router}
        />
      )}
      {tab === "coa" && (
        <CoaTab
          accounts={accountList}
          setAccounts={setAccountList}
          canApprove={canApprove}
          lang={lang}
          tr={tr}
          toast={toast}
        />
      )}
      {tab === "tb" && (
        <TrialBalanceTab accounts={accountList} lang={lang} tr={tr} money={money} toast={toast} />
      )}
      {tab === "pl" && (
        <ProfitLossTab accounts={accountList} lang={lang} tr={tr} money={money} toast={toast} />
      )}
      {tab === "bs" && (
        <BalanceSheetTab accounts={accountList} lang={lang} tr={tr} money={money} toast={toast} />
      )}
      {tab === "vat" && <VatTab lang={lang} tr={tr} money={money} toast={toast} />}
      {tab === "close" && canApprove && (
        <PeriodCloseTab initialPeriods={periods} lang={lang} tr={tr} toast={toast} />
      )}
    </div>
  );
}

// ── 1. Journals ──────────────────────────────────────────────────────────────

function JournalsTab({
  initialEntries,
  accounts,
  canApprove,
  lang,
  tr,
  money,
  toast,
  router,
}: {
  initialEntries: JournalEntry[];
  accounts: Account[];
  canApprove: boolean;
  lang: Lang;
  tr: Tr;
  money: (n: number) => string;
  toast: ToastApi;
  router: RouterApi;
}) {
  const [book, setBook] = useState<JournalBook | "all">("all");
  const [status, setStatus] = useState<EntryStatus | "all">("all");
  const [rows, setRows] = useState<JournalEntry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  function refresh() {
    setLoading(true);
    loadJournalEntries({ book: book === "all" ? undefined : book, status: status === "all" ? undefined : status }).then(
      (res) => {
        setLoading(false);
        if (res.ok) setRows(res.data);
        else toast.error(`${res.code} · ${res.message}`);
      },
    );
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, status]);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.active !== false), [accounts]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={book} onChange={(e) => setBook(e.target.value as JournalBook | "all")} className={field}>
          <option value="all">{tr.allBooks}</option>
          {JOURNAL_BOOKS.map((b) => (
            <option key={b.v} value={b.v}>
              {b.prefix} · {lang === "en" ? b.en : b.th}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as EntryStatus | "all")} className={field}>
          <option value="all">{tr.allStatuses}</option>
          {ENTRY_STATUSES.map((s) => (
            <option key={s.v} value={s.v}>
              {lang === "en" ? s.en : s.th}
            </option>
          ))}
        </select>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus size={14} /> {tr.newEntry}
          </Button>
        </div>
      </div>

      {rows.length === 0 && !loading ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState icon={<BookOpen size={22} />} title={tr.noEntries} hint={tr.noEntriesHint} />
        </div>
      ) : (
        <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                <th className="px-4 py-2.5 font-medium">{tr.date}</th>
                <th className="px-4 py-2.5 font-medium">{tr.book}</th>
                <th className="px-4 py-2.5 font-medium">{tr.number}</th>
                <th className="px-4 py-2.5 font-medium">{tr.description}</th>
                <th className="px-4 py-2.5 font-medium">{tr.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const bm = bookMeta(e.book);
                const sm = entryStatusMeta(e.status);
                return (
                  <tr
                    key={e.id}
                    onClick={() => setOpenId(e.id)}
                    className="cursor-pointer border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap text-[var(--app-fg-muted)]">{e.entry_date}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-md bg-[var(--app-surface-2)] px-1.5 py-0.5 font-mono text-xs">
                        {bm.prefix}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      {e.number ?? <span className="text-[var(--app-fg-muted)]">{tr.draft}</span>}
                    </td>
                    <td className="px-4 py-2.5">{e.description || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ background: sm.color }}
                      >
                        {lang === "en" ? sm.en : sm.th}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <EntryDetailModal
          id={openId}
          accounts={accounts}
          canApprove={canApprove}
          lang={lang}
          tr={tr}
          money={money}
          toast={toast}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            refresh();
            router.refresh();
          }}
        />
      )}
      {newOpen && (
        <NewEntryModal
          accounts={activeAccounts}
          lang={lang}
          tr={tr}
          toast={toast}
          onClose={() => setNewOpen(false)}
          onSaved={() => {
            setNewOpen(false);
            refresh();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EntryLinesEditor({
  rows,
  setRows,
  accounts,
  lang,
  tr,
}: {
  rows: LineRow[];
  setRows: Dispatch<SetStateAction<LineRow[]>>;
  accounts: Account[];
  lang: Lang;
  tr: Tr;
}) {
  const validation = useMemo(() => validateEntryLines(toLineInputs(rows)), [rows]);

  function update(i: number, patch: Partial<LineRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-[var(--app-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
              <th className="px-3 py-2 font-medium">{tr.account}</th>
              <th className="px-3 py-2 font-medium">{tr.memo}</th>
              <th className="px-3 py-2 text-right font-medium">{tr.debit}</th>
              <th className="px-3 py-2 text-right font-medium">{tr.credit}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-[var(--app-border)]">
                <td className="px-3 py-2">
                  <select
                    value={r.account_code}
                    onChange={(e) => update(i, { account_code: e.target.value })}
                    className={field + " w-full"}
                  >
                    <option value="">{tr.pickAccount}</option>
                    {accounts.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} · {lang === "en" ? a.name_en || a.name_th : a.name_th}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input value={r.memo} onChange={(e) => update(i, { memo: e.target.value })} className={field + " w-full"} />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={r.debit}
                    onChange={(e) => update(i, { debit: e.target.value, credit: e.target.value ? "" : r.credit })}
                    className={field + " w-28 text-right"}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={r.credit}
                    onChange={(e) => update(i, { credit: e.target.value, debit: e.target.value ? "" : r.debit })}
                    className={field + " w-28 text-right"}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setRows((rs) => (rs.length > 2 ? rs.filter((_, j) => j !== i) : rs))}
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
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={() => setRows((r) => [...r, blankLine()])}>
          <Plus size={14} /> {tr.addLine}
        </Button>
        <div
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            validation.balanced ? "bg-[var(--app-success)]/15 text-[var(--app-success)]" : "bg-[var(--app-danger)]/15 text-[var(--app-danger)]"
          }`}
        >
          {tr.totalDebit} {validation.totalDebit.toFixed(2)} · {tr.totalCredit} {validation.totalCredit.toFixed(2)} ·{" "}
          {validation.balanced ? tr.balanced : tr.notBalanced}
        </div>
      </div>
    </div>
  );
}

function NewEntryModal({
  accounts,
  lang,
  tr,
  toast,
  onClose,
  onSaved,
}: {
  accounts: Account[];
  lang: Lang;
  tr: Tr;
  toast: ToastApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [book, setBook] = useState<JournalBook>("general");
  const [entryDate, setEntryDate] = useState(ymd(new Date()));
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<LineRow[]>([blankLine(), blankLine()]);
  const [busy, setBusy] = useState(false);

  const lineInputs = useMemo(() => toLineInputs(rows), [rows]);
  const validation = useMemo(() => validateEntryLines(lineInputs), [lineInputs]);

  async function save() {
    setBusy(true);
    const header: JournalHeaderInput = { book, entry_date: entryDate, description: description.trim() || null };
    const res = await createEntryAction(header, lineInputs);
    setBusy(false);
    if (res.ok) {
      toast.success(tr.saved);
      onSaved();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  return (
    <Modal
      open
      onClose={onClose}
      className="max-w-2xl"
      title={tr.newEntry}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tr.cancel}
          </Button>
          <Button size="sm" onClick={save} loading={busy} disabled={!validation.balanced}>
            {tr.save2}
          </Button>
        </>
      }
    >
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className={label}>{tr.book}</label>
          <select value={book} onChange={(e) => setBook(e.target.value as JournalBook)} className={field + " w-full"}>
            {JOURNAL_BOOKS.map((b) => (
              <option key={b.v} value={b.v}>
                {b.prefix} · {lang === "en" ? b.en : b.th}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{tr.entryDate}</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={field + " w-full"} />
        </div>
        <div className="sm:col-span-3">
          <label className={label}>{tr.description}</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={field + " w-full"} />
        </div>
      </div>
      <EntryLinesEditor rows={rows} setRows={setRows} accounts={accounts} lang={lang} tr={tr} />
    </Modal>
  );
}

function EntryDetailModal({
  id,
  accounts,
  canApprove,
  lang,
  tr,
  money,
  toast,
  onClose,
  onChanged,
}: {
  id: string;
  accounts: Account[];
  canApprove: boolean;
  lang: Lang;
  tr: Tr;
  money: (n: number) => string;
  toast: ToastApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [rows, setRows] = useState<LineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [description, setDescription] = useState("");
  const [book, setBook] = useState<JournalBook>("general");

  useEffect(() => {
    let live = true;
    loadJournalEntry(id).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok) {
        setEntry(res.data.entry);
        setBook(res.data.entry.book);
        setEntryDate(res.data.entry.entry_date);
        setDescription(res.data.entry.description ?? "");
        setRows(
          res.data.lines.length
            ? res.data.lines.map((l) => ({
                account_code: l.account_code,
                debit: l.debit ? String(l.debit) : "",
                credit: l.credit ? String(l.credit) : "",
                memo: l.memo ?? "",
              }))
            : [blankLine(), blankLine()],
        );
      } else toast.error(`${res.code} · ${res.message}`);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const editable = entry?.status === "draft";
  const lineInputs = useMemo(() => toLineInputs(rows), [rows]);
  const validation = useMemo(() => validateEntryLines(lineInputs), [lineInputs]);

  async function save() {
    if (!entry) return;
    setBusy(true);
    const header: JournalHeaderInput = { book, entry_date: entryDate, description: description.trim() || null };
    const res = await updateEntryAction(entry.id, header, lineInputs);
    setBusy(false);
    if (res.ok) {
      toast.success(tr.saved);
      onChanged();
      onClose();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function approve() {
    if (!entry) return;
    setBusy(true);
    const res = await approveEntryAction(entry.id);
    setBusy(false);
    if (res.ok) {
      toast.success(tr.approved);
      onChanged();
      onClose();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function voidIt() {
    if (!entry) return;
    setBusy(true);
    const res = await voidEntryAction(entry.id, voidReason.trim() || undefined);
    setBusy(false);
    if (res.ok) {
      toast.success(tr.voided);
      onChanged();
      onClose();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  const bm = entry ? bookMeta(entry.book) : null;
  const sm = entry ? entryStatusMeta(entry.status) : null;
  const accountName = (code: string) => {
    const a = accounts.find((x) => x.code === code);
    if (!a) return code;
    return lang === "en" ? a.name_en || a.name_th : a.name_th;
  };

  return (
    <Modal
      open
      onClose={onClose}
      className="max-w-2xl"
      title={
        <span className="flex items-center gap-2">
          {tr.entryDetail}
          {sm && (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ background: sm.color }}>
              {lang === "en" ? sm.en : sm.th}
            </span>
          )}
        </span>
      }
      footer={
        entry && (
          <>
            {canApprove && (entry.status === "draft" || entry.status === "approved") && (
              <input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder={tr.voidReason}
                className={field + " mr-auto w-56"}
              />
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              {tr.cancel}
            </Button>
            {editable && (
              <Button size="sm" onClick={save} loading={busy} disabled={!validation.balanced}>
                {tr.save2}
              </Button>
            )}
            {canApprove && entry.status === "draft" && (
              <Button size="sm" onClick={approve} loading={busy}>
                {tr.approve}
              </Button>
            )}
            {canApprove && (entry.status === "draft" || entry.status === "approved") && (
              <Button variant="danger" size="sm" onClick={voidIt} loading={busy}>
                {tr.voidBtn}
              </Button>
            )}
          </>
        )
      }
    >
      {loading || !entry ? (
        <p className="text-sm text-[var(--app-fg-muted)]">…</p>
      ) : (
        <div>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className={label}>{tr.book}</label>
              {editable ? (
                <select value={book} onChange={(e) => setBook(e.target.value as JournalBook)} className={field + " w-full"}>
                  {JOURNAL_BOOKS.map((b) => (
                    <option key={b.v} value={b.v}>
                      {b.prefix} · {lang === "en" ? b.en : b.th}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm">
                  {bm?.prefix} · {lang === "en" ? bm?.en : bm?.th}
                </p>
              )}
            </div>
            <div>
              <label className={label}>{tr.entryDate}</label>
              {editable ? (
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={field + " w-full"} />
              ) : (
                <p className="text-sm">{entry.entry_date}</p>
              )}
            </div>
            <div>
              <label className={label}>{tr.number}</label>
              <p className="text-sm">{entry.number ?? tr.draft}</p>
            </div>
            <div className="sm:col-span-3">
              <label className={label}>{tr.description}</label>
              {editable ? (
                <input value={description} onChange={(e) => setDescription(e.target.value)} className={field + " w-full"} />
              ) : (
                <p className="text-sm">{entry.description || "—"}</p>
              )}
            </div>
          </div>

          {editable ? (
            <EntryLinesEditor
              rows={rows}
              setRows={setRows}
              accounts={accounts.filter((a) => a.active !== false)}
              lang={lang}
              tr={tr}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--app-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                    <th className="px-3 py-2 font-medium">{tr.account}</th>
                    <th className="px-3 py-2 font-medium">{tr.memo}</th>
                    <th className="px-3 py-2 text-right font-medium">{tr.debit}</th>
                    <th className="px-3 py-2 text-right font-medium">{tr.credit}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-[var(--app-border)]">
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-[var(--app-fg-muted)]">{r.account_code}</span>{" "}
                        {accountName(r.account_code)}
                      </td>
                      <td className="px-3 py-2 text-[var(--app-fg-muted)]">{r.memo || "—"}</td>
                      <td className="px-3 py-2 text-right">{r.debit ? money(Number(r.debit)) : ""}</td>
                      <td className="px-3 py-2 text-right">{r.credit ? money(Number(r.credit)) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── 2. Chart of accounts ─────────────────────────────────────────────────────

function CoaTab({
  accounts,
  setAccounts,
  canApprove,
  lang,
  tr,
  toast,
}: {
  accounts: Account[];
  setAccounts: (a: Account[]) => void;
  canApprove: boolean;
  lang: Lang;
  tr: Tr;
  toast: ToastApi;
}) {
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  async function refresh() {
    const res = await loadAccounts();
    if (res.ok) setAccounts(res.data);
    else toast.error(`${res.code} · ${res.message}`);
  }

  const grouped = useMemo(() => {
    const byCat = new Map<AccountCategory, Account[]>();
    for (const cat of ACCOUNT_CATEGORIES) byCat.set(cat.v, []);
    for (const a of accounts) {
      const list = byCat.get(a.category) ?? [];
      list.push(a);
      byCat.set(a.category, list);
    }
    return byCat;
  }, [accounts]);

  return (
    <div>
      <div className="mb-3 flex justify-end gap-2">
        {canApprove && (
          <Button size="sm" variant="ghost" onClick={() => setImportOpen(true)}>
            {tr.importCsv}
          </Button>
        )}
        {canApprove && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> {tr.addAccount}
          </Button>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState icon={<Landmark size={22} />} title={tr.noAccounts} hint={tr.noAccountsHint} />
        </div>
      ) : (
        <div className="space-y-4">
          {ACCOUNT_CATEGORIES.map((cat) => {
            const list = grouped.get(cat.v) ?? [];
            if (!list.length) return null;
            return (
              <div key={cat.v} className="app-surface overflow-hidden rounded-2xl border border-[var(--app-border)]">
                <div className="border-b border-[var(--app-border)] px-4 py-2 text-sm font-semibold">
                  {lang === "en" ? cat.en : cat.th}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                      <th className="px-4 py-2 font-medium">{tr.code}</th>
                      <th className="px-4 py-2 font-medium">{tr.name}</th>
                      <th className="px-4 py-2 font-medium">{tr.active}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((a) => (
                      <tr
                        key={a.code}
                        onClick={() => setEditing(a)}
                        className="cursor-pointer border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                      >
                        <td className="px-4 py-2 font-mono text-xs">{a.code}</td>
                        <td className="px-4 py-2">{lang === "en" ? a.name_en || a.name_th : a.name_th}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              a.active === false
                                ? "bg-[var(--app-surface-2)] text-[var(--app-fg-muted)]"
                                : "bg-[var(--app-success)]/15 text-[var(--app-success)]"
                            }`}
                          >
                            {a.active === false ? tr.inactive : tr.active}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {editing != null && (
        <AccountFormModal
          account={editing === "new" ? null : editing}
          lang={lang}
          tr={tr}
          canApprove={canApprove}
          toast={toast}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {importOpen && (
        <ImportCsvModal
          tr={tr}
          toast={toast}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function AccountFormModal({
  account,
  lang,
  tr,
  canApprove,
  toast,
  onClose,
  onSaved,
}: {
  account: Account | null;
  lang: Lang;
  tr: Tr;
  canApprove: boolean;
  toast: ToastApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !account;
  const [code, setCode] = useState(account?.code ?? "");
  const [nameTh, setNameTh] = useState(account?.name_th ?? "");
  const [nameEn, setNameEn] = useState(account?.name_en ?? "");
  const [category, setCategory] = useState<AccountCategory>(account?.category ?? "asset");
  const [parentCode, setParentCode] = useState(account?.parent_code ?? "");
  const [sortOrder, setSortOrder] = useState(String(account?.sort_order ?? 0));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = isNew
      ? await createAccountAction({
          code: code.trim(),
          name_th: nameTh.trim(),
          name_en: nameEn.trim() || null,
          category,
          parent_code: parentCode.trim() || null,
          sort_order: Number(sortOrder) || 0,
        })
      : await updateAccountAction(account.code, {
          name_th: nameTh.trim(),
          name_en: nameEn.trim() || null,
          category,
          parent_code: parentCode.trim() || null,
          sort_order: Number(sortOrder) || 0,
        });
    setBusy(false);
    if (res.ok) {
      toast.success(tr.saved);
      onSaved();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  async function deactivate() {
    if (!account) return;
    setBusy(true);
    const res = await deactivateAccountAction(account.code);
    setBusy(false);
    if (res.ok) {
      toast.success(tr.saved);
      onSaved();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? tr.addAccount : tr.editAccount}
      footer={
        canApprove ? (
          <>
            {!isNew && account.active !== false && (
              <Button variant="danger" size="sm" onClick={deactivate} loading={busy}>
                {tr.deactivate}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              {tr.cancel}
            </Button>
            <Button size="sm" onClick={save} loading={busy} disabled={!code.trim() || !nameTh.trim()}>
              {tr.save2}
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tr.cancel}
          </Button>
        )
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>{tr.code}</label>
          <input disabled={!isNew || !canApprove} value={code} onChange={(e) => setCode(e.target.value)} className={field + " w-full"} />
        </div>
        <div>
          <label className={label}>{tr.category}</label>
          <select
            disabled={!canApprove}
            value={category}
            onChange={(e) => setCategory(e.target.value as AccountCategory)}
            className={field + " w-full"}
          >
            {ACCOUNT_CATEGORIES.map((c) => (
              <option key={c.v} value={c.v}>
                {lang === "en" ? c.en : c.th}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{tr.nameTh}</label>
          <input disabled={!canApprove} value={nameTh} onChange={(e) => setNameTh(e.target.value)} className={field + " w-full"} />
        </div>
        <div>
          <label className={label}>{tr.nameEn}</label>
          <input disabled={!canApprove} value={nameEn ?? ""} onChange={(e) => setNameEn(e.target.value)} className={field + " w-full"} />
        </div>
        <div>
          <label className={label}>{tr.parentCode}</label>
          <input disabled={!canApprove} value={parentCode ?? ""} onChange={(e) => setParentCode(e.target.value)} className={field + " w-full"} />
        </div>
        <div>
          <label className={label}>{tr.sortOrder}</label>
          <input type="number" disabled={!canApprove} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={field + " w-full"} />
        </div>
      </div>
    </Modal>
  );
}

function ImportCsvModal({
  tr,
  toast,
  onClose,
  onImported,
}: {
  tr: Tr;
  toast: ToastApi;
  onClose: () => void;
  onImported: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseCoaCsv(text), [text]);

  async function doImport() {
    setBusy(true);
    const res = await importAccountsAction(parsed.rows);
    setBusy(false);
    if (res.ok) {
      toast.success(`${tr.imported}: ${res.data.imported}`);
      onImported();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  return (
    <Modal
      open
      onClose={onClose}
      className="max-w-2xl"
      title={tr.importCsv}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tr.cancel}
          </Button>
          <Button size="sm" onClick={doImport} loading={busy} disabled={!parsed.rows.length}>
            {tr.importCsv}
          </Button>
        </>
      }
    >
      <label className={label}>{tr.csvPlaceholder}</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        className={field + " w-full font-mono text-xs"}
        placeholder="code,name,name_en,category,parent_code"
      />
      {parsed.rows.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-[var(--app-fg-muted)]">
            {tr.preview} ({parsed.rows.length})
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--app-border)]">
            <table className="w-full text-xs">
              <tbody>
                {parsed.rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-[var(--app-border)] first:border-t-0">
                    <td className="px-2 py-1 font-mono">{r.code}</td>
                    <td className="px-2 py-1">{r.name_th}</td>
                    <td className="px-2 py-1 text-[var(--app-fg-muted)]">{categoryMeta(r.category).th}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── 3. Trial balance ─────────────────────────────────────────────────────────

function TrialBalanceTab({
  accounts,
  lang,
  tr,
  money,
  toast,
}: {
  accounts: Account[];
  lang: Lang;
  tr: Tr;
  money: (n: number) => string;
  toast: ToastApi;
}) {
  const today = new Date();
  const [from, setFrom] = useState(ymd(firstOfMonth(today)));
  const [to, setTo] = useState(ymd(lastOfMonth(today)));
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [rows, setRows] = useState<TbRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [ranOnce, setRanOnce] = useState(false);
  const [ledgerCode, setLedgerCode] = useState<string | null>(null);

  const summary = useMemo(() => summarizeTrialBalance(rows, accounts), [rows, accounts]);

  async function run() {
    setLoading(true);
    const res = await loadTrialBalance(from, to, includeDrafts);
    setLoading(false);
    setRanOnce(true);
    if (res.ok) setRows(res.data);
    else toast.error(`${res.code} · ${res.message}`);
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <label className={label}>{tr.from}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>{tr.to}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} /> {tr.includeDrafts}
        </label>
        <Button size="sm" onClick={run} loading={loading}>
          {tr.run}
        </Button>
      </div>

      {ranOnce && summary.rows.length === 0 ? (
        <p className="px-1 text-sm text-[var(--app-fg-muted)]">{tr.noData}</p>
      ) : (
        <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                <th className="px-4 py-2.5 font-medium">{tr.code}</th>
                <th className="px-4 py-2.5 font-medium">{tr.name}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.opening}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.periodDebit}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.periodCredit}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.closing}</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr
                  key={r.code}
                  onClick={() => setLedgerCode(r.code)}
                  className="cursor-pointer border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                >
                  <td className="px-4 py-2.5 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2.5">{lang === "en" ? r.name_en || r.name_th : r.name_th}</td>
                  <td className="px-4 py-2.5 text-right">{money(r.opening)}</td>
                  <td className="px-4 py-2.5 text-right">{money(r.period_debit)}</td>
                  <td className="px-4 py-2.5 text-right">{money(r.period_credit)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{money(r.closing)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--app-border)] font-semibold">
                <td className="px-4 py-2.5" colSpan={2}>
                  {tr.totals}
                </td>
                <td className="px-4 py-2.5 text-right">{money(summary.totals.openingDr - summary.totals.openingCr)}</td>
                <td className="px-4 py-2.5 text-right">{money(summary.totals.debit)}</td>
                <td className="px-4 py-2.5 text-right">{money(summary.totals.credit)}</td>
                <td className="px-4 py-2.5 text-right">{money(summary.totals.closingDr - summary.totals.closingCr)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {ledgerCode && (
        <LedgerModal
          code={ledgerCode}
          from={from}
          to={to}
          accounts={accounts}
          lang={lang}
          tr={tr}
          money={money}
          toast={toast}
          onClose={() => setLedgerCode(null)}
        />
      )}
    </div>
  );
}

function LedgerModal({
  code,
  from,
  to,
  accounts,
  lang,
  tr,
  money,
  toast,
  onClose,
}: {
  code: string;
  from: string;
  to: string;
  accounts: Account[];
  lang: Lang;
  tr: Tr;
  money: (n: number) => string;
  toast: ToastApi;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<LedgerLine[]>([]);
  const [loading, setLoading] = useState(true);
  const account = accounts.find((a) => a.code === code);

  useEffect(() => {
    let live = true;
    setLoading(true);
    loadLedger(code, from, to).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok) setRows(res.data);
      else toast.error(`${res.code} · ${res.message}`);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, from, to]);

  return (
    <Modal
      open
      onClose={onClose}
      className="max-w-3xl"
      title={`${tr.ledgerFor} · ${code}${account ? " · " + (lang === "en" ? account.name_en || account.name_th : account.name_th) : ""}`}
    >
      {loading ? (
        <p className="text-sm text-[var(--app-fg-muted)]">…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--app-fg-muted)]">{tr.noData}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                <th className="py-1.5 pr-2 font-medium">{tr.date}</th>
                <th className="py-1.5 px-2 font-medium">{tr.number}</th>
                <th className="py-1.5 px-2 font-medium">{tr.description}</th>
                <th className="py-1.5 px-2 text-right font-medium">{tr.debit}</th>
                <th className="py-1.5 pl-2 text-right font-medium">{tr.credit}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-t border-[var(--app-border)]">
                  <td className="py-1.5 pr-2 whitespace-nowrap text-[var(--app-fg-muted)]">{l.entry.entry_date}</td>
                  <td className="py-1.5 px-2">{l.entry.number ?? tr.draft}</td>
                  <td className="py-1.5 px-2">{l.entry.description || l.memo || "—"}</td>
                  <td className="py-1.5 px-2 text-right">{l.debit ? money(l.debit) : ""}</td>
                  <td className="py-1.5 pl-2 text-right">{l.credit ? money(l.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ── 4. P&L ───────────────────────────────────────────────────────────────────

function ProfitLossTab({
  accounts,
  lang,
  tr,
  money,
  toast,
}: {
  accounts: Account[];
  lang: Lang;
  tr: Tr;
  money: (n: number) => string;
  toast: ToastApi;
}) {
  const now = new Date();
  const [monthStr, setMonthStr] = useState(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
  const [monthRows, setMonthRows] = useState<TbRow[]>([]);
  const [ytdRows, setYtdRows] = useState<TbRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const [y, m] = monthStr.split("-").map(Number);
    if (!y || !m) return;
    const base = new Date(y, m - 1, 1);
    const from = ymd(firstOfMonth(base));
    const to = ymd(lastOfMonth(base));
    const ytdFrom = ymd(firstOfYear(base));
    let live = true;
    setLoading(true);
    Promise.all([loadTrialBalance(from, to), loadTrialBalance(ytdFrom, to)]).then(([mRes, yRes]) => {
      if (!live) return;
      setLoading(false);
      if (mRes.ok) setMonthRows(mRes.data);
      else toast.error(`${mRes.code} · ${mRes.message}`);
      if (yRes.ok) setYtdRows(yRes.data);
      else toast.error(`${yRes.code} · ${yRes.message}`);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStr]);

  const pl = useMemo(() => buildProfitAndLoss(monthRows, ytdRows, accounts), [monthRows, ytdRows, accounts]);

  return (
    <div>
      <div className="mb-3 flex items-end gap-2">
        <div>
          <label className={label}>{tr.month}</label>
          <input type="month" value={monthStr} onChange={(e) => setMonthStr(e.target.value)} className={field} />
        </div>
        {loading && <span className="pb-1.5 text-xs text-[var(--app-fg-muted)]">…</span>}
      </div>

      <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
              <th className="px-4 py-2.5 font-medium">{tr.code}</th>
              <th className="px-4 py-2.5 font-medium">{tr.name}</th>
              <th className="px-4 py-2.5 text-right font-medium">{tr.monthCol}</th>
              <th className="px-4 py-2.5 text-right font-medium">{tr.ytdCol}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[var(--app-border)] bg-[var(--app-surface-2)]">
              <td className="px-4 py-2 font-semibold" colSpan={4}>
                {tr.revenue}
              </td>
            </tr>
            {pl.revenue.map((l) => (
              <tr key={l.code} className="border-t border-[var(--app-border)]">
                <td className="px-4 py-2 font-mono text-xs">{l.code}</td>
                <td className="px-4 py-2">{lang === "en" ? l.name_en || l.name_th : l.name_th}</td>
                <td className="px-4 py-2 text-right">{money(l.month)}</td>
                <td className="px-4 py-2 text-right">{money(l.ytd)}</td>
              </tr>
            ))}
            <tr className="border-t border-[var(--app-border)] font-medium">
              <td className="px-4 py-2" colSpan={2}>
                {tr.totalRevenue}
              </td>
              <td className="px-4 py-2 text-right">{money(pl.totalRevenueMonth)}</td>
              <td className="px-4 py-2 text-right">{money(pl.totalRevenueYtd)}</td>
            </tr>

            <tr className="border-t border-[var(--app-border)] bg-[var(--app-surface-2)]">
              <td className="px-4 py-2 font-semibold" colSpan={4}>
                {tr.expense}
              </td>
            </tr>
            {pl.expense.map((l) => (
              <tr key={l.code} className="border-t border-[var(--app-border)]">
                <td className="px-4 py-2 font-mono text-xs">{l.code}</td>
                <td className="px-4 py-2">{lang === "en" ? l.name_en || l.name_th : l.name_th}</td>
                <td className="px-4 py-2 text-right">{money(l.month)}</td>
                <td className="px-4 py-2 text-right">{money(l.ytd)}</td>
              </tr>
            ))}
            <tr className="border-t border-[var(--app-border)] font-medium">
              <td className="px-4 py-2" colSpan={2}>
                {tr.totalExpense}
              </td>
              <td className="px-4 py-2 text-right">{money(pl.totalExpenseMonth)}</td>
              <td className="px-4 py-2 text-right">{money(pl.totalExpenseYtd)}</td>
            </tr>

            <tr className="border-t border-[var(--app-border)] text-base font-bold">
              <td className="px-4 py-3" colSpan={2}>
                {tr.netProfit}
              </td>
              <td className="px-4 py-3 text-right">{money(pl.netProfitMonth)}</td>
              <td className="px-4 py-3 text-right">{money(pl.netProfitYtd)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 5. Balance sheet ─────────────────────────────────────────────────────────

function BsColumn({
  title,
  lines,
  total,
  tr,
  lang,
  money,
}: {
  title: string;
  lines: { code: string; name_th: string; name_en?: string | null; amount: number }[];
  total: number;
  tr: Tr;
  lang: Lang;
  money: (n: number) => string;
}) {
  return (
    <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <table className="w-full text-sm">
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td className="py-1.5 text-[var(--app-fg-muted)]">{tr.noData}</td>
            </tr>
          ) : (
            lines.map((l, i) => (
              <tr key={l.code || i} className="border-t border-[var(--app-border)] first:border-t-0">
                <td className="py-1.5 pr-2 font-mono text-xs text-[var(--app-fg-muted)]">{l.code}</td>
                <td className="py-1.5 px-2">{lang === "en" ? l.name_en || l.name_th : l.name_th}</td>
                <td className="py-1.5 pl-2 text-right">{money(l.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--app-border)] font-semibold">
            <td className="py-2" colSpan={2}>
              {tr.totals}
            </td>
            <td className="py-2 text-right">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function BalanceSheetTab({
  accounts,
  lang,
  tr,
  money,
  toast,
}: {
  accounts: Account[];
  lang: Lang;
  tr: Tr;
  money: (n: number) => string;
  toast: ToastApi;
}) {
  const [asof, setAsof] = useState(ymd(new Date()));
  const [rows, setRows] = useState<TbRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    loadTrialBalance("1900-01-01", asof).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok) setRows(res.data);
      else toast.error(`${res.code} · ${res.message}`);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asof]);

  const bs = useMemo(() => buildBalanceSheet(rows, accounts), [rows, accounts]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <label className={label}>{tr.asOf}</label>
          <input type="date" value={asof} onChange={(e) => setAsof(e.target.value)} className={field} />
        </div>
        {loading && <span className="pb-1.5 text-xs text-[var(--app-fg-muted)]">…</span>}
        <span
          className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${
            bs.balanced ? "bg-[var(--app-success)]/15 text-[var(--app-success)]" : "bg-[var(--app-danger)]/15 text-[var(--app-danger)]"
          }`}
        >
          {bs.balanced ? tr.balancedOk : `${tr.diff}: ${money(bs.difference)}`}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BsColumn title={tr.assets} lines={bs.assets} total={bs.totalAssets} tr={tr} lang={lang} money={money} />
        <div className="space-y-4">
          <BsColumn title={tr.liabilities} lines={bs.liabilities} total={bs.totalLiabilities} tr={tr} lang={lang} money={money} />
          <BsColumn
            title={tr.equity}
            lines={[...bs.equity, { code: "", name_th: tr.netProfit, name_en: tr.netProfit, amount: bs.netProfit }]}
            total={bs.totalEquity}
            tr={tr}
            lang={lang}
            money={money}
          />
        </div>
      </div>
    </div>
  );
}

// ── 6. VAT ───────────────────────────────────────────────────────────────────

function VatReportTable({
  title,
  rows,
  kind,
  summary,
  tr,
  money,
  onExport,
}: {
  title: string;
  rows: ReportRow[];
  kind: "sales" | "purchase";
  summary: ReportSummary;
  tr: Tr;
  money: (n: number) => string;
  onExport: () => void;
}) {
  return (
    <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-2.5">
        <p className="text-sm font-semibold">
          {title} ({summary.count})
        </p>
        <Button size="sm" variant="ghost" onClick={onExport}>
          <Download size={14} /> {tr.exportCsv}
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
            <th className="px-4 py-2 font-medium">{tr.seq}</th>
            <th className="px-4 py-2 font-medium">{tr.docDate}</th>
            <th className="px-4 py-2 font-medium">{tr.docNumber}</th>
            <th className="px-4 py-2 font-medium">{kind === "sales" ? tr.customerName : tr.vendorName}</th>
            <th className="px-4 py-2 font-medium">{tr.taxId}</th>
            <th className="px-4 py-2 font-medium">{tr.branch}</th>
            <th className="px-4 py-2 text-right font-medium">{tr.netAmount}</th>
            <th className="px-4 py-2 text-right font-medium">{tr.vatAmount}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[var(--app-border)]">
              <td className="px-4 py-2">{String(r.seq ?? i + 1)}</td>
              <td className="px-4 py-2 whitespace-nowrap">{formatBEDate(r.doc_date)}</td>
              <td className="px-4 py-2">{String((kind === "sales" ? r.doc_number : r.doc_ref) ?? "")}</td>
              <td className="px-4 py-2">{String((kind === "sales" ? r.customer_name : r.vendor_name) ?? "")}</td>
              <td className="px-4 py-2">{String(r.tax_id ?? "")}</td>
              <td className="px-4 py-2">{String(r.branch ?? "")}</td>
              <td className="px-4 py-2 text-right">{money(Number(r.net_amount) || 0)}</td>
              <td className="px-4 py-2 text-right">{money(Number(r.vat_amount) || 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--app-border)] font-semibold">
            <td className="px-4 py-2" colSpan={6}>
              {tr.totals}
            </td>
            <td className="px-4 py-2 text-right">{money(summary.net)}</td>
            <td className="px-4 py-2 text-right">{money(summary.vat)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function VatTab({
  lang,
  tr,
  money,
  toast,
}: {
  lang: Lang;
  tr: Tr;
  money: (n: number) => string;
  toast: ToastApi;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<{ sales: ReportRow[]; purchase: ReportRow[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    loadVatReports(year, month).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok) setData(res.data);
      else toast.error(`${res.code} · ${res.message}`);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const pp30 = useMemo(() => pho30FromReports(data?.sales ?? [], data?.purchase ?? []), [data]);
  const salesSummary = useMemo(() => summarizeReport(data?.sales ?? []), [data]);
  const purchaseSummary = useMemo(() => summarizeReport(data?.purchase ?? []), [data]);
  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y, y - 1, y - 2, y - 3, y - 4];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function downloadCsv(kind: "sales" | "purchase") {
    const csv = kind === "sales" ? buildSalesReportCsv(data?.sales ?? []) : buildPurchaseReportCsv(data?.purchase ?? []);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-vat-${year}-${pad2(month)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <label className={label}>{tr.year}</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={field}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{tr.month}</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={field}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthLabel(year, m, lang)}
              </option>
            ))}
          </select>
        </div>
        {loading && <span className="pb-1.5 text-xs text-[var(--app-fg-muted)]">…</span>}
        <a href={`/print/vat?year=${year}&month=${month}`} target="_blank" rel="noreferrer" className="ml-auto">
          <Button size="sm" variant="ghost">
            <Printer size={14} /> {tr.printReport}
          </Button>
        </a>
      </div>

      <div className="app-surface mb-4 rounded-2xl border border-[var(--app-border)] p-4">
        <p className="mb-2 text-sm font-semibold">
          {tr.pp30} — {monthLabel(year, month, lang)}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <p className={label}>{tr.salesTotal}</p>
            <p className="text-sm font-medium">{money(pp30.salesTotal)}</p>
          </div>
          <div>
            <p className={label}>{tr.outputVat}</p>
            <p className="text-sm font-medium">{money(pp30.outputVat)}</p>
          </div>
          <div>
            <p className={label}>{tr.purchaseTotal}</p>
            <p className="text-sm font-medium">{money(pp30.purchaseTotal)}</p>
          </div>
          <div>
            <p className={label}>{tr.inputVat}</p>
            <p className="text-sm font-medium">{money(pp30.inputVat)}</p>
          </div>
          <div>
            <p className={label}>{tr.vatPayable}</p>
            <p className="text-sm font-medium text-[var(--app-danger)]">{money(pp30.vatPayable)}</p>
          </div>
          <div>
            <p className={label}>{tr.vatCreditCarry}</p>
            <p className="text-sm font-medium text-[var(--app-success)]">{money(pp30.vatCreditCarry)}</p>
          </div>
        </div>
      </div>

      <VatReportTable
        title={tr.salesReport}
        rows={data?.sales ?? []}
        kind="sales"
        summary={salesSummary}
        tr={tr}
        money={money}
        onExport={() => downloadCsv("sales")}
      />
      <div className="h-4" />
      <VatReportTable
        title={tr.purchaseReport}
        rows={data?.purchase ?? []}
        kind="purchase"
        summary={purchaseSummary}
        tr={tr}
        money={money}
        onExport={() => downloadCsv("purchase")}
      />
    </div>
  );
}

// ── 7. Period close ──────────────────────────────────────────────────────────

function PeriodCloseTab({
  initialPeriods,
  lang,
  tr,
  toast,
}: {
  initialPeriods: AccountingPeriod[];
  lang: Lang;
  tr: Tr;
  toast: ToastApi;
}) {
  const [periods, setPeriods] = useState<AccountingPeriod[]>(initialPeriods);
  const [busy, setBusy] = useState<string | null>(null);

  const months = useMemo(() => {
    const now = new Date();
    const list: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
    }
    return list;
  }, []);

  const byPeriod = useMemo(() => {
    const m = new Map<string, AccountingPeriod>();
    for (const p of periods) m.set(p.period, p);
    return m;
  }, [periods]);

  async function refresh() {
    const res = await loadPeriods();
    if (res.ok) setPeriods(res.data);
  }

  async function toggle(period: string, isClosed: boolean) {
    setBusy(period);
    const res = isClosed ? await reopenPeriodAction(period) : await closePeriodAction(period);
    setBusy(null);
    if (res.ok) {
      toast.success(tr.saved);
      refresh();
    } else toast.error(`${res.code} · ${res.message}`);
  }

  return (
    <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
            <th className="px-4 py-2.5 font-medium">{tr.period}</th>
            <th className="px-4 py-2.5 font-medium">{tr.status}</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const row = byPeriod.get(m);
            const isClosed = row?.status === "closed";
            return (
              <tr key={m} className="border-t border-[var(--app-border)]">
                <td className="px-4 py-2.5 font-medium">{monthLabel(Number(m.slice(0, 4)), Number(m.slice(5, 7)), lang)}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isClosed ? "bg-[var(--app-fg-muted)]/20 text-[var(--app-fg-muted)]" : "bg-[var(--app-success)]/15 text-[var(--app-success)]"
                    }`}
                  >
                    {isClosed ? tr.closedStatus : tr.openStatus}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" variant={isClosed ? "ghost" : "danger"} onClick={() => toggle(m, isClosed)} loading={busy === m}>
                    {isClosed ? tr.reopen : tr.close}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
