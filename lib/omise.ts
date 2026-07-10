import "server-only";

export type OmiseChargeResult =
  | { ok: true; chargeId: string; status: string }
  | { ok: false; message: string };

export async function createOmiseCharge(input: {
  token: string;
  amount: number;
  currency: string;
  description: string;
}): Promise<OmiseChargeResult> {
  const secretKey = process.env.OMISE_SECRET_KEY;
  if (!secretKey) {
    return {
      ok: false,
      message: "ระบบชำระเงินยังไม่พร้อมใช้งาน / Payment is not configured.",
    };
  }
  if (!/^sk_test_/.test(secretKey)) {
    return {
      ok: false,
      message: "ใช้ได้เฉพาะ Omise test key สำหรับ checkout นี้ / Only an Omise test secret key is allowed here.",
    };
  }
  if (!input.token.trim()) {
    return { ok: false, message: "ไม่พบ token บัตร / Missing card token." };
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, message: "ยอดชำระไม่ถูกต้อง / Invalid payment amount." };
  }

  try {
    const body = new URLSearchParams({
      card: input.token,
      amount: String(input.amount),
      currency: input.currency.toLowerCase(),
      description: input.description,
    });
    const res = await fetch("https://api.omise.co/charges", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as
      | { id?: string; status?: string; message?: string }
      | null;
    if (!res.ok || !json?.id) {
      return {
        ok: false,
        message:
          json?.message ||
          "ชำระเงินไม่สำเร็จ กรุณาตรวจสอบบัตรแล้วลองอีกครั้ง / Payment failed. Please check your card and try again.",
      };
    }
    return {
      ok: true,
      chargeId: json.id,
      status: json.status || "unknown",
    };
  } catch {
    return {
      ok: false,
      message: "ติดต่อ Omise ไม่สำเร็จ กรุณาลองอีกครั้ง / Could not contact Omise. Please try again.",
    };
  }
}
