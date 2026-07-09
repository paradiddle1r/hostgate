"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Tag } from "lucide-react";
import { submitPublicBooking, lookupReturningGuestAction } from "@/app/book/actions";
import Button from "@/components/app/ui/Button";
import { clearCart } from "@/lib/book-cart";
import { applyPromoDiscount, type PromoCode } from "@/lib/promo-codes";

export interface CheckoutLineItem {
  roomTypeId: string;
  roomTypeName: string;
  qty: number;
  available: number;
  ratePlanId: string | null;
  ratePlanName: string | null;
  /** Server-recomputed price for ONE room of this type/plan for the whole stay. */
  unitTotal: number;
  /** unitTotal * qty. */
  lineTotal: number;
  /** True if this line (or its room type combined across other cart lines)
   * exceeds availability for the shared date range. */
  insufficientAvailability: boolean;
}

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

export default function CheckoutForm({
  code,
  propertyId,
  checkIn,
  checkOut,
  nights,
  adults,
  childrenCount,
  items,
  total,
  currency,
}: {
  code: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  childrenCount: number;
  items: CheckoutLineItem[];
  total: number;
  currency: string;
}) {
  const router = useRouter();
  const money = (n: number) => `${currency} ${(Number(n) || 0).toLocaleString()}`;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [returningGuestName, setReturningGuestName] = useState<string | null>(null);

  // Returning-guest recognition: only once BOTH email and phone are typed
  // (never just one — that would let a stranger who merely guesses an email
  // see someone else's name), debounced ~500ms so we're not querying on
  // every keystroke. `name` is intentionally NOT a dependency here — this
  // effect only decides whether to *look up*, never re-runs just because the
  // guest kept typing their own name.
  useEffect(() => {
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedEmail || !trimmedPhone) {
      setReturningGuestName(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await lookupReturningGuestAction(propertyId, trimmedEmail, trimmedPhone);
      if (cancelled) return;
      if (result?.name) {
        setReturningGuestName(result.name);
        setName((current) => (current.trim() ? current : result.name));
      } else {
        setReturningGuestName(null);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, phone, propertyId]);

  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoError, setPromoError] = useState("");

  const discountedTotal = Math.max(0, total - discountAmount);
  const hasUnavailable = items.some((i) => i.insufficientAvailability);

  function applyPromo() {
    setPromoError("");
    const result = applyPromoDiscount(total, promoInput);
    if (!result.ok) {
      setAppliedPromo(null);
      setDiscountAmount(0);
      setPromoError(result.message || "รหัสส่วนลดไม่ถูกต้อง / Invalid promo code.");
      return;
    }
    setAppliedPromo(result.promo ?? null);
    setDiscountAmount(result.discountAmount);
  }

  function removePromo() {
    setPromoInput("");
    setAppliedPromo(null);
    setDiscountAmount(0);
    setPromoError("");
  }

  async function confirm() {
    setError("");
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ / Please enter your name.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError(
        "กรุณากรอกเบอร์โทรหรืออีเมลอย่างน้อย 1 ช่องทาง / Please enter at least a phone number or an email so the property can contact you."
      );
      return;
    }
    setSubmitting(true);
    const res = await submitPublicBooking({
      propertyId,
      checkIn,
      checkOut,
      guestName: name,
      phone,
      email,
      adults,
      children: childrenCount,
      items: items.map((i) => ({
        roomTypeId: i.roomTypeId,
        roomTypeName: i.roomTypeName,
        qty: i.qty,
        ratePlanId: i.ratePlanId,
        ratePlanName: i.ratePlanName,
      })),
      promoCode: appliedPromo?.code ?? null,
      currency,
    });
    if (res.ok) {
      // The whole cart succeeded (or was rolled back — never a partial
      // "confirmed" here). Clear the sessionStorage cart for this property
      // so the next visit starts fresh.
      clearCart(code);
      const qs = new URLSearchParams({
        check_in: checkIn,
        check_out: checkOut,
        nights: String(nights),
        adults: String(adults),
        children: String(childrenCount),
        // res.total is the authoritative, server-recomputed grand total
        // (already reflects the promo discount) — never the client's own.
        total: String(res.total),
        currency,
        // Itemized lines for the confirmation page — room/plan names are
        // display-only, codes + qty come straight from what was actually
        // created.
        items: JSON.stringify(
          res.items.map((i) => ({
            roomTypeName: i.roomTypeName,
            ratePlanName: i.ratePlanName ?? null,
            qty: i.qty,
            codes: i.bookingCodes,
            total: i.total,
          }))
        ),
      });
      const firstId = res.bookingCodes[0] ?? "cart";
      router.push(`/book/${code}/confirmation/${firstId}?${qs.toString()}`);
    } else {
      setError(res.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {/* Summary */}
      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        <div className="text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
          สรุปการจอง / Summary
        </div>
        <div className="mt-3 space-y-1 text-sm text-[var(--app-fg-muted)]">
          <div>
            {checkIn} → {checkOut}{" "}
            <span className="text-[var(--app-fg)]">
              ({nights} คืน / nights)
            </span>
          </div>
          <div>
            {adults} ผู้ใหญ่ / adults
            {childrenCount > 0 ? ` · ${childrenCount} เด็ก / children` : ""}
          </div>
        </div>

        {/* Itemized cart lines */}
        <div className="mt-3 space-y-2 border-t border-[var(--app-border)] pt-3">
          {items.map((item, idx) => (
            <div
              key={`${item.roomTypeId}:${item.ratePlanId ?? ""}:${idx}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium">
                  {item.roomTypeName} × {item.qty}
                </div>
                {item.ratePlanName && (
                  <div className="text-xs text-[var(--app-fg-muted)]">
                    แผนราคา / Rate plan: {item.ratePlanName}
                  </div>
                )}
                <div className="text-xs text-[var(--app-fg-muted)]">
                  {nights} คืน / nights × {item.qty} ห้อง / rooms
                </div>
                {item.insufficientAvailability && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-[var(--app-danger)]">
                    <AlertTriangle size={12} className="flex-none" />
                    ไม่เพียงพอ / not enough availability
                  </div>
                )}
              </div>
              <div className="flex-none font-medium">{money(item.lineTotal)}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-[var(--app-border)] pt-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              รหัสส่วนลด / Promo code
            </span>
            {appliedPromo ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--app-accent)] bg-[var(--app-surface-2)] px-2.5 py-1.5 text-sm">
                <span className="flex items-center gap-1.5 text-[var(--app-fg)]">
                  <Tag size={14} className="flex-none text-[var(--app-accent)]" />
                  {appliedPromo.code}
                </span>
                <button
                  type="button"
                  onClick={removePromo}
                  className="text-xs text-[var(--app-fg-muted)] underline underline-offset-2"
                >
                  ลบ / Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="เช่น WELCOME10 / e.g. WELCOME10"
                  className={`${field} flex-1`}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={applyPromo}
                  disabled={!promoInput.trim()}
                >
                  ใช้โค้ด / Apply
                </Button>
              </div>
            )}
            {promoError && (
              <p className="mt-1.5 text-xs text-[var(--app-danger)]">{promoError}</p>
            )}
          </label>
        </div>
        <div className="mt-3 border-t border-[var(--app-border)] pt-3 text-sm">
          {appliedPromo && (
            <div className="mb-1 flex items-center justify-between text-[var(--app-fg-muted)]">
              <span>ส่วนลด / Discount ({appliedPromo.code})</span>
              <span>-{money(discountAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-base font-semibold">
            <span>รวมทั้งหมด / Grand total</span>
            <span>{money(discountedTotal)}</span>
          </div>
        </div>
      </div>

      {/* Guest form */}
      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        {hasUnavailable && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2 text-sm text-[var(--app-danger)]">
            <AlertTriangle size={15} className="flex-none" />
            บางรายการในตะกร้าไม่ว่างแล้ว กรุณากลับไปแก้ไข / Some cart items are no longer available —
            please go back and adjust.
          </div>
        )}

        {returningGuestName && (
          <div className="mb-3 rounded-lg border border-[var(--app-accent)] bg-[var(--app-surface-2)] px-3 py-2 text-sm text-[var(--app-fg)]">
            ยินดีต้อนรับกลับมา, {returningGuestName} 👋 / Welcome back, {returningGuestName} 👋
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              ชื่อ-นามสกุล / Full name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={`${field} w-full`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              เบอร์โทร / Phone
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`${field} w-full`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
              อีเมล / Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${field} w-full`}
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-[var(--app-fg-muted)]">
          ยืนยันการจอง = ชำระเงินเต็มจำนวนของตะกร้า (จำลองการชำระเงิน) / Confirm booking settles the
          full cart total now (simulated payment).
        </p>

        {error && <p className="mt-3 text-sm text-[var(--app-danger)]">{error}</p>}

        <Button
          onClick={confirm}
          loading={submitting}
          disabled={hasUnavailable || items.length === 0}
          className="mt-4 w-full"
        >
          ยืนยันการจอง / Confirm booking
        </Button>
      </div>
    </div>
  );
}
