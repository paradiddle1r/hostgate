"use client";

// Stand-alone print view for the monthly VAT reports (รายงานภาษีขาย /
// รายงานภาษีซื้อ) + the ภ.พ.30 summary. Client component: TH/EN toggle + auto
// window.print(). Reads ?year=&month= from the query and pulls data through
// loadVatForPrint (RLS-scoped). The report numbers come straight from the DB
// report RPCs; this view only lays them out in the Thai Revenue Dept format.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loadVatForPrint, type PrintVatPayload } from "@/app/app/accounting/actions";
import { monthLabel, formatBEDate, summarizeReport, pho30FromReports, type ReportRow } from "@/lib/accounting/vat";

type Lang = "th" | "en";

const STR: Record<Lang, Record<string, string>> = {
  th: {
    salesTitle: "รายงานภาษีขาย", purchaseTitle: "รายงานภาษีซื้อ", period: "ประจำเดือน",
    taxId: "เลขประจำตัวผู้เสียภาษี", branch: "สาขา", seq: "ลำดับ", date: "วันที่",
    docNo: "เลขที่เอกสาร", name: "ชื่อผู้ประกอบการ", net: "มูลค่าสินค้า/บริการ", vat: "ภาษีมูลค่าเพิ่ม",
    total: "รวม", pho30: "สรุป ภ.พ.30", salesNet: "ยอดขายที่ต้องเสียภาษี", outputVat: "ภาษีขาย",
    purchaseNet: "ยอดซื้อที่มีสิทธิ", inputVat: "ภาษีซื้อ", payable: "ภาษีที่ต้องชำระ",
    carry: "ภาษีที่ชำระเกิน (ยกไป)", print: "พิมพ์", back: "ย้อนกลับ", loading: "กำลังโหลด…", none: "ไม่มีรายการ",
  },
  en: {
    salesTitle: "Sales VAT Report", purchaseTitle: "Purchase VAT Report", period: "For",
    taxId: "Tax ID", branch: "Branch", seq: "No.", date: "Date",
    docNo: "Document no.", name: "Name", net: "Net value", vat: "VAT",
    total: "Total", pho30: "PP30 summary", salesNet: "Taxable sales", outputVat: "Output VAT",
    purchaseNet: "Eligible purchases", inputVat: "Input VAT", payable: "VAT payable",
    carry: "VAT credit carried forward", print: "Print", back: "Back", loading: "Loading…", none: "No entries",
  },
};

const money = (n: unknown) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ReportTable({
  t, lang, rows, docField, nameField,
}: {
  t: Record<string, string>;
  lang: Lang;
  rows: ReportRow[];
  docField: string;
  nameField: string;
}) {
  const sum = summarizeReport(rows);
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-y border-zinc-300 text-left uppercase text-zinc-500">
          <th className="py-1.5 pr-2 font-semibold">{t.seq}</th>
          <th className="py-1.5 px-2 font-semibold">{t.date}</th>
          <th className="py-1.5 px-2 font-semibold">{t.docNo}</th>
          <th className="py-1.5 px-2 font-semibold">{t.name}</th>
          <th className="py-1.5 px-2 font-semibold">{t.taxId}</th>
          <th className="py-1.5 px-2 text-right font-semibold">{t.net}</th>
          <th className="py-1.5 pl-2 text-right font-semibold">{t.vat}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={7} className="py-3 text-center text-zinc-400">{t.none}</td></tr>
        ) : (
          rows.map((r, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="py-1.5 pr-2">{String(r.seq ?? i + 1)}</td>
              <td className="py-1.5 px-2 whitespace-nowrap">{formatBEDate(r.doc_date)}</td>
              <td className="py-1.5 px-2">{String(r[docField] ?? "")}</td>
              <td className="py-1.5 px-2">{String(r[nameField] ?? "")}</td>
              <td className="py-1.5 px-2">{String(r.tax_id ?? "")}{r.branch ? ` (${String(r.branch)})` : ""}</td>
              <td className="py-1.5 px-2 text-right">{money(r.net_amount)}</td>
              <td className="py-1.5 pl-2 text-right">{money(r.vat_amount)}</td>
            </tr>
          ))
        )}
        <tr className="border-t border-zinc-300 font-bold">
          <td className="py-1.5" colSpan={5}>{t.total}</td>
          <td className="py-1.5 text-right">{money(sum.net)}</td>
          <td className="py-1.5 text-right">{money(sum.vat)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// useSearchParams() forces a client-side bailout, so this static route must sit
// behind a Suspense boundary or `next build` fails prerendering it.
export default function PrintVatPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-12 text-center text-zinc-500">…</div>}>
      <PrintVatInner />
    </Suspense>
  );
}

function PrintVatInner() {
  const search = useSearchParams();
  const now = new Date();
  const year = Number(search.get("year")) || now.getFullYear();
  const month = Number(search.get("month")) || now.getMonth() + 1;
  const [lang, setLang] = useState<Lang>(search.get("lang") === "en" ? "en" : "th");
  const [data, setData] = useState<PrintVatPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadVatForPrint(year, month).then((res) => {
      if (!alive) return;
      if (res.ok) setData(res.data);
      else setErr(`${res.code} · ${res.message}`);
    });
    return () => {
      alive = false;
    };
  }, [year, month]);

  useEffect(() => {
    if (!data) return;
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, [data]);

  const t = STR[lang];
  if (err) return <div className="mx-auto max-w-2xl p-12 text-center text-zinc-900">{err}</div>;
  if (!data) return <div className="mx-auto max-w-2xl p-12 text-center text-zinc-500">{t.loading}</div>;

  const { property, sales, purchase } = data;
  const pho = pho30FromReports(sales, purchase);
  const companyName = lang === "th" ? property?.legal_name_th || property?.legal_name || property?.name : property?.legal_name || property?.name;
  const label = monthLabel(year, month, lang);

  return (
    <div className="min-h-screen bg-zinc-100 py-8 text-zinc-900 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 12mm; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-6 no-print">
        <a href="/app/accounting" className="text-sm text-zinc-500 hover:underline">← {t.back}</a>
        <div className="flex items-center gap-2">
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm">
            <option value="th">TH</option>
            <option value="en">EN</option>
          </select>
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">{t.print}</button>
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] space-y-6 bg-white p-10 shadow-sm print:shadow-none">
        <div className="text-center">
          <h1 className="text-base font-bold">{companyName || "—"}</h1>
          {property?.tax_id && <p className="text-sm text-zinc-600">{t.taxId}: {property.tax_id}</p>}
          <p className="text-sm text-zinc-500">{t.period} {label}</p>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold">{t.salesTitle}</h2>
          <ReportTable t={t} lang={lang} rows={sales} docField="doc_number" nameField="customer_name" />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold">{t.purchaseTitle}</h2>
          <ReportTable t={t} lang={lang} rows={purchase} docField="doc_ref" nameField="vendor_name" />
        </div>

        <div className="rounded-lg border border-zinc-300 p-4 text-sm">
          <h2 className="mb-2 font-bold">{t.pho30}</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <span className="text-zinc-500">{t.salesNet}</span><span className="text-right">{money(pho.salesTotal)}</span>
            <span className="text-zinc-500">{t.outputVat}</span><span className="text-right">{money(pho.outputVat)}</span>
            <span className="text-zinc-500">{t.purchaseNet}</span><span className="text-right">{money(pho.purchaseTotal)}</span>
            <span className="text-zinc-500">{t.inputVat}</span><span className="text-right">{money(pho.inputVat)}</span>
            <span className="border-t border-zinc-200 pt-1 font-bold">{pho.vatCreditCarry > 0 ? t.carry : t.payable}</span>
            <span className="border-t border-zinc-200 pt-1 text-right font-bold">{money(pho.vatCreditCarry > 0 ? pho.vatCreditCarry : pho.vatPayable)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
