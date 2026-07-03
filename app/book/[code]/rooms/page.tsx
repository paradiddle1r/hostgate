import Link from "next/link";
import { getPublicProperty, getAvailability, getQuote, getPublicRatePlans, planNightlyPrice } from "@/lib/book";
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

  const today = new Date().toISOString().slice(0, 10);
  const checkIn = isDate(searchParams.check_in) ? searchParams.check_in! : today;
  const checkOut = isDate(searchParams.check_out)
    ? searchParams.check_out!
    : new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const adults = Math.max(1, Number(searchParams.adults) || 1);
  const children = Math.max(0, Number(searchParams.children) || 0);

  // A crafted/stale URL can carry a check_in before today even though the
  // widget's date picker (min=today) and submitPublicBooking both block it —
  // reject it here too instead of running an availability search on it.
  if (checkIn < today) {
    return (
      <p className="text-sm text-[var(--app-danger)]">
        วันที่เข้าพักต้องไม่ใช่วันที่ผ่านมาแล้ว กรุณาเลือกวันที่ใหม่ / Check-in date cannot be in the
        past — please choose a new date.
      </p>
    );
  }

  const avail = await getAvailability(property.id, checkIn, checkOut);
  const nights = Math.max(
    1,
    Math.round((Date.parse(checkOut + "T00:00:00Z") - Date.parse(checkIn + "T00:00:00Z")) / 86_400_000)
  );

  // Quote each available type (base/calendar price — kept as the fallback
  // when a type has no active rate plan).
  const rows = await Promise.all(
    avail.map(async (a) => ({
      ...a,
      total: a.available > 0 ? await getQuote(property.id, a.room_type_id, checkIn, checkOut) : 0,
    }))
  );

  // Active, guest-bookable rate plans for this property, with each one's
  // nightly price per room type (override → plan flat rate → room base).
  const { plans, overridesByPlan } = await getPublicRatePlans(property.id);
  const roomsWithPlans = rows.map((r) => {
    const basePrice = r.daily_rate ?? (r.available > 0 ? r.total / nights : 0);
    const planOptions = plans.map((p) => {
      const nightly = planNightlyPrice(p, r.room_type_id, overridesByPlan, basePrice);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        description: p.description,
        nightly,
        total: nightly * nights,
      };
    });
    return { ...r, planOptions };
  });

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
        rooms={roomsWithPlans}
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
