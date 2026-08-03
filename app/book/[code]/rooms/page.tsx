import Link from "next/link";
import { getPublicProperty, getAvailability, getQuote } from "@/lib/book";
import { todayISO, addDaysISO, nightsBetween } from "@/lib/date";
import RoomsClient from "@/components/book/RoomsClient";

export const dynamic = "force-dynamic";

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function BookRoomsPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { check_in?: string; check_out?: string; adults?: string; children?: string };
}) {
  const property = await getPublicProperty(params.code);
  if (!property) {
    return <p className="text-sm text-[var(--app-fg-muted)]">Property not found.</p>;
  }

  const today = todayISO();
  const checkIn = isDate(searchParams.check_in) ? searchParams.check_in! : today;
  const checkOut = isDate(searchParams.check_out)
    ? searchParams.check_out!
    : addDaysISO(checkIn, 1);
  const adults = Math.max(1, Number(searchParams.adults) || 1);
  const children = Math.max(0, Number(searchParams.children) || 0);

  const avail = await getAvailability(property.id, checkIn, checkOut);
  const nights = Math.max(1, nightsBetween(checkIn, checkOut));

  // Quote each available type.
  const rows = await Promise.all(
    avail.map(async (a) => ({
      ...a,
      total: a.available > 0 ? await getQuote(property.id, a.room_type_id, checkIn, checkOut) : 0,
    }))
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm text-[var(--app-fg-muted)]">
            {checkIn} → {checkOut} · {nights} {nights === 1 ? "night" : "nights"} · {adults} adults
            {children ? ` · ${children} children` : ""}
          </div>
          <h1 className="text-xl font-semibold tracking-tight">เลือกห้องพัก / Choose a room</h1>
        </div>
        <Link
          href={`/book/${params.code}`}
          className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm hover:bg-[var(--app-surface-2)]"
        >
          เปลี่ยนวันที่ / Change dates
        </Link>
      </div>

      <RoomsClient
        code={params.code}
        rooms={rows}
        nights={nights}
        checkIn={checkIn}
        checkOut={checkOut}
        adults={adults}
        childrenCount={children}
        currency={property.currency}
      />
    </div>
  );
}
