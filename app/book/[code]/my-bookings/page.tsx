import Link from "next/link";
import { cookies } from "next/headers";
import { getPublicProperty } from "@/lib/book";
import { verifyGuestToken, GUEST_SESSION_COOKIE } from "@/lib/guest-session";
import { getMyBookingsAction, signOutGuestAction } from "./actions";
import GuestLoginForm from "@/components/book/GuestLoginForm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "รอยืนยัน / Pending",
  confirmed: "ยืนยันแล้ว / Confirmed",
  checked_in: "เช็คอินแล้ว / Checked in",
  checked_out: "เช็คเอาท์แล้ว / Checked out",
  cancelled: "ยกเลิกแล้ว / Cancelled",
};

const ERROR_MESSAGE: Record<string, string> = {
  invalid_link:
    "ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่ / This link is invalid or has expired — please request a new one.",
  unavailable:
    "ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อที่พักโดยตรง / Sign-in isn't configured yet — please contact the property directly.",
};

export default async function MyBookingsPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { error?: string };
}) {
  const property = await getPublicProperty(params.code);

  if (!property) {
    return (
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-center">
        <p className="text-sm text-[var(--app-fg-muted)]">ไม่พบที่พักนี้ / Property not found.</p>
      </div>
    );
  }

  // Read-only check here just to decide which UI to render (login form vs.
  // dashboard) — getMyBookingsAction below re-verifies the same cookie
  // itself server-side before it ever touches the booking-history RPC, so
  // this first check is not load-bearing for security, only for routing.
  const token = cookies().get(GUEST_SESSION_COOKIE)?.value;
  const session = verifyGuestToken(token, params.code);

  if (!session) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <GuestLoginForm propertyCode={params.code} propertyName={property.name} />
        {searchParams.error && (
          <p className="text-center text-sm text-[var(--app-danger)]">
            {ERROR_MESSAGE[searchParams.error] ?? ERROR_MESSAGE.invalid_link}
          </p>
        )}
        <div className="text-center">
          <Link
            href={`/book/${params.code}/manage`}
            className="text-sm text-[var(--app-accent)] underline"
          >
            หรือค้นหาด้วยหมายเลขการจอง / Or look up by booking code
          </Link>
        </div>
      </div>
    );
  }

  const result = await getMyBookingsAction(params.code);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">การจองของฉัน / My Bookings</h1>
        <p className="mt-2 text-sm text-[var(--app-fg-muted)]">
          {property.name} · {session.email}
        </p>
      </div>

      <div className="app-surface rounded-2xl border border-[var(--app-border)] p-5">
        {!result.ok ? (
          <p className="text-sm text-[var(--app-danger)]">{result.message}</p>
        ) : result.data.length === 0 ? (
          <p className="text-sm text-[var(--app-fg-muted)]">
            ยังไม่มีการจองสำหรับอีเมลนี้ที่ที่พักนี้ / No bookings found for this email at this
            property yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {result.data.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 border-t border-[var(--app-border)] pt-2 text-sm first:border-t-0 first:pt-0"
              >
                <div>
                  <div className="text-[var(--app-fg)]">
                    {b.checkIn} → {b.checkOut}
                  </div>
                  <div className="text-xs text-[var(--app-fg-muted)]">{b.roomTypeName}</div>
                </div>
                <span className="flex-none text-xs text-[var(--app-fg-muted)]">
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <Link
          href={`/book/${params.code}/manage`}
          className="text-[var(--app-accent)] underline"
        >
          จัดการ/ยกเลิกการจอง / Manage a booking
        </Link>
        <form action={signOutGuestAction.bind(null, params.code)}>
          <button type="submit" className="text-[var(--app-fg-muted)] underline">
            ออกจากระบบ / Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
