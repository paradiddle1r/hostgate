import { getPublicProperty } from "@/lib/book";
import BookSearchForm from "@/components/book/BookSearchForm";

export const dynamic = "force-dynamic";

export default async function BookLandingPage({ params }: { params: { code: string } }) {
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

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return <BookSearchForm code={params.code} defaultCheckIn={today} defaultCheckOut={tomorrow} />;
}
