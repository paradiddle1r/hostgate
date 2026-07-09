import "server-only";

// Booking-confirmation email sender. This is the single place that formats
// and sends a guest-facing booking receipt — both the initial booking
// confirmation and the guest self-service "resend confirmation email"
// action (app/book/actions.ts) call this same function so the two emails
// never drift apart.
//
// Uses the Resend HTTP API directly via fetch (no SDK dependency to add).
// Degrades gracefully when RESEND_API_KEY isn't configured: logs a warning
// server-side and returns { ok: false }, rather than throwing — a missing
// mail provider must never break the booking or resend flow.

export interface BookingConfirmationEmailInput {
  to: string;
  propertyName: string;
  bookingCode: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  currency: string;
}

export async function sendBookingConfirmationEmail(
  input: BookingConfirmationEmailInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const to = (input.to || "").trim();
  if (!to) {
    return { ok: false, message: "Missing recipient email." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "HostGate <bookings@hostgate.app>";
  if (!apiKey) {
    console.warn(
      `[mailer] RESEND_API_KEY not set — skipping booking confirmation email to ${to} (booking ${input.bookingCode})`
    );
    return { ok: false, message: "Email sending is not configured." };
  }

  const money = `${input.currency} ${(Number(input.totalAmount) || 0).toLocaleString()}`;
  const subject = `ยืนยันการจอง / Booking confirmation — ${input.bookingCode}`;
  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">
      <h2 style="margin-bottom:4px">ยืนยันการจอง / Booking confirmation</h2>
      <p style="color:#555;margin-top:0">${input.propertyName}</p>
      <p><strong>${input.roomTypeName}</strong></p>
      <p>${input.checkIn} → ${input.checkOut} (${input.nights} คืน / nights)</p>
      <p>หมายเลขการจอง / Booking code: <strong>${input.bookingCode}</strong></p>
      <p>รวม / Total: <strong>${money}</strong></p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `Email provider error (${res.status}): ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to send email." };
  }
}

// Guest self-service "My Bookings" login link (app/book/[code]/my-bookings).
// Same sender, same env vars, same graceful-degrade behavior as
// sendBookingConfirmationEmail above — a missing mail provider must never
// break the login flow, it just fails the request with a clear message.

export interface MagicLinkEmailInput {
  to: string;
  propertyName: string;
  propertyCode: string;
  link: string;
}

export async function sendMagicLinkEmail(
  input: MagicLinkEmailInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const to = (input.to || "").trim();
  if (!to) {
    return { ok: false, message: "Missing recipient email." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "HostGate <bookings@hostgate.app>";
  if (!apiKey) {
    console.warn(
      `[mailer] RESEND_API_KEY not set — skipping guest login link email to ${to} (property ${input.propertyCode})`
    );
    return { ok: false, message: "Email sending is not configured." };
  }

  const subject = `ลิงก์เข้าสู่ระบบ / Your sign-in link — ${input.propertyName}`;
  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">
      <h2 style="margin-bottom:4px">เข้าสู่ระบบ "การจองของฉัน" / Sign in to My Bookings</h2>
      <p style="color:#555;margin-top:0">${input.propertyName}</p>
      <p>
        คลิกลิงก์ด้านล่างเพื่อดูการจองทั้งหมดของคุณที่ที่พักนี้ (ลิงก์นี้จะหมดอายุใน 15 นาที)
        <br />
        Click the link below to view all your bookings at this property (this link expires in 15
        minutes).
      </p>
      <p>
        <a
          href="${input.link}"
          style="display:inline-block;margin-top:8px;padding:10px 18px;border-radius:8px;background:#111;color:#fff;text-decoration:none"
        >
          เข้าสู่ระบบ / Sign in
        </a>
      </p>
      <p style="color:#888;font-size:12px;margin-top:16px">
        หากคุณไม่ได้ร้องขอลิงก์นี้ สามารถละเว้นอีเมลนี้ได้ / If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `Email provider error (${res.status}): ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to send email." };
  }
}
