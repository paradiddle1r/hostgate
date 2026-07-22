import { getActiveProperty } from "@/lib/active-property-server";
import { getActiveRole } from "@/lib/active-role-server";
import { getDocument } from "@/lib/db/documents";
import { listContacts } from "@/lib/db/contacts";
import { listInvoices } from "@/lib/db/invoices";
import DocumentEditorClient from "@/components/app/documents/DocumentEditorClient";

export const dynamic = "force-dynamic";

export default async function DocumentEditorPage({ params }: { params: { id: string } }) {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;

  const res = await getDocument(params.id);
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-lg font-semibold">Document not found</p>
        <p className="mt-1 text-sm text-[var(--app-fg-muted)]">
          {res.code} · {res.message}
        </p>
      </div>
    );
  }

  const [customersRes, invoicesRes, role] = await Promise.all([
    listContacts(property.id, "customer"),
    listInvoices(property.id),
    getActiveRole(),
  ]);

  return (
    <DocumentEditorClient
      doc={res.data.doc}
      items={res.data.items}
      customers={customersRes.ok ? customersRes.data : []}
      invoices={invoicesRes.ok ? invoicesRes.data.filter((i) => i.status !== "void") : []}
      role={role}
      currency={property.currency}
    />
  );
}
