"use server";

// Post-stay review submission — roadmap m1's public-facing half of the
// review-request pipeline (the email/cron side lives in
// lib/post-stay-review-requests.ts + app/api/cron/post-stay-review-requests).
//
// DB-free by design: there is no `reviews` table (no migration in this
// milestone), so the submitted rating/comment is never persisted — it's
// emailed straight to the property owner via sendGuestReviewNotificationEmail
// (lib/mailer.ts). A future milestone can add real storage once a migration
// is greenlit; today this mirrors the addon-catalog milestone's DB-free
// approach.
//
// The token is re-verified HERE, server-side, even though the page already
// checked it before rendering the form — never trust a client-supplied
// bookingId/code pair without re-proving it against the signed token, the
// same discipline every other guest self-service action in this app follows.

import { getBookingForReview, getTenantOwnerEmail } from "@/lib/book";
import { verifyPostStayReviewRequestToken } from "@/lib/guest-session";
import { sendGuestReviewNotificationEmail } from "@/lib/mailer";
import { ActionResult, ok, fail } from "@/lib/errors";

export interface SubmitGuestReviewInput {
  code: string;
  bookingId: string;
  token: string;
  rating: number;
  comment: string;
}

export async function submitGuestReviewAction(
  input: SubmitGuestReviewInput
): Promise<ActionResult<{ submitted: true }>> {
  const code = (input.code || "").trim();
  const bookingId = (input.bookingId || "").trim();

  const payload = verifyPostStayReviewRequestToken(input.token, bookingId, code);
  if (!payload) {
    return fail(
      "HG-AUTH-401",
      "ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว / This link is invalid or has expired."
    );
  }

  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return fail(
      "HG-VALIDATION-422",
      "กรุณาให้คะแนน 1-5 ดาว / Please choose a rating from 1 to 5 stars."
    );
  }
  const comment = (input.comment || "").trim().slice(0, 2000);

  const booking = await getBookingForReview(bookingId, code);
  if (!booking) {
    return fail("HG-BOOK-404", "ไม่พบการจองนี้ / Booking not found.");
  }

  const ownerEmail = await getTenantOwnerEmail(booking.tenantId);
  if (!ownerEmail) {
    return fail(
      "HG-MAIL-500",
      "ไม่พบอีเมลเจ้าของที่พัก กรุณาลองใหม่ภายหลัง / Could not find the property's contact email — please try again later."
    );
  }

  const sendRes = await sendGuestReviewNotificationEmail({
    to: ownerEmail,
    propertyName: booking.propertyName,
    bookingCode: booking.code,
    guestName: booking.guestName,
    rating,
    comment,
  });
  if (!sendRes.ok) {
    return fail(
      "HG-MAIL-500",
      sendRes.message || "ส่งรีวิวไม่สำเร็จ กรุณาลองใหม่ / Failed to submit your review — please try again."
    );
  }

  return ok({ submitted: true as const });
}
