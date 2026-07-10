import { getBookingForReview } from "@/lib/book";
import { verifyPostStayReviewRequestToken } from "@/lib/guest-session";
import ReviewForm from "@/components/book/ReviewForm";

export const dynamic = "force-dynamic";

export default async function GuestReviewPage({
  params,
  searchParams,
}: {
  params: { code: string; bookingId: string };
  searchParams: { token?: string };
}) {
  const code = params.code;
  const bookingId = params.bookingId;
  const token = searchParams.token ?? "";

  const payload = verifyPostStayReviewRequestToken(token, bookingId, code);

  if (!payload) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--app-danger)] text-white">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            ลิงก์หมดอายุหรือไม่ถูกต้อง / Link expired or invalid
          </h1>
          <p className="mt-2 text-sm text-[var(--app-fg-muted)]">
            ลิงก์รีวิวนี้ใช้งานไม่ได้แล้ว กรุณาติดต่อที่พักโดยตรงหากต้องการฝากรีวิว
            <br />
            This review link is no longer valid. Please contact the property directly if you&apos;d
            like to share feedback.
          </p>
        </div>
      </div>
    );
  }

  const booking = await getBookingForReview(bookingId, code);

  if (!booking) {
    return (
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-center">
        <p className="text-sm text-[var(--app-fg-muted)]">ไม่พบการจองนี้ / Booking not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">รีวิวการเข้าพักของคุณ / Review your stay</h1>
        <p className="mt-2 text-sm text-[var(--app-fg-muted)]">
          {booking.propertyName} · {booking.guestName} · {booking.code}
        </p>
        <p className="mt-1 text-xs text-[var(--app-fg-muted)]">
          {booking.roomTypeName} · {booking.checkIn} → {booking.checkOut}
        </p>
      </div>
      <ReviewForm code={code} bookingId={bookingId} token={token} />
    </div>
  );
}
