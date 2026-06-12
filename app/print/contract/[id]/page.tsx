import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/app/print/PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintContractPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: contract } = await supabase
    .from("rental_contracts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!contract) {
    return (
      <div className="mx-auto max-w-2xl p-12 text-center text-zinc-900">Contract not found</div>
    );
  }

  const { data: propRow } = contract.property_id
    ? await supabase.from("properties").select("name").eq("id", contract.property_id).single()
    : { data: null };
  const propertyName = propRow?.name ?? "—";

  return (
    <div className="min-h-screen bg-zinc-100 py-8 text-zinc-900 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 16mm; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-6 no-print">
        {contract.booking_id && (
          <a
            href={`/app/rentals/${contract.booking_id}`}
            className="text-sm text-zinc-500 hover:underline"
          >
            ← Back
          </a>
        )}
        <PrintButton label="พิมพ์ / Print" />
      </div>

      <div className="mx-auto max-w-[210mm] bg-white p-10 shadow-sm print:shadow-none">
        {/* Header */}
        <div className="border-b border-zinc-300 pb-6 text-center">
          <p className="text-sm text-zinc-600">{propertyName}</p>
          <h1 className="mt-2 text-xl font-bold">หนังสือสัญญาเช่า / Lease Agreement</h1>
          <p className="mt-3 text-sm">
            <span className="text-zinc-500">เลขที่ / No.</span>{" "}
            <span className="font-semibold">{contract.number ?? "ฉบับร่าง / Draft"}</span>
          </p>
          {(contract.start_date || contract.end_date) && (
            <p className="text-sm">
              <span className="text-zinc-500">ระยะเวลา / Term</span>{" "}
              <span className="font-semibold">
                {contract.start_date ?? "—"} → {contract.end_date ?? "—"}
              </span>
            </p>
          )}
        </div>

        {/* Bodies */}
        {contract.body_th && (
          <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{contract.body_th}</div>
        )}

        {contract.body_th && contract.body_en && (
          <hr className="my-8 border-zinc-300" />
        )}

        {contract.body_en && (
          <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{contract.body_en}</div>
        )}
      </div>
    </div>
  );
}
