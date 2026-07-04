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

  const location = [property.city, property.country].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-md">
      {/* Branded header so a guest landing on /book/[code] knows which
          property they're looking at — uses only the fields
          getPublicProperty returns (name/city/country), no photo/logo. */}
      <div className="mb-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{property.name}</h1>
        {location && <p className="mt-1 text-sm text-[var(--app-fg-muted)]">{location}</p>}
      </div>

      <BookSearchForm
        code={params.code}
        propertyName={property.name}
        defaultCheckIn={today}
        defaultCheckOut={tomorrow}
      />
    </div>
  );
}
