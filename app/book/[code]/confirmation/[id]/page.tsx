import Link from "next/link";

export const dynamic = "force-dynamic";

interface ConfirmationLine {
  roomTypeName: string;
  ratePlanName?: string | null;
  qty: number;
  codes: string[];
  total: number;
}

export default function BookConfirmationPage({
  params,
  searchParams,
}: {
  params: { code: string; id: string };
  searchParams: {
    ref?: string;
    room?: string;
    check_in?: string;
    check_out?: string;
    nights?: string;
    adults?: string;
    children?: string;
    total?: string;
    currency?: string;
    items?: string;
  };
}) {
  const checkIn = searchParams.check_in ?? "";
  const checkOut = searchParams.check_out ?? "";
  const nights = Number(searchParams.nights) || 0;
  const adults = Number(searchParams.adults) || 0;
  const childrenCount = Number(searchParams.children) || 0;
  const total = Number(searchParams.total) || 0;
  const currency = searchParams.currency ?? "";
  const money = (n: number) => `${currency} ${n.toLocaleString()}`.trim();

  // New cart-checkout flow: an itemized JSON blob with every line's booking
  // codes. Falls back to the legacy single `ref`/`room` query params so an
  // old bookmarked/shared confirmation link still renders.
  let items: ConfirmationLine[] = [];
  if (searchParams.items) {
    try {
      const parsed = JSON.parse(searchParams.items);
      if (Array.isArray(parsed)) items = parsed as ConfirmationLine[];
    } catch {
      items = [];
    }
  }
  if (items.length === 0 && searchParams.ref && searchParams.room) {
    items = [{ roomTypeName: searchParams.room, qty: 1, codes: [searchParams.ref], total }];
  }
  const allCodes = items.flatMap((i) => i.codes);
  const hasDetails = items.length > 0 && !!checkIn && !!checkOut;

  return (
    <div className="mx-auto max-w-md space-y-5 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--app-success)] text-white">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">ได้รับการจองแล้ว / Booking received</h1>
        <p className="mt-2 text-sm text-[var(--app-fg-muted)]">
          ขอบคุณครับ ทางที่พักจะติดต่อกลับเพื่อยืนยันการจอง
          <br />
          Thank you — the property will contact you to confirm.
        </p>
      </div>
      {allCodes.length > 0 && (
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
            {allCodes.length > 1 ? "หมายเลขอ้างอิง / Reference codes" : "หมายเลขอ้างอิง / Reference"}
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-x-2 gap-y-1 font-mono text-lg font-semibold">
            {allCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      )}
      {hasDetails && (
        <div className="app-surface rounded-2xl border border-[var(--app-border)] p-4 text-left">
          <div className="text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
            รายละเอียดการจอง / Booking details
          </div>
          <div className="mt-2 space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="text-sm">
                <div className="font-semibold text-[var(--app-fg)]">
                  {item.roomTypeName} × {item.qty}
                  {item.ratePlanName ? ` · ${item.ratePlanName}` : ""}
                </div>
                <div className="text-xs text-[var(--app-fg-muted)]">
                  {item.codes.join(", ")} · {money(item.total)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-1 text-sm text-[var(--app-fg-muted)]">
            <div>
              {checkIn} → {checkOut}{" "}
              {nights > 0 && (
                <span className="text-[var(--app-fg)]">({nights} คืน / nights)</span>
              )}
            </div>
            <div>
              {adults} ผู้ใหญ่ / adults
              {childrenCount > 0 ? ` · ${childrenCount} เด็ก / children` : ""}
            </div>
          </div>
          <div className="mt-3 border-t border-[var(--app-border)] pt-3 text-base font-semibold">
            รวมทั้งหมด / Grand total: {money(total)}
          </div>
        </div>
      )}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href={`/book/${params.code}`}
          className="inline-block rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm hover:bg-[var(--app-surface-2)]"
        >
          จองอีกครั้ง / Make another booking
        </Link>
        <Link
          href={
            allCodes[0]
              ? `/book/${params.code}/manage?ref=${encodeURIComponent(allCodes[0])}`
              : `/book/${params.code}/manage`
          }
          className="inline-block rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm hover:bg-[var(--app-surface-2)]"
        >
          จัดการ/ยกเลิกการจอง / Manage or cancel booking
        </Link>
      </div>
    </div>
  );
}
