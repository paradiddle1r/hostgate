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
      {/* Owner-branded hero — property photo + description (Settings → Company
          profile logo_url; commit 1625611's booking widget already claimed
          this photo "appears in the header of your public booking page", so
          actually render it here instead of the generic building icon). */}
      {property.logo_url && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
          <img
            src={property.logo_url}
            alt={property.name}
            className="h-40 w-full object-cover sm:h-52"
          />
        </div>
      )}
      <div className="mb-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{property.name}</h1>
        {location && <p className="mt-1 text-sm text-[var(--app-fg-muted)]">{location}</p>}
      </div>

      <BookSearchForm code={params.code} defaultCheckIn={today} defaultCheckOut={tomorrow} />
    </div>
  );
}
