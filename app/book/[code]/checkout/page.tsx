import Link from "next/link";
import { getPublicProperty, getAvailability, getQuote, getPublicRatePlans, planNightlyPrice } from "@/lib/book";
import CheckoutForm from "@/components/book/CheckoutForm";

export const dynamic = "force-dynamic";

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function BookCheckoutPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: {
    type?: string;
    check_in?: string;
    check_out?: string;
    adults?: string;
    children?: string;
    plan?: string;
  };
}) {
  const property = await getPublicProperty(params.code);
  if (!property || !searchParams.type || !isDate(searchParams.check_in) || !isDate(searchParams.check_out)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--app-fg-muted)]">ข้อมูลไม่ครบ / Missing booking details.</p>
        <Link href={`/book/${params.code}`} className="text-sm text-[var(--app-accent)] underline">
          เริ่มใหม่ / Start over
        </Link>
      </div>
    );
  }

  const checkIn = searchParams.check_in!;
  const checkOut = searchParams.check_out!;
  const adults = Math.max(1, Number(searchParams.adults) || 1);
  const children = Math.max(0, Number(searchParams.children) || 0);

  const avail = await getAvailability(property.id, checkIn, checkOut);
  const type = avail.find((a) => a.room_type_id === searchParams.type);
  const baseTotal = type ? await getQuote(property.id, type.room_type_id, checkIn, checkOut) : 0;
  const nights = Math.max(
    1,
    Math.round((Date.parse(checkOut + "T00:00:00Z") - Date.parse(checkIn + "T00:00:00Z")) / 86_400_000)
  );

  // Recompute the selected rate plan's price server-side (never trust the
  // querystring for money) — same override → plan rate → base-price
  // resolution the rooms page used to build the plan options.
  let total = baseTotal;
  let ratePlanId: string | null = null;
  let ratePlanName: string | null = null;
  if (type && searchParams.plan) {
    const { plans, overridesByPlan } = await getPublicRatePlans(property.id);
    const plan = plans.find((p) => p.id === searchParams.plan);
    if (plan) {
      const basePrice = type.daily_rate ?? (type.available > 0 ? baseTotal / nights : 0);
      const nightly = planNightlyPrice(plan, type.room_type_id, overridesByPlan, basePrice);
      total = nightly * nights;
      ratePlanId = plan.id;
      ratePlanName = plan.name;
    }
  }

  return (
    <CheckoutForm
      code={params.code}
      propertyId={property.id}
      roomTypeId={searchParams.type}
      roomTypeName={type?.name ?? "Room"}
      available={type?.available ?? 0}
      checkIn={checkIn}
      checkOut={checkOut}
      nights={nights}
      adults={adults}
      childrenCount={children}
      total={total}
      currency={property.currency}
      ratePlanId={ratePlanId}
      ratePlanName={ratePlanName}
    />
  );
}
