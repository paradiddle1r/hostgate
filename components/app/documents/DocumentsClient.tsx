"use client";

// Sales-document register for the active property. Tabs per doc_type, a status
// filter + search, and "New …" buttons that mint a draft then open the editor.
// Document numbers are per-TENANT sequences (shared across a tenant's
// properties) — the copy never implies per-property numbering.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import EmptyState from "@/components/app/ui/EmptyState";
import Button from "@/components/app/ui/Button";
import { useToast } from "@/components/app/ui/Toast";
import { DOC_TYPES, DOC_STATUSES, docStatusMeta, newDocumentDraft } from "@/lib/accounting/documents";
import { createDocumentAction } from "@/app/app/documents/actions";
import type { SalesDocument, DocType, DocStatus } from "@/lib/db/documents";
import type { TenantRole } from "@/lib/active-role-server";

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

const STR = {
  th: {
    title: "เอกสารขาย",
    count: "รายการ",
    search: "ค้นหาชื่อ / เลขที่",
    all: "ทั้งหมด",
    status: "สถานะ",
    newDoc: "สร้างเอกสาร",
    number: "เลขที่",
    draft: "ฉบับร่าง",
    customer: "ลูกค้า",
    date: "วันที่",
    total: "ยอดรวม",
    empty: "ยังไม่มีเอกสาร",
    emptyHint: "สร้างใบเสนอราคา ใบวางบิล หรือขายเงินสดใบแรก",
  },
  en: {
    title: "Sales documents",
    count: "documents",
    search: "Search name / number",
    all: "All",
    status: "Status",
    newDoc: "New document",
    number: "Number",
    draft: "Draft",
    customer: "Customer",
    date: "Date",
    total: "Total",
    empty: "No documents yet",
    emptyHint: "Create your first quotation, billing note or cash sale.",
  },
} as const;

export default function DocumentsClient({
  documents,
  role,
  currency,
  vatRate,
  vatInclusive,
}: {
  documents: SalesDocument[];
  role: TenantRole | null;
  currency: string;
  vatRate: number;
  vatInclusive: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "th";
  const tr = STR[lang];

  const [tab, setTab] = useState<DocType | "all">("all");
  const [status, setStatus] = useState<DocStatus | "all">("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const money = (n: number) => `${currency} ${Number(n).toLocaleString(lang === "en" ? "en-US" : "th-TH")}`;
  const typeLabel = (t: DocType) => {
    const meta = DOC_TYPES.find((d) => d.type === t);
    return meta ? (lang === "en" ? meta.en : meta.th) : t;
  };
  const statusLabel = (s: DocStatus) => {
    const meta = docStatusMeta(s);
    return lang === "en" ? meta.en : meta.th;
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return documents.filter((d) => {
      if (tab !== "all" && d.doc_type !== tab) return false;
      if (status !== "all" && d.status !== status) return false;
      if (!needle) return true;
      return (
        (d.customer_name ?? "").toLowerCase().includes(needle) ||
        (d.number ?? "").toLowerCase().includes(needle)
      );
    });
  }, [documents, tab, status, q]);

  async function createNew(docType: DocType) {
    setBusy(true);
    const header = newDocumentDraft(docType, { settings: { currency, vat_rate: vatRate, vat_inclusive: vatInclusive } });
    const res = await createDocumentAction(header as Record<string, unknown>, []);
    setBusy(false);
    if (res.ok) router.push(`/app/documents/${res.data.id}`);
    else toast.error(`${res.code} · ${res.message}`);
  }

  return (
    <div className="mx-auto max-w-[1700px]">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tr.title}</h1>
        <span className="text-sm text-[var(--app-fg-muted)]">
          {rows.length} {tr.count}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {DOC_TYPES.map((d) => (
            <Button key={d.type} size="sm" variant="ghost" onClick={() => createNew(d.type as DocType)} loading={busy}>
              <Plus size={14} /> {lang === "en" ? d.en : d.th}
            </Button>
          ))}
        </div>
      </div>

      {/* Type tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", ...DOC_TYPES.map((d) => d.type)] as (DocType | "all")[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
              tab === t
                ? "bg-[var(--app-accent)] text-[var(--app-accent-fg)]"
                : "text-[var(--app-fg-muted)] hover:bg-[var(--app-surface-2)]"
            }`}
          >
            {t === "all" ? tr.all : typeLabel(t as DocType)}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-fg-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr.search} className={`${field} w-full pl-8`} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as DocStatus | "all")} className={field}>
          <option value="all">{tr.status}: {tr.all}</option>
          {DOC_STATUSES.map((s) => (
            <option key={s.v} value={s.v}>{statusLabel(s.v as DocStatus)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="app-surface rounded-2xl border border-[var(--app-border)]">
          <EmptyState icon={<FileText size={22} />} title={tr.empty} hint={tr.emptyHint} />
        </div>
      ) : (
        <div className="app-surface overflow-x-auto rounded-2xl border border-[var(--app-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[var(--app-fg-muted)]">
                <th className="px-4 py-2.5 font-medium">{tr.number}</th>
                <th className="px-4 py-2.5 font-medium">{tr.customer}</th>
                <th className="px-4 py-2.5 font-medium">{tr.date}</th>
                <th className="px-4 py-2.5 text-right font-medium">{tr.total}</th>
                <th className="px-4 py-2.5 font-medium">{tr.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const meta = docStatusMeta(d.status);
                const isVoid = d.status === "void";
                return (
                  <tr
                    key={d.id}
                    onClick={() => router.push(`/app/documents/${d.id}`)}
                    className="cursor-pointer border-t border-[var(--app-border)] hover:bg-[var(--app-surface-2)]"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {d.number ?? <span className="text-[var(--app-fg-muted)]">{tr.draft}</span>}
                      <span className="ml-2 text-xs text-[var(--app-fg-muted)]">{typeLabel(d.doc_type)}</span>
                    </td>
                    <td className={`px-4 py-2.5 ${isVoid ? "text-[var(--app-fg-muted)] line-through" : ""}`}>
                      {d.customer_name || "—"}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-[var(--app-fg-muted)]">{d.issue_date}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{money(d.total)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ background: meta.color, opacity: isVoid ? 0.7 : 1 }}
                      >
                        {statusLabel(d.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {role === "staff" && (
        <p className="mt-3 text-xs text-[var(--app-fg-muted)]">
          {lang === "en"
            ? "You can create and submit documents; an owner or admin approves them."
            : "คุณสร้างและส่งเอกสารเพื่อขออนุมัติได้ เจ้าของหรือผู้ดูแลเป็นผู้อนุมัติ"}
        </p>
      )}
    </div>
  );
}
