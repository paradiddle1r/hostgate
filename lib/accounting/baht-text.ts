// lib/accounting/baht-text.ts
// ────────────────────────────────────────────────────────────────────────────
// Thai "amount in words" (จำนวนเงินตัวอักษร) — required on tax documents and on
// the withholding-tax certificate (50 ทวิ). Pure, no deps, unit-tested.
//
// Rules implemented (standard Thai reading):
//   • digit words ศูนย์…เก้า, place words สิบ ร้อย พัน หมื่น แสน, ล้าน repeats
//     for groups of six.
//   • tens place: 1 → "สิบ" (not หนึ่งสิบ), 2 → "ยี่สิบ".
//   • units place 1 with a higher non-zero digit in the same group → "เอ็ด".
//   • baht + สตางค์; whole amount → "…บาทถ้วน"; sub-baht only → "…สตางค์".
//   • rounds to 2 dp (satang) half away from zero before reading.
// ────────────────────────────────────────────────────────────────────────────

const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACE = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

// Read a 1..6 digit group (plain integer string, leading zeros stripped) into
// Thai words. Returns '' for 0.
function readGroup(numStr: string): string {
  const L = numStr.length;
  let s = "";
  for (let i = 0; i < L; i++) {
    const d = Number(numStr[i]);
    if (d === 0) continue;
    const pos = L - i - 1; // 0 = units … 5 = แสน
    if (pos === 0 && d === 1 && L > 1) {
      s += "เอ็ด";
      continue;
    }
    if (pos === 1 && d === 1) {
      s += "สิบ";
      continue;
    }
    if (pos === 1 && d === 2) {
      s += "ยี่สิบ";
      continue;
    }
    s += DIGITS[d] + PLACE[pos];
  }
  return s;
}

/** Read a non-negative integer into Thai words. 0 → 'ศูนย์'. */
export function readThaiInteger(value: unknown): string {
  const n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return "ศูนย์";
  const str = String(n);
  // Split into groups of six from the right (ล้าน boundaries).
  const groups: string[] = [];
  let rest = str;
  while (rest.length > 6) {
    groups.unshift(rest.slice(-6));
    rest = rest.slice(0, -6);
  }
  groups.unshift(rest);
  let s = "";
  for (let g = 0; g < groups.length; g++) {
    const grpNum = Number(groups[g]); // strips leading zeros — position preserved
    if (g > 0) s += "ล้าน";
    if (grpNum !== 0) s += readGroup(String(grpNum));
  }
  return s;
}

/**
 * Thai baht amount in words. e.g. 1234.50 → "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์".
 * Negative amounts are prefixed with "ลบ".
 */
export function bahtText(amount: unknown): string {
  let n = Number(amount);
  if (!Number.isFinite(n)) n = 0;
  const neg = n < 0;
  n = Math.abs(n);
  // round to satang, ties away from zero
  const totalSatang = Math.round(n * 100 + 1e-6);
  const baht = Math.floor(totalSatang / 100);
  const satang = totalSatang % 100;

  let out: string;
  if (baht === 0 && satang === 0) {
    out = "ศูนย์บาทถ้วน";
  } else if (satang === 0) {
    out = readThaiInteger(baht) + "บาทถ้วน";
  } else if (baht === 0) {
    out = readThaiInteger(satang) + "สตางค์";
  } else {
    out = readThaiInteger(baht) + "บาท" + readThaiInteger(satang) + "สตางค์";
  }
  return (neg ? "ลบ" : "") + out;
}
