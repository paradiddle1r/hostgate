"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { submitPublicBooking } from "@/app/book/actions";
import Button from "@/components/app/ui/Button";

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

export default function CheckoutForm({
  code,
  propertyId,
  roomTypeId,
  roomTypeName,
  available,
  checkIn,
  checkOut,
  nights,
  adults,
  childrenCount,
  total,
  currency,
}: {
  code: string;
  propertyId: string;
  roomTypeId: string;
  roomTypeName: string;
  available: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  childrenCount: number;
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

  const soldOut = available <= 0;

  async function confirm() {
    setError("");
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ / Please enter your name.");
      return;
    }
    setSubmitting(true);
    const res = await submitPublicBooking({
      propertyId,
      roomTypeId,
      checkIn,
      checkOut,
      guestName: name,
      phone,
      email,
      adults,
      children: childrenCount,
    });
    if (res.ok) {
      const qs = new URLSearchParams({
        ref: res.code,
        room: roomTypeName,
        check_in: checkIn,
        check_out: checkOut,
        nights: String(nights),
        adults: String(adults),
        children: String(childrenCount),
        total: String(total),
        currency,
      });
      router.push(`/book/${code}/confirmation/${res.id}?${qs.toString()}`);
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
        <div className="mt-2 font-semibold">{roomTypeName}</div>
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
        <div className="mt-4 border-t border-[var(--app-border)] pt-3 text-base font-semibold">
          รวม / Total: {money(total)}
        </div>
      </div>

      {/* Guest form */}
      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        {soldOut && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-2 text-sm text-[var(--app-danger)]">
            <AlertTriangle size={15} className="flex-none" />
            เต็มแล้ว / No longer available
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
          ยังไม่ต้องชำระเงินตอนนี้ — ทางที่พักจะติดต่อกลับเพื่อยืนยัน / No payment
          now — the property will contact you to confirm.
        </p>

        {error && <p className="mt-3 text-sm text-[var(--app-danger)]">{error}</p>}

        <Button
          onClick={confirm}
          loading={submitting}
          disabled={soldOut}
          className="mt-4 w-full"
        >
          ยืนยันการจอง / Confirm booking
        </Button>
      </div>
    </div>
  );
}
