import { getActiveProperty } from "@/lib/active-property-server";
import { getActiveRole } from "@/lib/active-role-server";
import { listDocuments } from "@/lib/db/documents";
import DocumentsClient from "@/components/app/documents/DocumentsClient";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;

  const [docsRes, role] = await Promise.all([listDocuments(property.id), getActiveRole()]);
  const documents = docsRes.ok ? docsRes.data : [];

  return (
    <DocumentsClient
      documents={documents}
      role={role}
      currency={property.currency}
      vatRate={Number(property.vat_rate) || 0}
      vatInclusive={!!property.vat_inclusive}
    />
  );
}
