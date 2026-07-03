import Link from "next/link";
import { getPublicProperty } from "@/lib/book";
import ManageBookingForm from "@/components/book/ManageBookingForm";

export const dynamic = "force-dynamic";

export default async function BookManagePage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { ref?: string };
}) {
  const property = await getPublicProperty(params.code);

  if (!property) {
    return (
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-center">
        <p className="text-sm text-[var(--app-fg-muted)]">
          ไม่พบที่พักนี้ / Property not found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ManageBookingForm propertyCode={params.code} initialCode={searchParams.ref} />
      <div className="text-center">
        <Link
          href={`/book/${params.code}`}
          className="text-sm text-[var(--app-accent)] underline"
        >
          กลับไปหน้าจอง / Back to booking
        </Link>
      </div>
    </div>
  );
}
