import { getPublicProperty } from "@/lib/book";
import { todayISO, addDaysISO } from "@/lib/date";
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

  // Local (+07) today, not UTC today — before 07:00 those are different days
  // and the form would open on a check-in date the server then rejects.
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);

  return <BookSearchForm code={params.code} today={today} defaultCheckIn={today} defaultCheckOut={tomorrow} />;
}
