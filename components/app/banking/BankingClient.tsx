"use client";

// Bank reconciliation console. Three parts: (1) a bank-account register with an
// "Add account" modal, (2) an import card that parses a CSV client-side with the
// pure parser for a live preview before anything touches the server, (3) the
// statement list + a per-statement line-matching view (suggested match via the
// greedy suggestMatches() helper, or a manual override) against PMS payments and
// paid expenses. Reads are open to every role; every write (add account, import,
// match/unmatch/ignore) is gated behind `canApprove` — mirrors the hotel-pms
// banking permission (owner/admin rw, others read-only).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Landmark, Plus, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import Button from "@/components/app/ui/Button";
import Modal from "@/components/app/ui/Modal";
import EmptyState from "@/components/app/ui/EmptyState";
import { useToast } from "@/components/app/ui/Toast";
import { parseStatementCsv, suggestMatches, paymentCandidate, expenseCandidate } from "@/lib/accounting/banking";
import {
  loadStatement,
  loadCandidates,
  createBankAccountAction,
  importStatementAction,
  matchLineAction,
  unmatchLineAction,
  ignoreLineAction,
} from "@/app/app/banking/actions";
import type {
  BankAccount,
  BankStatement,
  BankStatementLine,
  CandidateSources,
  StatementRow,
  Candidate,
} from "@/lib/db/banking";

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--app-fg-muted)]";

const STR = {
  th: {
    title: "ธนาคาร",
    accountsTitle: "บัญชีธนาคาร",
    addAccount: "เพิ่มบัญชี",
    noAccounts: "ยังไม่มีบัญชีธนาคาร",
    noAccountsHint: "เพิ่มบัญชีธนาคารก่อนนำเข้ารายการเดินบัญชี",
    accName: "ชื่อบัญชี",
    accBank: "ธนาคาร",
    accNo: "เลขที่บัญชี",
    cancel: "ยกเลิก",
    create: "สร้าง",
    importTitle: "นำเข้ารายการเดินบัญชี",
    selectAccount: "บัญชีธนาคาร",
    pickAccount: "เลือกบัญชี…",
    chooseFile: "เลือกไฟล์ CSV",
    preview: "ตัวอย่างรายการ",
    layout: "รูปแบบไฟล์",
    parseErrors: "ข้อผิดพลาดในการอ่านไฟล์",
    rowsFound: "แถวที่อ่านได้",
    importBtn: "นำเข้ารายการ",
    imported: "นำเข้ารายการเรียบร้อย",
    statementsTitle: "รายการเดินบัญชีที่นำเข้า",
    noStatements: "ยังไม่มีการนำเข้ารายการเดินบัญชี",
    noStatementsHint: "นำเข้าไฟล์ CSV จากธนาคารของคุณด้านบน",
    filename: "ไฟล์",
    period: "ช่วงเวลา",
    createdAt: "นำเข้าเมื่อ",
    lines: "รายการ",
    matchedCount: "จับคู่แล้ว",
    unmatchedCount: "ยังไม่จับคู่",
    ignoredCount: "ข้ามแล้ว",
    moneyIn: "เงินเข้า",
    moneyOut: "เงินออก",
    colDate: "วันที่",
    colDesc: "รายละเอียด",
    colAmount: "จำนวนเงิน",
    colBalance: "คงเหลือ",
    colStatus: "สถานะ",
    colMatch: "จับคู่",
    suggested: "แนะนำ",
    match: "จับคู่",
    unmatchBtn: "ยกเลิกจับคู่",
    ignoreBtn: "ข้าม",
    pickCandidate: "เลือกรายการที่ตรงกัน…",
    payment: "การชำระเงิน",
    expense: "ค่าใช้จ่าย",
    journal: "สมุดรายวัน",
    statusUnmatched: "ยังไม่จับคู่",
    statusMatched: "จับคู่แล้ว",
    statusIgnored: "ข้ามแล้ว",
    loading: "กำลังโหลด…",
    staffNote: "เฉพาะเจ้าของหรือผู้ดูแลระบบเท่านั้นที่นำเข้ารายการเดินบัญชีและจับคู่รายการได้",
  },
  en: {
    title: "Banking",
    accountsTitle: "Bank accounts",
    addAccount: "Add account",
    noAccounts: "No bank accounts yet",
    noAccountsHint: "Add a bank account before importing a statement.",
    accName: "Account name",
    accBank: "Bank",
    accNo: "Account number",
    cancel: "Cancel",
    create: "Create",
    importTitle: "Import statement",
    selectAccount: "Bank account",
    pickAccount: "Choose an account…",
    chooseFile: "Choose CSV file",
    preview: "Preview",
    layout: "Layout",
    parseErrors: "Parse errors",
    rowsFound: "rows parsed",
    importBtn: "Import rows",
    imported: "Statement imported",
    statementsTitle: "Imported statements",
    noStatements: "No statements imported yet",
    noStatementsHint: "Import a CSV from your bank above.",
    filename: "File",
    period: "Period",
    createdAt: "Imported on",
    lines: "lines",
    matchedCount: "Matched",
    unmatchedCount: "Unmatched",
    ignoredCount: "Ignored",
    moneyIn: "Money in",
    moneyOut: "Money out",
    colDate: "Date",
    colDesc: "Description",
    colAmount: "Amount",
    colBalance: "Balance",
    colStatus: "Status",
    colMatch: "Match",
    suggested: "Suggested",
    match: "Match",
    unmatchBtn: "Unmatch",
    ignoreBtn: "Ignore",
    pickCandidate: "Pick a match…",
    payment: "Payment",
    expense: "Expense",
    journal: "Journal",
    statusUnmatched: "Unmatched",
    statusMatched: "Matched",
    statusIgnored: "Ignored",
    loading: "Loading…",
    staffNote: "Only an owner or admin can import statements and match lines.",
  },
} as const;

type Tr = { [K in keyof (typeof STR)["en"]]: string };

export default function BankingClient({
  accounts,
  statements,
  canApprove,
  currency,
}: {
  accounts: BankAccount[];
  statements: BankStatement[];
  canApprove: boolean;
  currency: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "th";
  const tr = STR[lang];

  const money = (n: number) =>
    `${currency} ${Number(n).toLocaleString(lang === "en" ? "en-US" : "th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const signedMoney = (n: number) => {
    const v = Number(n) || 0;
    const color = v > 0 ? "var(--app-success)" : v < 0 ? "var(--app-danger)" : undefined;
    const sign = v > 0 ? "+ " : v < 0 ? "− " : "";
    return <span style={{ color }}>{sign}{money(Math.abs(v))}</span>;
  };

  const candLabel = (c: Candidate) => {
    const kind = c.type === "payment" ? tr.payment : tr.expense;
    return `${kind} · ${c.label || "—"} · ${money(Math.abs(c.amount))}${c.date ? ` · ${c.date}` : ""}`;
  };

  // ── bank accounts ──────────────────────────────────────────────────────────
  const [localAccounts, setLocalAccounts] = useState<BankAccount[]>(accounts);
  const [acctOpen, setAcctOpen] = useState(false);
  const [acctBusy, setAcctBusy] = useState(false);

  async function addAccount(input: { name: string; bank: string; account_no: string }) {
    setAcctBusy(true);
    const res = await createBankAccountAction({
      name: input.name,
      bank: input.bank || null,
      account_no: input.account_no || null,
    });
    setAcctBusy(false);
    if (!res.ok) {
      toast.error(`${res.code} · ${res.message}`);
      return;
    }
    setLocalAccounts((l) => [...l, res.data]);
    setImportAccountId(res.data.id);
    setAcctOpen(false);
    router.refresh();
  }

  // ── import ─────────────────────────────────────────────────────────────────
  const [importAccountId, setImportAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<{ rows: StatementRow[]; errors: string[]; layout: string } | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [importBusy, setImportBusy] = useState(false);

  async function onFileChange(f: File | null) {
    setFile(f);
    setParsed(null);
    if (!f) return;
    const text = await f.text();
    setParsed(parseStatementCsv(text));
  }

  async function doImport() {
    if (!importAccountId || !parsed || !parsed.rows.length) return;
    setImportBusy(true);
    const res = await importStatementAction({
      bankAccountId: importAccountId,
      filename: file?.name ?? null,
      rows: parsed.rows,
    });
    setImportBusy(false);
    if (!res.ok) {
      toast.error(`${res.code} · ${res.message}`);
      return;
    }
    toast.success(`${tr.imported} (${res.data.count})`);
    setFile(null);
    setParsed(null);
    setFileKey((k) => k + 1);
    router.refresh();
  }

  // ── statement + lines ──────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statement, setStatement] = useState<BankStatement | null>(null);
  const [lines, setLines] = useState<BankStatementLine[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [candidateSources, setCandidateSources] = useState<CandidateSources | null>(null);
  const [lineBusy, setLineBusy] = useState<string | null>(null);

  async function openStatement(id: string) {
    setSelectedId(id);
    setLoadingStatement(true);
    const [res, candRes] = await Promise.all([
      loadStatement(id),
      candidateSources ? Promise.resolve({ ok: true as const, data: candidateSources }) : loadCandidates(),
    ]);
    setLoadingStatement(false);
    if (res.ok) {
      setStatement(res.data.statement);
      setLines(res.data.lines);
    } else {
      toast.error(`${res.code} · ${res.message}`);
    }
    if (!candidateSources) {
      if (candRes.ok) setCandidateSources(candRes.data);
      else toast.error(`${candRes.code} · ${candRes.message}`);
    }
  }

  async function reloadLines(id: string) {
    const res = await loadStatement(id);
    if (res.ok) {
      setStatement(res.data.statement);
      setLines(res.data.lines);
    }
  }

  const allCandidates = useMemo<Candidate[]>(() => {
    if (!candidateSources) return [];
    return [...candidateSources.payments.map(paymentCandidate), ...candidateSources.expenses.map(expenseCandidate)];
  }, [candidateSources]);

  const suggestions = useMemo(() => {
    const unmatched = lines.filter((l) => l.status === "unmatched");
    const m = new Map<string, { candidate: Candidate; dayDiff: number | null; sameSign: boolean }>();
    if (!unmatched.length || !allCandidates.length) return m;
    for (const s of suggestMatches(unmatched, allCandidates)) {
      if (s.lineId != null) m.set(String(s.lineId), s);
    }
    return m;
  }, [lines, allCandidates]);

  function matchedLabel(line: BankStatementLine): string {
    if (!line.matched_type || !line.matched_id) return "—";
    if (line.matched_type === "journal") return `${tr.journal} #${String(line.matched_id).slice(0, 8)}`;
    const cand = allCandidates.find((c) => c.type === line.matched_type && String(c.id) === String(line.matched_id));
    if (cand) return candLabel(cand);
    return `${line.matched_type === "payment" ? tr.payment : tr.expense} #${String(line.matched_id).slice(0, 8)}`;
  }

  async function doMatch(lineId: string, cand: Candidate) {
    setLineBusy(lineId);
    const res = await matchLineAction(lineId, { type: cand.type, id: String(cand.id) });
    setLineBusy(null);
    if (!res.ok) {
      toast.error(`${res.code} · ${res.message}`);
      return;
    }
    if (selectedId) reloadLines(selectedId);
  }

  async function doUnmatch(lineId: string) {
    setLineBusy(lineId);
    const res = await unmatchLineAction(lineId);
    setLineBusy(null);
    if (!res.ok) {
      toast.error(`${res.code} · ${res.message}`);
      return;
    }
    if (selectedId) reloadLines(selectedId);
  }

  async function doIgnore(lineId: string) {
    setLineBusy(lineId);
    const res = await ignoreLineAction(lineId);
    setLineBusy(null);
    if (!res.ok) {
      toast.error(`${res.code} · ${res.message}`);
      return;
    }
    if (selectedId) reloadLines(selectedId);
  }

  const summary = useMemo(() => {
    let matched = 0;
    let unmatched = 0;
    let ignored = 0;
    let moneyIn = 0;
    let moneyOut = 0;
    for (const l of lines) {
      if (l.status === "matched") matched++;
      else if (l.status === "ignored") ignored++;
      else unmatched++;
      const amt = Number(l.amount) || 0;
      if (amt > 0) moneyIn += amt;
      else moneyOut += amt;
    }
    return { count: lines.length, matched, unmatched, ignored, moneyIn, moneyOut };
  }, [lines]);

  return (
    <div className="mx-auto max-w-[1300px]">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
      </div>

      {/* Bank accounts */}
      <div className="app-surface mb-4 rounded-2xl border border-[var(--app-border)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Landmark size={16} className="text-[var(--app-accent)]" />
          <span className="text-sm font-semibold">{tr.accountsTitle}</span>
          {canApprove && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAcctOpen(true)}>
              <Plus size={14} /> {tr.addAccount}
            </Button>
          )}
        </div>
        {localAccounts.length === 0 ? (
          <EmptyState icon={<Building2 size={20} />} title={tr.noAccounts} hint={tr.noAccountsHint} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {localAccounts.map((a) => (
              <span
                key={a.id}
                className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-1 text-xs"
              >
                {a.name}
                {a.bank ? ` · ${a.bank}` : ""}
                {a.account_no ? ` · ${a.account_no}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Import */}
      <div className="app-surface mb-4 rounded-2xl border border-[var(--app-border)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Upload size={16} className="text-[var(--app-accent)]" />
          <span className="text-sm font-semibold">{tr.importTitle}</span>
        </div>
        {localAccounts.length === 0 ? (
          <p className="text-sm text-[var(--app-fg-muted)]">{tr.noAccountsHint}</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                value={importAccountId}
                onChange={(e) => setImportAccountId(e.target.value)}
                className={field}
                disabled={!canApprove}
              >
                <option value="">{tr.pickAccount}</option>
                {localAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input
                key={fileKey}
                type="file"
                accept=".csv,text/csv"
                disabled={!canApprove}
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                className="text-sm text-[var(--app-fg-muted)] file:mr-2 file:rounded-lg file:border file:border-[var(--app-border)] file:bg-[var(--app-surface-2)] file:px-2.5 file:py-1.5 file:text-xs file:font-medium disabled:opacity-60"
              />
            </div>

            {parsed && (
              <div className="mb-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-3 text-xs text-[var(--app-fg-muted)]">
                  <span>{tr.preview} — {parsed.rows.length} {tr.rowsFound}</span>
                  <span>{tr.layout}: {parsed.layout}</span>
                  {parsed.errors.length > 0 && (
                    <span className="text-[var(--app-danger)]">{tr.parseErrors}: {parsed.errors.join(", ")}</span>
                  )}
                </div>
                {parsed.rows.length > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--app-border)]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[var(--app-surface)]">
                        <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                          <th className="px-3 py-1.5 font-medium">{tr.colDate}</th>
                          <th className="px-3 py-1.5 font-medium">{tr.colDesc}</th>
                          <th className="px-3 py-1.5 text-right font-medium">{tr.colAmount}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.map((r, i) => (
                          <tr key={i} className="border-t border-[var(--app-border)]">
                            <td className="whitespace-nowrap px-3 py-1.5">{r.txn_date}</td>
                            <td className="px-3 py-1.5">{r.description || "—"}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 text-right">{signedMoney(r.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {canApprove && parsed.rows.length > 0 && (
                  <div className="mt-3">
                    <Button size="sm" onClick={doImport} loading={importBusy} disabled={!importAccountId}>
                      {tr.importBtn} ({parsed.rows.length})
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Statements list */}
      <div className="app-surface mb-4 rounded-2xl border border-[var(--app-border)]">
        <div className="flex items-center gap-2 px-4 pt-4">
          <span className="text-sm font-semibold">{tr.statementsTitle}</span>
        </div>
        {statements.length === 0 ? (
          <EmptyState icon={<FileText size={20} />} title={tr.noStatements} hint={tr.noStatementsHint} />
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                  <th className="px-2 py-1.5 font-medium">{tr.filename}</th>
                  <th className="px-2 py-1.5 font-medium">{tr.period}</th>
                  <th className="px-2 py-1.5 font-medium">{tr.createdAt}</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => openStatement(s.id)}
                    className={`cursor-pointer border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)] ${
                      selectedId === s.id ? "bg-[var(--app-surface-2)]" : ""
                    }`}
                  >
                    <td className="px-2 py-2 font-medium">{s.filename || "—"}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-[var(--app-fg-muted)]">
                      {s.period_from ?? "—"} → {s.period_to ?? "—"}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-[var(--app-fg-muted)]">
                      {new Date(s.created_at).toLocaleString(lang === "en" ? "en-US" : "th-TH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected statement */}
      {selectedId && (
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4">
          {loadingStatement ? (
            <p className="py-8 text-center text-sm text-[var(--app-fg-muted)]">{tr.loading}</p>
          ) : statement ? (
            <>
              {/* Summary bar */}
              <div className="mb-4 flex flex-wrap gap-4 text-sm">
                <span>{summary.count} {tr.lines}</span>
                <span className="text-[var(--app-fg-muted)]">{tr.matchedCount}: {summary.matched}</span>
                <span className="text-[var(--app-fg-muted)]">{tr.unmatchedCount}: {summary.unmatched}</span>
                <span className="text-[var(--app-fg-muted)]">{tr.ignoredCount}: {summary.ignored}</span>
                <span>{tr.moneyIn}: {signedMoney(summary.moneyIn)}</span>
                <span>{tr.moneyOut}: {signedMoney(summary.moneyOut)}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                      <th className="px-2 py-1.5 font-medium">{tr.colDate}</th>
                      <th className="px-2 py-1.5 font-medium">{tr.colDesc}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{tr.colAmount}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{tr.colBalance}</th>
                      <th className="px-2 py-1.5 font-medium">{tr.colStatus}</th>
                      <th className="px-2 py-1.5 font-medium">{tr.colMatch}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const busy = lineBusy === l.id;
                      const suggestion = suggestions.get(String(l.id));
                      return (
                        <tr key={l.id} className="border-t border-[var(--app-border)] align-top">
                          <td className="whitespace-nowrap px-2 py-2">{l.txn_date}</td>
                          <td className="px-2 py-2">{l.description || "—"}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">{signedMoney(l.amount)}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right text-[var(--app-fg-muted)]">
                            {l.balance != null ? money(l.balance) : "—"}
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                              style={{
                                background:
                                  l.status === "matched"
                                    ? "var(--app-success)"
                                    : l.status === "ignored"
                                      ? "var(--app-fg-muted)"
                                      : "var(--app-accent)",
                                color: "var(--app-accent-fg)",
                              }}
                            >
                              {l.status === "matched" ? tr.statusMatched : l.status === "ignored" ? tr.statusIgnored : tr.statusUnmatched}
                            </span>
                          </td>
                          <td className="min-w-[16rem] px-2 py-2">
                            {l.status === "matched" && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-[var(--app-fg-muted)]">{matchedLabel(l)}</span>
                                {canApprove && (
                                  <Button size="sm" variant="ghost" onClick={() => doUnmatch(l.id)} loading={busy}>
                                    {tr.unmatchBtn}
                                  </Button>
                                )}
                              </div>
                            )}
                            {l.status === "unmatched" && canApprove && (
                              <div className="flex flex-col gap-1.5">
                                {suggestion && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs text-[var(--app-fg-muted)]">
                                      {tr.suggested}: {candLabel(suggestion.candidate)}
                                      {suggestion.dayDiff != null ? ` (${suggestion.dayDiff}d)` : ""}
                                    </span>
                                    <Button size="sm" onClick={() => doMatch(l.id, suggestion.candidate)} loading={busy}>
                                      {tr.match}
                                    </Button>
                                  </div>
                                )}
                                <select
                                  value=""
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (!val) return;
                                    const idx = val.indexOf(":");
                                    const type = val.slice(0, idx) as Candidate["type"];
                                    const id = val.slice(idx + 1);
                                    const cand = allCandidates.find((c) => c.type === type && String(c.id) === id);
                                    if (cand) doMatch(l.id, cand);
                                  }}
                                  className={field + " text-xs"}
                                  disabled={busy}
                                >
                                  <option value="">{tr.pickCandidate}</option>
                                  {allCandidates.map((c) => (
                                    <option key={`${c.type}:${c.id}`} value={`${c.type}:${c.id}`}>
                                      {candLabel(c)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {l.status !== "ignored" && canApprove && (
                              <button
                                onClick={() => doIgnore(l.id)}
                                disabled={busy}
                                className="mt-1.5 text-xs text-[var(--app-fg-muted)] hover:text-[var(--app-danger)]"
                              >
                                {tr.ignoreBtn}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}

      {!canApprove && (
        <p className="mt-3 text-xs text-[var(--app-fg-muted)]">{tr.staffNote}</p>
      )}

      <AddAccountModal open={acctOpen} onClose={() => setAcctOpen(false)} tr={tr} busy={acctBusy} onCreate={addAccount} />
    </div>
  );
}

function AddAccountModal({
  open,
  onClose,
  tr,
  busy,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  tr: Tr;
  busy: boolean;
  onCreate: (i: { name: string; bank: string; account_no: string }) => void;
}) {
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [accountNo, setAccountNo] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr.addAccount}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tr.cancel}
          </Button>
          <Button
            size="sm"
            loading={busy}
            onClick={() => name.trim() && onCreate({ name: name.trim(), bank: bank.trim(), account_no: accountNo.trim() })}
          >
            {tr.create}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div>
          <label className={label}>{tr.accName}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field + " w-full"} />
        </div>
        <div>
          <label className={label}>{tr.accBank}</label>
          <input value={bank} onChange={(e) => setBank(e.target.value)} className={field + " w-full"} />
        </div>
        <div>
          <label className={label}>{tr.accNo}</label>
          <input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className={field + " w-full"} />
        </div>
      </div>
    </Modal>
  );
}
