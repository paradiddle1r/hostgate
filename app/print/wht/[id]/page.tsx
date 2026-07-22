"use client";

// Stand-alone print view for a withholding-tax certificate (หนังสือรับรองการหัก
// ณ ที่จ่าย · มาตรา 50 ทวิ). Client component: TH/EN toggle + auto window.print().
// Data via loadWhtForPrint (RLS-scoped). Payer = the property; payee = the
// vendor snapshot stored on the certificate. Amount withheld is spelled out with
// bahtText. A VOID stamp overlays voided certificates.

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { loadWhtForPrint, type PrintWhtPayload } from "@/app/app/expenses/actions";
import { pndTypeMeta } from "@/lib/accounting/expenses";
import { formatBEDate } from "@/lib/accounting/vat";
import { bahtText } from "@/lib/accounting/baht-text";

type Lang = "th" | "en";

const STR: Record<Lang, Record<string, string>> = {
  th: {
    title: "หนังสือรับรองการหักภาษี ณ ที่จ่าย",
    subtitle: "ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร",
    no: "เลขที่", payer: "ผู้มีหน้าที่หักภาษี ณ ที่จ่าย", payee: "ผู้ถูกหักภาษี ณ ที่จ่าย",
    taxId: "เลขประจำตัวผู้เสียภาษีอากร", branch: "สาขา", pndType: "ประเภทแบบยื่นรายการ",
    incomeType: "ประเภทเงินได้", payDate: "วันเดือนปีที่จ่าย", amountPaid: "จำนวนเงินที่จ่าย",
    whtAmount: "ภาษีที่หักและนำส่ง", total: "รวม", inWords: "รวมเงินภาษีที่หักนำส่ง (ตัวอักษร)",
    condition: "เงื่อนไขการหักภาษี", cond1: "หัก ณ ที่จ่าย", void: "ยกเลิก",
    print: "พิมพ์", back: "ย้อนกลับ", headOffice: "สำนักงานใหญ่", notFound: "ไม่พบเอกสาร",
    loading: "กำลังโหลด…", sign: "ผู้จ่ายเงิน / ผู้มีอำนาจลงนาม", date: "วันที่",
  },
  en: {
    title: "Withholding Tax Certificate",
    subtitle: "Under Section 50 Bis of the Revenue Code",
    no: "No.", payer: "Payer (withholding agent)", payee: "Payee",
    taxId: "Taxpayer ID", branch: "Branch", pndType: "Return type",
    incomeType: "Type of income", payDate: "Date paid", amountPaid: "Amount paid",
    whtAmount: "Tax withheld", total: "Total", inWords: "Total tax withheld (in words)",
    condition: "Withholding condition", cond1: "Withheld at source", void: "VOID",
    print: "Print", back: "Back", headOffice: "Head Office", notFound: "Certificate not found",
    loading: "Loading…", sign: "Payer / authorised signature", date: "Date",
  },
};

const money = (n: unknown) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PrintWhtPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const [lang, setLang] = useState<Lang>(search.get("lang") === "en" ? "en" : "th");
  const [data, setData] = useState<PrintWhtPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadWhtForPrint(params.id).then((res) => {
      if (!alive) return;
      if (res.ok) setData(res.data);
      else setErr(`${res.code} · ${res.message}`);
    });
    return () => {
      alive = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (!data) return;
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, [data]);

  const t = STR[lang];
  if (err) return <div className="mx-auto max-w-2xl p-12 text-center text-zinc-900">{t.notFound} · {err}</div>;
  if (!data) return <div className="mx-auto max-w-2xl p-12 text-center text-zinc-500">{t.loading}</div>;

  const { cert, property } = data;
  const isVoid = cert.status === "void";
  const pnd = pndTypeMeta(cert.pnd_type);
  const payerName =
    lang === "th"
      ? property?.legal_name_th || property?.legal_name || property?.name || "—"
      : property?.legal_name || property?.name || "—";
  const payerBranch = (lang === "th" ? property?.branch_th || property?.branch : property?.branch) || t.headOffice;
  const payerAddress = lang === "th" ? property?.address_line1_th || property?.billing_address : property?.billing_address;

  return (
    <div className="min-h-screen bg-zinc-100 py-8 text-zinc-900 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-6 no-print">
        <a href="/app/expenses" className="text-sm text-zinc-500 hover:underline">← {t.back}</a>
        <div className="flex items-center gap-2">
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm">
            <option value="th">TH</option>
            <option value="en">EN</option>
          </select>
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">{t.print}</button>
        </div>
      </div>

      <div className="relative mx-auto max-w-[210mm] bg-white p-10 shadow-sm print:shadow-none">
        {isVoid && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="rotate-[-18deg] border-4 border-red-600 px-8 py-1 text-6xl font-black uppercase text-red-600 opacity-20">{t.void}</span>
          </div>
        )}

        <div className="border-b border-zinc-300 pb-4 text-center">
          <h1 className="text-lg font-bold">{t.title}</h1>
          <p className="text-sm text-zinc-600">{t.subtitle}</p>
          <p className="mt-1 text-sm"><span className="text-zinc-500">{t.no}</span> <span className="font-semibold">{cert.number ?? "—"}</span> · {lang === "th" ? pnd.th : pnd.en}</p>
        </div>

        <div className="grid grid-cols-2 gap-6 py-5">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">{t.payer}</p>
            <p className="font-bold">{payerName}</p>
            {property?.tax_id && <p className="text-sm text-zinc-600">{t.taxId}: {property.tax_id} ({payerBranch})</p>}
            {payerAddress && <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">{payerAddress}</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">{t.payee}</p>
            <p className="font-bold">{cert.payee_name ?? "—"}</p>
            {cert.payee_tax_id && <p className="text-sm text-zinc-600">{t.taxId}: {cert.payee_tax_id}{cert.payee_branch ? ` (${cert.payee_branch})` : ""}</p>}
            {cert.payee_address && <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">{cert.payee_address}</p>}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-zinc-300 text-left text-xs uppercase text-zinc-500">
              <th className="py-2 pr-2 font-semibold">{t.incomeType}</th>
              <th className="py-2 px-2 text-center font-semibold">{t.payDate}</th>
              <th className="py-2 px-2 text-right font-semibold">{t.amountPaid}</th>
              <th className="py-2 pl-2 text-right font-semibold">{t.whtAmount}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-200">
              <td className="py-2 pr-2">{cert.income_desc || cert.income_type || "—"}</td>
              <td className="py-2 px-2 text-center">{formatBEDate(cert.payment_date)}</td>
              <td className="py-2 px-2 text-right">{money(cert.amount_paid)}</td>
              <td className="py-2 pl-2 text-right">{money(cert.wht_amount)}</td>
            </tr>
            <tr className="border-t border-zinc-300 font-bold">
              <td className="py-2" colSpan={2}>{t.total}</td>
              <td className="py-2 text-right">{money(cert.amount_paid)}</td>
              <td className="py-2 text-right">{money(cert.wht_amount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 text-sm text-zinc-700">
          <p><span className="text-zinc-500">{t.inWords}: </span><span className="font-medium">{bahtText(cert.wht_amount)}</span></p>
          <p className="mt-1"><span className="text-zinc-500">{t.condition}: </span>{t.cond1} ({cert.tax_condition || "1"}) · {Number(cert.wht_rate)}%</p>
        </div>

        <div className="mt-16 flex justify-end text-sm">
          <div className="w-64 border-t border-dashed border-zinc-400 pt-2 text-center text-zinc-500">
            {t.sign}
            <div className="mt-6 text-xs">{t.date} ……./……./…….</div>
          </div>
        </div>
      </div>
    </div>
  );
}
