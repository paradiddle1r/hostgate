"use client";

// Stand-alone print/PDF view for a tax invoice. Client component: owns the
// TH/EN document-language toggle and auto-fires window.print() on first load
// so the operator gets the print dialog with no extra clicks. Data is pulled
// through the loadInvoiceForPrint server action (RLS-scoped). The printed
// header uses the property logo + the Thai company block; the bill-to block
// renders the full Thai B2B fields (company TH/EN, branch, tax id, address
// TH/EN, phone, email). Totals show the invoice-level discount and the
// per-invoice VAT-inclusive note. A VOID stamp overlays voided invoices.

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { loadInvoiceForPrint, type PrintInvoicePayload } from "@/app/app/invoices/actions";

type Lang = "th" | "en";

const STR: Record<Lang, Record<string, string>> = {
  th: {
    taxInvoice: "ใบกำกับภาษี",
    taxInvoiceEn: "TAX INVOICE",
    no: "เลขที่",
    date: "วันที่",
    due: "ครบกำหนด",
    billTo: "ลูกค้า",
    attn: "ติดต่อ",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    branch: "สาขา",
    period: "ระยะเวลา",
    desc: "รายการ",
    qty: "จำนวน",
    price: "ราคา/หน่วย",
    amount: "จำนวนเงิน",
    subtotal: "ยอดก่อนภาษี",
    discount: "ส่วนลด",
    vat: "ภาษีมูลค่าเพิ่ม",
    incl: "(รวมแล้ว)",
    total: "ยอดรวมทั้งสิ้น",
    paid: "ชำระแล้ว",
    balance: "ยอดคงค้าง",
    bank: "รายละเอียดการชำระเงิน",
    void: "ยกเลิก",
    print: "พิมพ์",
    back: "ย้อนกลับ",
    headOffice: "สำนักงานใหญ่",
    notFound: "ไม่พบใบกำกับภาษี",
    sign: "ผู้รับเงิน / ผู้มีอำนาจลงนาม",
    signCustomer: "ลูกค้า",
    loading: "กำลังโหลด…",
  },
  en: {
    taxInvoice: "TAX INVOICE",
    taxInvoiceEn: "ใบกำกับภาษี",
    no: "No.",
    date: "Date",
    due: "Due",
    billTo: "Bill to",
    attn: "Attn",
    taxId: "Tax ID",
    branch: "Branch",
    period: "Period",
    desc: "Description",
    qty: "Qty",
    price: "Unit price",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    vat: "VAT",
    incl: "(incl.)",
    total: "Total",
    paid: "Paid",
    balance: "Balance due",
    bank: "Payment instructions",
    void: "VOID",
    print: "Print",
    back: "Back",
    headOffice: "Head Office",
    notFound: "Invoice not found",
    sign: "Authorised signature",
    signCustomer: "Customer",
    loading: "Loading…",
  },
};

const money = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PrintInvoicePage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const [lang, setLang] = useState<Lang>(search.get("lang") === "en" ? "en" : "th");
  const [data, setData] = useState<PrintInvoicePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadInvoiceForPrint(params.id).then((res) => {
      if (!alive) return;
      if (res.ok) setData(res.data);
      else setErr(`${res.code} · ${res.message}`);
    });
    return () => {
      alive = false;
    };
  }, [params.id]);

  // Auto-print once the document has rendered (short delay for fonts/logo).
  useEffect(() => {
    if (!data) return;
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, [data]);

  const t = STR[lang];

  if (err) {
    return (
      <div className="mx-auto max-w-2xl p-12 text-center text-zinc-900">
        {t.notFound} · {err}
      </div>
    );
  }
  if (!data) {
    return <div className="mx-auto max-w-2xl p-12 text-center text-zinc-500">{t.loading}</div>;
  }

  const { invoice, items, property } = data;

  // Localised company block (Thai mirror falls back to English).
  const companyName =
    lang === "th"
      ? property?.legal_name_th || property?.legal_name || property?.name || "—"
      : property?.legal_name || property?.name || "—";
  const branchLine =
    (lang === "th" ? property?.branch_th || property?.branch : property?.branch) ||
    (lang === "th" ? t.headOffice : t.headOffice);
  const companyAddress =
    lang === "th"
      ? property?.address_line1_th || property?.billing_address
      : property?.billing_address;

  // Localised bill-to (Thai mirror falls back to English).
  const billCompany =
    lang === "th"
      ? invoice.guest_company_name_th || invoice.guest_company_name
      : invoice.guest_company_name;
  const billAddress =
    lang === "th" ? invoice.guest_address_th || invoice.guest_address : invoice.guest_address;

  const footer = invoice.footer || property?.invoice_footer;

  return (
    <div className="min-h-screen bg-zinc-100 py-8 text-zinc-900 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>

      {/* Toolbar (hidden in print) */}
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-6 no-print">
        <a
          href={`/app/invoices/${invoice.id}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← {t.back}
        </a>
        <div className="flex items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
          >
            <option value="th">TH</option>
            <option value="en">EN</option>
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            {t.print}
          </button>
        </div>
      </div>

      <div className="relative mx-auto max-w-[210mm] bg-white p-10 shadow-sm print:shadow-none">
        {invoice.status === "void" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="rotate-[-18deg] border-4 border-red-600 px-8 py-1 text-6xl font-black uppercase text-red-600 opacity-20">
              {t.void}
            </span>
          </div>
        )}

        {/* Header: issuer + doc title */}
        <div className="flex items-start justify-between gap-6 border-b border-zinc-300 pb-6">
          <div>
            {property?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={property.logo_url}
                alt=""
                className="mb-2 max-h-16 max-w-[180px] object-contain"
              />
            )}
            <h1 className="text-lg font-bold">{companyName}</h1>
            {property?.tax_id && (
              <p className="text-sm text-zinc-600">
                {t.taxId}: {property.tax_id}
                {branchLine ? ` (${branchLine})` : ""}
              </p>
            )}
            {companyAddress && (
              <p className="mt-1 max-w-xs whitespace-pre-line text-sm text-zinc-600">
                {companyAddress}
              </p>
            )}
            {(property?.phone || property?.email || property?.website) && (
              <p className="mt-1 text-sm text-zinc-600">
                {[property?.phone, property?.email, property?.website].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase tracking-wide">{t.taxInvoice}</h2>
            <p className="text-sm font-semibold text-zinc-700">{t.taxInvoiceEn}</p>
            <p className="mt-3 text-sm">
              <span className="text-zinc-500">{t.no}</span>{" "}
              <span className="font-semibold">{invoice.number ?? "DRAFT"}</span>
            </p>
            <p className="text-sm">
              <span className="text-zinc-500">{t.date}</span>{" "}
              <span className="font-semibold">{invoice.issue_date ?? "—"}</span>
            </p>
            {invoice.due_date && (
              <p className="text-sm">
                <span className="text-zinc-500">{t.due}</span>{" "}
                <span className="font-semibold">{invoice.due_date}</span>
              </p>
            )}
          </div>
        </div>

        {/* Bill to */}
        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">{t.billTo}</p>
            {billCompany && (
              <p className="font-bold">
                {billCompany}
                {invoice.guest_branch && (
                  <span className="font-normal"> ({invoice.guest_branch})</span>
                )}
              </p>
            )}
            <p className={billCompany ? "text-sm text-zinc-700" : "font-semibold"}>
              {billCompany ? `${t.attn}: ${invoice.guest_name}` : invoice.guest_name}
            </p>
            {invoice.guest_tax_id && (
              <p className="text-sm text-zinc-600">
                {t.taxId}: {invoice.guest_tax_id}
              </p>
            )}
            {billAddress && (
              <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">{billAddress}</p>
            )}
            {invoice.guest_phone && (
              <p className="text-sm text-zinc-600">{invoice.guest_phone}</p>
            )}
            {invoice.guest_email && (
              <p className="text-sm text-zinc-600">{invoice.guest_email}</p>
            )}
          </div>
          {(invoice.service_period_start || invoice.service_period_end) && (
            <div className="text-right text-sm">
              <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">{t.period}</p>
              <p>
                {invoice.service_period_start ?? "—"} → {invoice.service_period_end ?? "—"}
              </p>
            </div>
          )}
        </div>

        {/* Items */}
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
                <td className="py-2 pr-2">{it.description}</td>
                <td className="py-2 px-2 text-right">{it.qty}</td>
                <td className="py-2 px-2 text-right">{money(it.unit_price, invoice.currency)}</td>
                <td className="py-2 pl-2 text-right">
                  {it.is_discount ? "−" : ""}
                  {money(it.line_total, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <table className="w-64 text-sm">
            <tbody>
              <tr>
                <td className="py-1 text-zinc-500">{t.subtotal}</td>
                <td className="py-1 text-right">{money(invoice.subtotal, invoice.currency)}</td>
              </tr>
              {Number(invoice.discount) > 0 && (
                <tr>
                  <td className="py-1 text-zinc-500">{t.discount}</td>
                  <td className="py-1 text-right">− {money(invoice.discount, invoice.currency)}</td>
                </tr>
              )}
              <tr>
                <td className="py-1 text-zinc-500">
                  {t.vat} ({invoice.vat_rate}%){invoice.vat_inclusive ? ` ${t.incl}` : ""}
                </td>
                <td className="py-1 text-right">{money(invoice.vat_amount, invoice.currency)}</td>
              </tr>
              <tr className="border-t border-zinc-300 font-bold">
                <td className="py-2">{t.total}</td>
                <td className="py-2 text-right">{money(invoice.total, invoice.currency)}</td>
              </tr>
              {Number(invoice.amount_paid) > 0 && (
                <tr>
                  <td className="py-1 text-zinc-500">{t.paid}</td>
                  <td className="py-1 text-right">
                    − {money(invoice.amount_paid, invoice.currency)}
                  </td>
                </tr>
              )}
              {Number(invoice.amount_paid) > 0 && (
                <tr className="font-bold">
                  <td className="py-1">{t.balance}</td>
                  <td className="py-1 text-right">{money(invoice.balance, invoice.currency)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bank + footer */}
        <div className="mt-8 border-t border-zinc-300 pt-6 text-sm text-zinc-600">
          {(property?.bank_name || property?.bank_account) && (
            <p>
              <span className="font-semibold text-zinc-700">{t.bank}:</span>{" "}
              {[property?.bank_name, property?.bank_branch, property?.bank_account_name, property?.bank_account]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {invoice.notes && <p className="mt-2 whitespace-pre-line">{invoice.notes}</p>}
          {footer && (
            <p className="mt-4 whitespace-pre-line text-center text-zinc-500">{footer}</p>
          )}
        </div>

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-16 text-sm">
          <div className="border-t border-dashed border-zinc-400 pt-2 text-center text-zinc-500">
            {t.sign}
          </div>
          <div className="border-t border-dashed border-zinc-400 pt-2 text-center text-zinc-500">
            {t.signCustomer}
          </div>
        </div>
      </div>
    </div>
  );
}
