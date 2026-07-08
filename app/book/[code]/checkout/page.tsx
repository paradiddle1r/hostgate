import Link from "next/link";
import { getPublicProperty, getAvailability, getQuote, getPublicRatePlans, planNightlyPrice } from "@/lib/book";
import { decodeCartItems } from "@/lib/book-cart";
import CheckoutForm, { type CheckoutLineItem } from "@/components/book/CheckoutForm";

export const dynamic = "force-dynamic";

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function BookCheckoutPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: {
    item?: string | string[];
    check_in?: string;
    check_out?: string;
    adults?: string;
    children?: string;
  };
}) {
  const property = await getPublicProperty(params.code);
  const rawItems = searchParams.item ? (Array.isArray(searchParams.item) ? searchParams.item : [searchParams.item]) : [];
  const cartItems = decodeCartItems(rawItems);

  if (!property || cartItems.length === 0 || !isDate(searchParams.check_in) || !isDate(searchParams.check_out)) {
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
  const nights = Math.max(
    1,
    Math.round((Date.parse(checkOut + "T00:00:00Z") - Date.parse(checkIn + "T00:00:00Z")) / 86_400_000)
  );

  // Recompute EVERY cart line's price server-side, exactly the way the
  // original single-item flow did — never trust the querystring for money.
  const avail = await getAvailability(property.id, checkIn, checkOut);
  const { plans, overridesByPlan } = await getPublicRatePlans(property.id);

  const lineItems: CheckoutLineItem[] = await Promise.all(
    cartItems.map(async (item) => {
      const type = avail.find((a) => a.room_type_id === item.roomTypeId);
      if (!type) {
        return {
          roomTypeId: item.roomTypeId,
          roomTypeName: "Room",
          qty: item.qty,
          available: 0,
          ratePlanId: null,
          ratePlanName: null,
          unitTotal: 0,
          lineTotal: 0,
          insufficientAvailability: true,
        };
      }
      const baseTotal = type.available > 0 ? await getQuote(property.id, type.room_type_id, checkIn, checkOut) : 0;

      let unitTotal = baseTotal;
      let ratePlanId: string | null = null;
      let ratePlanName: string | null = null;
      if (item.planId) {
        const plan = plans.find((p) => p.id === item.planId);
        if (plan) {
          const basePrice = type.daily_rate ?? (type.available > 0 ? baseTotal / nights : 0);
          const nightly = planNightlyPrice(plan, type.room_type_id, overridesByPlan, basePrice);
          unitTotal = nightly * nights;
          ratePlanId = plan.id;
          ratePlanName = plan.name;
        }
      }

      return {
        roomTypeId: type.room_type_id,
        roomTypeName: type.name,
        qty: item.qty,
        available: type.available,
        ratePlanId,
        ratePlanName,
        unitTotal,
        lineTotal: unitTotal * item.qty,
        insufficientAvailability: item.qty > type.available,
      };
    })
  );

  // Same room type requested across multiple lines (e.g. two different rate
  // plans) must not together exceed the type's own availability.
  const requestedByType = new Map<string, number>();
  for (const line of lineItems) {
    requestedByType.set(line.roomTypeId, (requestedByType.get(line.roomTypeId) ?? 0) + line.qty);
  }
  for (const line of lineItems) {
    if ((requestedByType.get(line.roomTypeId) ?? 0) > line.available) {
      line.insufficientAvailability = true;
    }
  }

  const grandTotal = lineItems.reduce((sum, l) => sum + l.lineTotal, 0);

  return (
    <CheckoutForm
      code={params.code}
      propertyId={property.id}
      checkIn={checkIn}
      checkOut={checkOut}
      nights={nights}
      adults={adults}
      childrenCount={children}
      items={lineItems}
      total={grandTotal}
      currency={property.currency}
    />
  );
}
