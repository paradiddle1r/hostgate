"use client";

import { useState } from "react";
import { requestGuestLoginLinkAction } from "@/app/book/[code]/my-bookings/actions";
import Button from "@/components/app/ui/Button";

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

export default function GuestLoginForm({
  propertyCode,
  propertyName,
}: {
  propertyCode: string;
  propertyName?: string;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!email.trim()) {
      setError("กรุณากรอกอีเมล / Please enter your email.");
      return;
    }
    setLoading(true);
    const res = await requestGuestLoginLinkAction(propertyCode, email);
    setLoading(false);
    if (res.ok) {
      setSent(true);
    } else {
      setError(res.message);
    }
  }

  if (sent) {
    return (
      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5 text-center">
        <p className="text-sm text-[var(--app-fg)]">
          ส่งลิงก์เข้าสู่ระบบไปที่ <span className="font-medium">{email}</span> แล้ว
          กรุณาตรวจสอบกล่องอีเมล (ลิงก์จะหมดอายุใน 15 นาที)
          <br />
          <span className="text-[var(--app-fg-muted)]">
            We&apos;ve emailed a sign-in link to {email}. Check your inbox — it expires in 15
            minutes.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="app-surface space-y-3 rounded-2xl border border-[var(--app-border)] p-5">
      <div className="text-center">
        <h2 className="text-base font-semibold">การจองของฉัน / My Bookings</h2>
        <p className="mt-1 text-sm text-[var(--app-fg-muted)]">
          กรอกอีเมลที่ใช้ตอนจองที่{propertyName ?? "ที่พักนี้"} เพื่อรับลิงก์เข้าสู่ระบบ
          <br />
          Enter the email you booked with{propertyName ? ` at ${propertyName}` : ""} and
          we&apos;ll send you a sign-in link.
        </p>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
          อีเมล / Email
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${field} w-full`}
          placeholder="you@example.com"
        />
      </label>
      {error && <p className="text-sm text-[var(--app-danger)]">{error}</p>}
      <Button onClick={submit} loading={loading} className="w-full">
        ส่งลิงก์เข้าสู่ระบบ / Send sign-in link
      </Button>
    </div>
  );
}
