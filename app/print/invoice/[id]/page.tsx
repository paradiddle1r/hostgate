import { getInvoice } from "@/lib/db/invoices";
import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/db/properties";
import PrintButton from "@/app/print/PrintButton";

export const dynamic = "force-dynamic";

const money = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function PrintInvoicePage({ params }: { params: { id: string } }) {
  const res = await getInvoice(params.id);
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-2xl p-12 text-center text-zinc-900">
        Invoice not found · {res.code}
      </div>
    );
  }
  const { invoice, items } = res.data;

  const supabase = createClient();
  const { data: propRow } = await supabase
    .from("properties")
    .select("*")
    .eq("id", invoice.property_id)
    .single();
  const property = propRow as Property | null;

  const issuerName = property?.legal_name || property?.name || "—";

  return (
    <div className="min-h-screen bg-zinc-100 py-8 text-zinc-900 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 16mm; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-6 no-print">
        <a href={`/app/invoices/${invoice.id}`} className="text-sm text-zinc-500 hover:underline">
          ← Back
        </a>
        <PrintButton label="พิมพ์ / Print" />
      </div>

      <div className="mx-auto max-w-[210mm] bg-white p-10 shadow-sm print:shadow-none">
        {/* Header: issuer + doc title */}
        <div className="flex items-start justify-between gap-6 border-b border-zinc-300 pb-6">
          <div>
            <h1 className="text-lg font-bold">{issuerName}</h1>
            {property?.tax_id && (
              <p className="text-sm text-zinc-600">
                เลขประจำตัวผู้เสียภาษี / Tax ID: {property.tax_id}
              </p>
            )}
            {property?.billing_address && (
              <p className="mt-1 max-w-xs whitespace-pre-line text-sm text-zinc-600">
                {property.billing_address}
              </p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase tracking-wide">ใบกำกับภาษี</h2>
            <p className="text-sm font-semibold text-zinc-700">TAX INVOICE</p>
            <p className="mt-3 text-sm">
              <span className="text-zinc-500">เลขที่ / No.</span>{" "}
              <span className="font-semibold">{invoice.number ?? "DRAFT"}</span>
            </p>
            <p className="text-sm">
              <span className="text-zinc-500">วันที่ / Date</span>{" "}
              <span className="font-semibold">{invoice.issue_date ?? "—"}</span>
            </p>
          </div>
        </div>

        {/* Bill to */}
        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">
              ลูกค้า / Bill to
            </p>
            <p className="font-semibold">{invoice.guest_name}</p>
            {invoice.guest_tax_id && (
              <p className="text-sm text-zinc-600">Tax ID: {invoice.guest_tax_id}</p>
            )}
            {invoice.guest_address && (
              <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">
                {invoice.guest_address}
              </p>
            )}
          </div>
          {(invoice.service_period_start || invoice.service_period_end) && (
            <div className="text-right text-sm">
              <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">
                ระยะเวลา / Period
              </p>
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
              <th className="py-2 pr-2 font-semibold">รายการ / Description</th>
              <th className="py-2 px-2 text-right font-semibold">จำนวน / Qty</th>
              <th className="py-2 px-2 text-right font-semibold">ราคา / Price</th>
              <th className="py-2 pl-2 text-right font-semibold">รวม / Amount</th>
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
                <td className="py-1 text-zinc-500">ยอดก่อนภาษี / Subtotal</td>
                <td className="py-1 text-right">{money(invoice.subtotal, invoice.currency)}</td>
              </tr>
              <tr>
                <td className="py-1 text-zinc-500">
                  ภาษีมูลค่าเพิ่ม / VAT ({invoice.vat_rate}%)
                  {property?.vat_inclusive ? " *" : ""}
                </td>
                <td className="py-1 text-right">{money(invoice.vat_amount, invoice.currency)}</td>
              </tr>
              <tr className="border-t border-zinc-300 font-bold">
                <td className="py-2">ยอดรวม / Total</td>
                <td className="py-2 text-right">{money(invoice.total, invoice.currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {property?.vat_inclusive && (
          <p className="mt-2 text-right text-xs text-zinc-400">
            * ราคารวมภาษีมูลค่าเพิ่มแล้ว / VAT inclusive
          </p>
        )}

        {/* Bank + footer */}
        <div className="mt-8 border-t border-zinc-300 pt-6 text-sm text-zinc-600">
          {(property?.bank_name || property?.bank_account) && (
            <p>
              <span className="font-semibold text-zinc-700">ธนาคาร / Bank:</span>{" "}
              {property?.bank_name} {property?.bank_account}
            </p>
          )}
          {invoice.notes && <p className="mt-2 whitespace-pre-line">{invoice.notes}</p>}
          {property?.invoice_footer && (
            <p className="mt-4 whitespace-pre-line text-center text-zinc-500">
              {property.invoice_footer}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
