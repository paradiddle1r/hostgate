import { getActiveProperty } from "@/lib/active-property-server";
import { listInvoices } from "@/lib/db/invoices";
import { listAllBookings } from "@/lib/db/bookings";
import InvoicesClient from "@/components/app/invoices/InvoicesClient";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const active = await getActiveProperty();
  if (!active.ok) return null;
  const property = active.data.property;

  const [invRes, bookingsRes] = await Promise.all([
    listInvoices(property.id),
    listAllBookings(property.id),
  ]);

  const invoices = invRes.ok ? invRes.data : [];
  // Picker only needs a handful — the action caps at 500, we slice to ~50.
  // Exclude blocked/OOS placeholder rows; staff should never invoice them.
  const bookings = (bookingsRes.ok ? bookingsRes.data : [])
    .filter((b) => b.booking_type !== "blocked" && b.booking_type !== "oos")
    .slice(0, 50);

  return (
    <InvoicesClient invoices={invoices} bookings={bookings} currency={property.currency} />
  );
}
