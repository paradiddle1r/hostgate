"use client";

// Stand-alone print/PDF view for a sales document (quotation / billing note /
// cash sale / credit note / debit note). Client component: owns the TH/EN
// document-language toggle and auto-fires window.print() on load. Data comes
// through loadDocumentForPrint (RLS-scoped). Mirrors the invoice print layout
// (issuer block + logo, localized bill-to, RD-style totals, baht-text, a VOID
// stamp) so every printed document reads consistently.

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { loadDocumentForPrint, type PrintDocumentPayload } from "@/app/app/documents/actions";
import { docTypeMeta } from "@/lib/accounting/documents";
import { bahtText } from "@/lib/accounting/baht-text";

type Lang = "th" | "en";

const STR: Record<Lang, Record<string, string>> = {
  th: {
    no: "เลขที่", date: "วันที่", due: "ครบกำหนด", billTo: "ลูกค้า", attn: "ติดต่อ",
    taxId: "เลขประจำตัวผู้เสียภาษี", branch: "สาขา", desc: "รายการ", qty: "จำนวน",
    price: "ราคา/หน่วย", amount: "จำนวนเงิน", subtotal: "ยอดก่อนภาษี", discount: "ส่วนลด",
    net: "มูลค่าก่อนภาษี", vat: "ภาษีมูลค่าเพิ่ม", incl: "(รวมแล้ว)", total: "ยอดรวมทั้งสิ้น",
    inWords: "จำนวนเงินตัวอักษร", ref: "อ้างอิง", reason: "เหตุผล", notes: "หมายเหตุ",
    bank: "รายละเอียดการชำระเงิน", void: "ยกเลิก", print: "พิมพ์", back: "ย้อนกลับ",
    headOffice: "สำนักงานใหญ่", notFound: "ไม่พบเอกสาร", loading: "กำลังโหลด…",
    sign: "ผู้มีอำนาจลงนาม", signCustomer: "ลูกค้า",
  },
  en: {
    no: "No.", date: "Date", due: "Due", billTo: "Bill to", attn: "Attn",
    taxId: "Tax ID", branch: "Branch", desc: "Description", qty: "Qty",
    price: "Unit price", amount: "Amount", subtotal: "Subtotal", discount: "Discount",
    net: "Net", vat: "VAT", incl: "(incl.)", total: "Total",
    inWords: "Amount in words", ref: "Reference", reason: "Reason", notes: "Notes",
    bank: "Payment instructions", void: "VOID", print: "Print", back: "Back",
    headOffice: "Head Office", notFound: "Document not found", loading: "Loading…",
    sign: "Authorised signature", signCustomer: "Customer",
  },
};

const money = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PrintDocumentPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const [lang, setLang] = useState<Lang>(search.get("lang") === "en" ? "en" : "th");
  const [data, setData] = useState<PrintDocumentPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadDocumentForPrint(params.id).then((res) => {
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

  const { doc, items, property } = data;
  const meta = docTypeMeta(doc.doc_type);
  const title = lang === "th" ? meta.th : meta.en;
  const titleAlt = lang === "th" ? meta.en : meta.th;
  const isVoid = doc.status === "void";

  const companyName =
    lang === "th"
      ? property?.legal_name_th || property?.legal_name || property?.name || "—"
      : property?.legal_name || property?.name || "—";
  const branchLine =
    (lang === "th" ? property?.branch_th || property?.branch : property?.branch) || t.headOffice;
  const companyAddress =
    lang === "th" ? property?.address_line1_th || property?.billing_address : property?.billing_address;

  const billCompany =
    lang === "th"
      ? doc.customer_company_name_th || doc.customer_company_name
      : doc.customer_company_name || doc.customer_company_name_th;
  const billAddress = lang === "th" ? doc.customer_address_th || doc.customer_address : doc.customer_address;

  return (
    <div className="min-h-screen bg-zinc-100 py-8 text-zinc-900 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-6 no-print">
        <a href={`/app/documents/${doc.id}`} className="text-sm text-zinc-500 hover:underline">← {t.back}</a>
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

        <div className="flex items-start justify-between gap-6 border-b border-zinc-300 pb-6">
          <div>
            {property?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={property.logo_url} alt="" className="mb-2 max-h-16 max-w-[180px] object-contain" />
            )}
            <h1 className="text-lg font-bold">{companyName}</h1>
            {property?.tax_id && (
              <p className="text-sm text-zinc-600">{t.taxId}: {property.tax_id}{branchLine ? ` (${branchLine})` : ""}</p>
            )}
            {companyAddress && <p className="mt-1 max-w-xs whitespace-pre-line text-sm text-zinc-600">{companyAddress}</p>}
            {(property?.phone || property?.email) && (
              <p className="mt-1 text-sm text-zinc-600">{[property?.phone, property?.email].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase tracking-wide">{title}</h2>
            <p className="text-sm font-semibold text-zinc-700">{titleAlt}</p>
            <p className="mt-3 text-sm"><span className="text-zinc-500">{t.no}</span> <span className="font-semibold">{doc.number ?? "DRAFT"}</span></p>
            <p className="text-sm"><span className="text-zinc-500">{t.date}</span> <span className="font-semibold">{doc.issue_date ?? "—"}</span></p>
            {doc.due_date && <p className="text-sm"><span className="text-zinc-500">{t.due}</span> <span className="font-semibold">{doc.due_date}</span></p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">{t.billTo}</p>
            {billCompany && (
              <p className="font-bold">{billCompany}{doc.customer_branch && <span className="font-normal"> ({doc.customer_branch})</span>}</p>
            )}
            <p className={billCompany ? "text-sm text-zinc-700" : "font-semibold"}>
              {billCompany ? `${t.attn}: ${doc.customer_name ?? ""}` : doc.customer_name ?? "—"}
            </p>
            {doc.customer_tax_id && <p className="text-sm text-zinc-600">{t.taxId}: {doc.customer_tax_id}</p>}
            {billAddress && <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">{billAddress}</p>}
            {doc.customer_phone && <p className="text-sm text-zinc-600">{doc.customer_phone}</p>}
          </div>
          {(doc.ref_invoice_id || doc.reason) && (
            <div className="text-right text-sm">
              {doc.reason && <p><span className="text-zinc-500">{t.reason}: </span>{doc.reason}</p>}
            </div>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-zinc-300 text-left text-xs uppercase text-zinc-500">
              <th className="py-2 pr-2 font-semibold">{t.desc}</th>
              <th className="py-2 px-2 text-right font-semibold">{t.qty}</th>
              <th className="py-2 px-2 text-right font-semibold">{t.price}</th>
              <th className="py-2 pl-2 text-right font-semibold">{t.amount}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-zinc-200">
                <td className="py-2 pr-2">{it.description}{it.unit ? ` / ${it.unit}` : ""}</td>
                <td className="py-2 px-2 text-right">{it.qty}</td>
                <td className="py-2 px-2 text-right">{money(it.unit_price, doc.currency)}</td>
                <td className="py-2 pl-2 text-right">{it.is_discount ? "−" : ""}{money(it.line_total, doc.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex items-start justify-between gap-6">
          <div className="max-w-[46%] pt-2 text-sm text-zinc-600">
            <p className="text-xs font-semibold uppercase text-zinc-500">{t.inWords}</p>
            <p className="font-medium text-zinc-800">{bahtText(doc.total)}</p>
          </div>
          <table className="w-64 text-sm">
            <tbody>
              <tr><td className="py-1 text-zinc-500">{t.subtotal}</td><td className="py-1 text-right">{money(doc.subtotal, doc.currency)}</td></tr>
              {Number(doc.discount) > 0 && (
                <tr><td className="py-1 text-zinc-500">{t.discount}</td><td className="py-1 text-right">− {money(doc.discount, doc.currency)}</td></tr>
              )}
              <tr><td className="py-1 text-zinc-500">{t.vat} ({doc.vat_rate}%){doc.vat_inclusive ? ` ${t.incl}` : ""}</td><td className="py-1 text-right">{money(doc.vat_amount, doc.currency)}</td></tr>
              <tr className="border-t border-zinc-300 font-bold"><td className="py-2">{t.total}</td><td className="py-2 text-right">{money(doc.total, doc.currency)}</td></tr>
            </tbody>
          </table>
        </div>

        {(property?.bank_name || doc.notes) && (
          <div className="mt-8 border-t border-zinc-300 pt-6 text-sm text-zinc-600">
            {property?.bank_name && (
              <p><span className="font-semibold text-zinc-700">{t.bank}:</span> {[property?.bank_name, property?.bank_branch, property?.bank_account_name, property?.bank_account].filter(Boolean).join(" · ")}</p>
            )}
            {doc.notes && <p className="mt-2 whitespace-pre-line">{doc.notes}</p>}
          </div>
        )}

        <div className="mt-12 grid grid-cols-2 gap-16 text-sm">
          <div className="border-t border-dashed border-zinc-400 pt-2 text-center text-zinc-500">{t.signCustomer}</div>
          <div className="border-t border-dashed border-zinc-400 pt-2 text-center text-zinc-500">{t.sign}</div>
        </div>
      </div>
    </div>
  );
}
