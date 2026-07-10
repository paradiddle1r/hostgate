"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import Button from "@/components/app/ui/Button";
import { useI18n, pick, translations } from "@/lib/i18n";
import { submitGuestReviewAction } from "@/app/book/[code]/review/[bookingId]/actions";

const t = translations.review;

export default function ReviewForm({
  code,
  bookingId,
  token,
}: {
  code: string;
  bookingId: string;
  token: string;
}) {
  const { locale } = useI18n();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    setError("");
    if (rating < 1 || rating > 5) {
      setError(pick(t.ratingRequired, locale));
      return;
    }
    setLoading(true);
    const res = await submitGuestReviewAction({ code, bookingId, token, rating, comment });
    setLoading(false);
    if (res.ok) {
      setSubmitted(true);
    } else {
      setError(res.message);
    }
  }

  if (submitted) {
    return (
      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-[var(--app-success)] text-white">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{pick(t.thankYouTitle, locale)}</h2>
        <p className="mt-2 text-sm text-[var(--app-fg-muted)]">{pick(t.thankYouBody, locale)}</p>
      </div>
    );
  }

  return (
    <div className="app-surface space-y-4 rounded-2xl border border-[var(--app-border)] p-5">
      <div>
        <span className="mb-2 block text-sm font-medium text-[var(--app-fg)]">
          {pick(t.ratingLabel, locale)}
        </span>
        <div
          className="flex items-center gap-1"
          role="radiogroup"
          aria-label={pick(t.ratingLabel, locale)}
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= (hoverRating || rating);
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={String(n)}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                className="rounded-md p-1 transition-transform hover:scale-110"
              >
                <Star
                  size={28}
                  className={
                    filled
                      ? "fill-[var(--app-accent)] text-[var(--app-accent)]"
                      : "text-[var(--app-border)]"
                  }
                />
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
          {pick(t.commentLabel, locale)}
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={pick(t.commentPh, locale)}
          className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]"
        />
      </label>

      {error && <p className="text-sm text-[var(--app-danger)]">{error}</p>}

      <Button onClick={submit} loading={loading} className="w-full">
        {loading ? pick(t.submitting, locale) : pick(t.submit, locale)}
      </Button>
    </div>
  );
}
