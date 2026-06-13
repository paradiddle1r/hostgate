"use client";

// Stand-alone print/PDF view for a receipt (ใบเสร็จรับเงิน). Client component:
// owns the TH/EN document-language toggle and auto-fires window.print() on
// first load. Data is pulled through the loadReceiptForPrint server action;
// the receipt carries a snapshot of the invoice at payment time, and the
// specific amount / method / note live on the linked payment row. The header
// uses the property logo + the Thai company block.

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { loadReceiptForPrint, type PrintReceiptPayload } from "@/app/app/invoices/actions";

type Lang = "th" | "en";

const STR: Record<Lang, Record<string, string>> = {
  th: {
    receipt: "ใบเสร็จรับเงิน",
    receiptEn: "RECEIPT",
    no: "เลขที่",
    date: "วันที่",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    branch: "สาขา",
    headOffice: "สำนักงานใหญ่",
    receivedFrom: "ได้รับเงินจาก",
    refInvoice: "อ้างอิงใบกำกับภาษี",
    method: "วิธีชำระ",
    note: "หมายเหตุ",
    amountPaid: "จำนวนเงินที่รับ",
    receivedBy: "ผู้รับเงิน",
    print: "พิมพ์",
    back: "ย้อนกลับ",
    notFound: "ไม่พบใบเสร็จ",
    loading: "กำลังโหลด…",
    cash: "เงินสด",
    transfer: "โอนเงิน",
    card: "บัตร",
  },
  en: {
    receipt: "RECEIPT",
    receiptEn: "ใบเสร็จรับเงิน",
    no: "No.",
    date: "Date",
    taxId: "Tax ID",
    branch: "Branch",
    headOffice: "Head Office",
    receivedFrom: "Received from",
    refInvoice: "Ref. invoice",
    method: "Method",
    note: "Note",
    amountPaid: "Amount paid",
    receivedBy: "Received by",
    print: "Print",
    back: "Back",
    notFound: "Receipt not found",
    loading: "Loading…",
    cash: "Cash",
    transfer: "Transfer",
    card: "Card",
  },
};

const money = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function methodLabel(method: string, t: Record<string, string>): string {
  return method === "cash"
    ? t.cash
    : method === "transfer"
    ? t.transfer
    : method === "card"
    ? t.card
    : method;
}

export default function PrintReceiptPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const [lang, setLang] = useState<Lang>(search.get("lang") === "en" ? "en" : "th");
  const [data, setData] = useState<PrintReceiptPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadReceiptForPrint(params.id).then((res) => {
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

  const { receipt, payment, property } = data;
  const snapshot = receipt.snapshot ?? {};
  const currency = snapshot.currency ?? "THB";

  const amountPaid = payment ? Number(payment.amount) : Number(snapshot.amount_paid ?? 0);
  const paidAt =
    payment?.paid_at?.slice(0, 10) ?? receipt.created_at?.slice(0, 10) ?? "—";

  const companyName =
    lang === "th"
      ? property?.legal_name_th || property?.legal_name || property?.name || "—"
      : property?.legal_name || property?.name || "—";
  const branchLine =
    (lang === "th" ? property?.branch_th || property?.branch : property?.branch) || t.headOffice;
  const companyAddress =
    lang === "th"
      ? property?.address_line1_th || property?.billing_address
      : property?.billing_address;
  const footer = property?.invoice_footer;

  const billCompany =
    lang === "th"
      ? snapshot.guest_company_name_th || snapshot.guest_company_name
      : snapshot.guest_company_name;

  return (
    <div className="min-h-screen bg-zinc-100 py-8 text-zinc-900 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-6 no-print">
        {snapshot.id ? (
          <a href={`/app/invoices/${snapshot.id}`} className="text-sm text-zinc-500 hover:underline">
            ← {t.back}
          </a>
        ) : (
          <span />
        )}
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

      <div className="mx-auto max-w-[210mm] bg-white p-10 shadow-sm print:shadow-none">
        {/* Header */}
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
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase tracking-wide">{t.receipt}</h2>
            <p className="text-sm font-semibold text-zinc-700">{t.receiptEn}</p>
            <p className="mt-3 text-sm">
              <span className="text-zinc-500">{t.no}</span>{" "}
              <span className="font-semibold">{receipt.number}</span>
            </p>
            <p className="text-sm">
              <span className="text-zinc-500">{t.date}</span>{" "}
              <span className="font-semibold">{paidAt}</span>
            </p>
          </div>
        </div>

        {/* Received from */}
        <div className="py-6">
          <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">{t.receivedFrom}</p>
          {billCompany && <p className="font-bold">{billCompany}</p>}
          <p className={billCompany ? "text-sm text-zinc-700" : "font-semibold"}>
            {snapshot.guest_name ?? "—"}
          </p>
          {snapshot.number && (
            <p className="text-sm text-zinc-600">
              {t.refInvoice}: {snapshot.number}
            </p>
          )}
        </div>

        {/* Payment detail */}
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-y border-zinc-300">
              <td className="py-3 text-zinc-500">{t.method}</td>
              <td className="py-3 text-right font-medium">
                {payment ? methodLabel(payment.method, t) : "—"}
              </td>
            </tr>
            {payment?.note && (
              <tr className="border-b border-zinc-200">
                <td className="py-2 text-zinc-500">{t.note}</td>
                <td className="py-2 text-right">{payment.note}</td>
              </tr>
            )}
            <tr className="border-b border-zinc-300 text-base font-bold">
              <td className="py-3">{t.amountPaid}</td>
              <td className="py-3 text-right">{money(amountPaid, currency)}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        {footer && (
          <p className="mt-10 whitespace-pre-line text-center text-sm text-zinc-500">{footer}</p>
        )}

        <div className="mt-16 flex justify-end">
          <div className="w-56 border-t border-zinc-400 pt-2 text-center text-sm text-zinc-500">
            {t.receivedBy}
          </div>
        </div>
      </div>
    </div>
  );
}
