"use client";

import { useState } from "react";
import { AlertTriangle, Printer } from "lucide-react";
import {
  lookupPublicBookingAction,
  cancelPublicBookingAction,
  resendPublicBookingConfirmationAction,
} from "@/app/book/actions";
import type { PublicBookingDetails } from "@/lib/book";
import Button from "@/components/app/ui/Button";

const field =
  "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--app-accent)]";

const STATUS_LABEL: Record<string, string> = {
  pending: "รอยืนยัน / Pending",
  confirmed: "ยืนยันแล้ว / Confirmed",
  checked_in: "เช็คอินแล้ว / Checked in",
  checked_out: "เช็คเอาท์แล้ว / Checked out",
  cancelled: "ยกเลิกแล้ว / Cancelled",
};

function isPast(dateISO: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateISO <= today;
}

export default function ManageBookingForm({
  propertyCode,
  propertyName,
  initialCode,
}: {
  propertyCode: string;
  propertyName?: string;
  initialCode?: string;
}) {
  const [code, setCode] = useState(initialCode ?? "");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<PublicBookingDetails | null>(null);

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const money = (n: number, currency: string) => `${currency} ${(Number(n) || 0).toLocaleString()}`;

  async function lookup() {
    setError("");
    if (!code.trim()) {
      setError("กรุณากรอกหมายเลขการจอง / Please enter your booking code.");
      return;
    }
    if (!email.trim()) {
      setError("กรุณากรอกอีเมล / Please enter your email.");
      return;
    }
    setLoading(true);
    setBooking(null);
    setConfirmingCancel(false);
    setCancelError("");
    setResendMsg(null);
    const res = await lookupPublicBookingAction(propertyCode, code, email);
    setLoading(false);
    if (res.ok) {
      setBooking(res.data);
    } else {
      setError(res.message);
    }
  }

  async function cancel() {
    setCancelling(true);
    setCancelError("");
    const res = await cancelPublicBookingAction(propertyCode, code, email);
    setCancelling(false);
    if (res.ok) {
      setConfirmingCancel(false);
      setBooking((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
    } else {
      setCancelError(res.message);
    }
  }

  async function resendConfirmation() {
    setResending(true);
    setResendMsg(null);
    const res = await resendPublicBookingConfirmationAction(propertyCode, code, email);
    setResending(false);
    if (res.ok) {
      setResendMsg({
        type: "success",
        text: "ส่งอีเมลยืนยันอีกครั้งแล้ว / Confirmation email resent.",
      });
    } else {
      setResendMsg({ type: "error", text: res.message });
    }
  }

  const canCancel =
    !!booking &&
    (booking.status === "pending" || booking.status === "confirmed") &&
    !isPast(booking.checkIn);

  function printReceipt() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #booking-receipt,
          #booking-receipt * {
            visibility: visible;
          }
          #booking-receipt {
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      <div className="text-center print:hidden">
        <h1 className="text-xl font-semibold tracking-tight">
          จัดการการจอง / Manage my booking
        </h1>
        <p className="mt-2 text-sm text-[var(--app-fg-muted)]">
          กรอกหมายเลขการจองและอีเมลที่ใช้ตอนจอง
          <br />
          Enter your booking code and the email you used at checkout.
        </p>
      </div>

      <div className="app-surface space-y-3 rounded-2xl border border-[var(--app-border)] p-5 print:hidden">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--app-fg-muted)]">
            หมายเลขการจอง / Booking code
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${field} w-full`}
            placeholder="BK-MMM-01-0001"
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

        {error && <p className="text-sm text-[var(--app-danger)]">{error}</p>}

        <Button onClick={lookup} loading={loading} className="w-full">
          ค้นหาการจอง / Find my booking
        </Button>
      </div>

      {booking && (
        <div
          id="booking-receipt"
          className="app-surface rounded-2xl border border-[var(--app-border)] p-5 text-left"
        >
          {propertyName && (
            <div className="mb-1 hidden text-sm font-semibold print:block">
              {propertyName}
            </div>
          )}
          <div className="text-xs uppercase tracking-wide text-[var(--app-fg-muted)]">
            รายละเอียดการจอง / Booking details
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-semibold">{booking.roomTypeName}</span>
            <span className="font-mono text-xs text-[var(--app-fg-muted)]">{booking.code}</span>
          </div>
          <div className="mt-2 space-y-1 text-sm text-[var(--app-fg-muted)]">
            <div>
              {booking.checkIn} → {booking.checkOut}{" "}
              <span className="text-[var(--app-fg)]">
                ({booking.nights} คืน / nights)
              </span>
            </div>
            <div>
              สถานะ / Status:{" "}
              <span className="text-[var(--app-fg)]">
                {STATUS_LABEL[booking.status] ?? booking.status}
              </span>
            </div>
          </div>
          <div className="mt-3 border-t border-[var(--app-border)] pt-3 text-base font-semibold">
            รวม / Total: {money(booking.totalAmount, booking.currency)}
          </div>

          <div className="mt-4 print:hidden">
            <Button
              variant="ghost"
              onClick={printReceipt}
              className="w-full"
            >
              <span className="flex items-center justify-center gap-1.5">
                <Printer size={15} />
                พิมพ์/บันทึกใบยืนยัน / Print · Save receipt
              </span>
            </Button>
          </div>

          {booking.status !== "cancelled" && (
            <div className="mt-4 print:hidden">
              <Button
                variant="ghost"
                onClick={resendConfirmation}
                loading={resending}
                disabled={resending}
                className="w-full"
              >
                ส่งอีเมลยืนยันอีกครั้ง / Resend confirmation email
              </Button>
              {resendMsg && (
                <p
                  className={`mt-2 text-sm ${
                    resendMsg.type === "success"
                      ? "text-[var(--app-success)]"
                      : "text-[var(--app-danger)]"
                  }`}
                >
                  {resendMsg.text}
                </p>
              )}
            </div>
          )}

          <div className="print:hidden">
            {booking.status === "cancelled" ? (
              <p className="mt-4 text-sm text-[var(--app-fg-muted)]">
                การจองนี้ถูกยกเลิกแล้ว / This booking is already cancelled.
              </p>
            ) : booking.status === "checked_in" || booking.status === "checked_out" ? (
              <p className="mt-4 text-sm text-[var(--app-fg-muted)]">
                การจองนี้เช็คอิน/เช็คเอาท์แล้ว ไม่สามารถยกเลิกออนไลน์ได้ กรุณาติดต่อที่พักโดยตรง / This
                booking has already been checked in or checked out and can no longer be
                cancelled online — please contact the property directly.
              </p>
            ) : !canCancel ? (
              <p className="mt-4 text-sm text-[var(--app-fg-muted)]">
                เลยวันเช็คอินแล้ว กรุณาติดต่อที่พักโดยตรง / Check-in has passed —
                please contact the property directly.
              </p>
            ) : !confirmingCancel ? (
              <Button
                variant="danger"
                onClick={() => setConfirmingCancel(true)}
                className="mt-4 w-full"
              >
                ยกเลิกการจอง / Cancel booking
              </Button>
            ) : (
              <div className="mt-4 space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3">
                <div className="flex items-start gap-2 text-sm text-[var(--app-fg)]">
                  <AlertTriangle size={15} className="mt-0.5 flex-none text-[var(--app-danger)]" />
                  <span>
                    ยืนยันการยกเลิกการจองนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
                    <br />
                    Are you sure you want to cancel this booking? This cannot be undone.
                  </span>
                </div>
                {cancelError && (
                  <p className="text-sm text-[var(--app-danger)]">{cancelError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmingCancel(false)}
                    disabled={cancelling}
                    className="flex-1"
                  >
                    ย้อนกลับ / Back
                  </Button>
                  <Button
                    variant="danger"
                    onClick={cancel}
                    loading={cancelling}
                    className="flex-1"
                  >
                    ยืนยันยกเลิก / Confirm cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
