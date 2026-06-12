import { getInvoice } from "@/lib/db/invoices";
import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/db/properties";
import InvoiceDetailClient from "@/components/app/invoices/InvoiceDetailClient";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const res = await getInvoice(params.id);
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-lg font-semibold">Invoice not found</p>
        <p className="mt-1 text-sm text-[var(--app-fg-muted)]">
          {res.code} · {res.message}
        </p>
      </div>
    );
  }
  const { invoice, items, payments, receipts } = res.data;

  // The invoice carries its own property_id — load that property (not the
  // active one) so currency/vat read true even when viewing across properties.
  const supabase = createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", invoice.property_id)
    .single();

  return (
    <InvoiceDetailClient
      invoice={invoice}
      items={items}
      payments={payments}
      receipts={receipts}
      property={property as Property}
    />
  );
}
