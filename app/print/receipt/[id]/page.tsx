import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/db/properties";
import type { Invoice, Payment } from "@/lib/db/invoices";
import PrintButton from "@/app/print/PrintButton";

export const dynamic = "force-dynamic";

const money = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const METHOD_LABEL: Record<string, string> = {
  cash: "เงินสด / Cash",
  transfer: "โอนเงิน / Transfer",
  card: "บัตร / Card",
};

export default async function PrintReceiptPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: receipt } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!receipt) {
    return (
      <div className="mx-auto max-w-2xl p-12 text-center text-zinc-900">Receipt not found</div>
    );
  }

  // The snapshot is the invoice row at payment time (no method / no items).
  const snapshot = (receipt.snapshot ?? {}) as Partial<Invoice>;
  const currency = snapshot.currency ?? "THB";

  // `method` + the specific amount live on the payment row, not the snapshot.
  let payment: Payment | null = null;
  if (receipt.payment_id) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("id", receipt.payment_id)
      .maybeSingle();
    payment = (data as Payment) ?? null;
  }

  // Amount for THIS payment; fall back to cumulative paid when no payment row.
  const amountPaid = payment ? Number(payment.amount) : Number(snapshot.amount_paid ?? 0);
  const methodLabel = payment ? METHOD_LABEL[payment.method] ?? payment.method : "—";
  const paidAt = payment?.paid_at?.slice(0, 10) ?? receipt.created_at?.slice(0, 10) ?? "—";

  const { data: propRow } = snapshot.property_id
    ? await supabase.from("properties").select("*").eq("id", snapshot.property_id).single()
    : { data: null };
  const property = propRow as Property | null;
  const issuerName = property?.legal_name || property?.name || "—";

  return (
    <div className="min-h-screen bg-zinc-100 py-8 text-zinc-900 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 16mm; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-6 no-print">
        {snapshot.id && (
          <a href={`/app/invoices/${snapshot.id}`} className="text-sm text-zinc-500 hover:underline">
            ← Back
          </a>
        )}
        <PrintButton label="พิมพ์ / Print" />
      </div>

      <div className="mx-auto max-w-[210mm] bg-white p-10 shadow-sm print:shadow-none">
        {/* Header */}
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
            <h2 className="text-xl font-bold uppercase tracking-wide">ใบเสร็จรับเงิน</h2>
            <p className="text-sm font-semibold text-zinc-700">RECEIPT</p>
            <p className="mt-3 text-sm">
              <span className="text-zinc-500">เลขที่ / No.</span>{" "}
              <span className="font-semibold">{receipt.number}</span>
            </p>
            <p className="text-sm">
              <span className="text-zinc-500">วันที่ / Date</span>{" "}
              <span className="font-semibold">{paidAt}</span>
            </p>
          </div>
        </div>

        {/* Received from */}
        <div className="py-6">
          <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">
            ได้รับเงินจาก / Received from
          </p>
          <p className="font-semibold">{snapshot.guest_name ?? "—"}</p>
          {snapshot.number && (
            <p className="text-sm text-zinc-600">
              อ้างอิงใบกำกับภาษี / Ref. invoice: {snapshot.number}
            </p>
          )}
        </div>

        {/* Payment detail */}
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-y border-zinc-300">
              <td className="py-3 text-zinc-500">วิธีชำระ / Method</td>
              <td className="py-3 text-right font-medium">{methodLabel}</td>
            </tr>
            {payment?.note && (
              <tr className="border-b border-zinc-200">
                <td className="py-2 text-zinc-500">หมายเหตุ / Note</td>
                <td className="py-2 text-right">{payment.note}</td>
              </tr>
            )}
            <tr className="border-b border-zinc-300 text-base font-bold">
              <td className="py-3">จำนวนเงินที่รับ / Amount paid</td>
              <td className="py-3 text-right">{money(amountPaid, currency)}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        {property?.invoice_footer && (
          <p className="mt-10 whitespace-pre-line text-center text-sm text-zinc-500">
            {property.invoice_footer}
          </p>
        )}

        <div className="mt-16 flex justify-end">
          <div className="w-56 border-t border-zinc-400 pt-2 text-center text-sm text-zinc-500">
            ผู้รับเงิน / Received by
          </div>
        </div>
      </div>
    </div>
  );
}
