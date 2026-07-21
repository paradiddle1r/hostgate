import { describe, it, expect } from "vitest";
import {
  computeExpenseTotals, whtAmountFor, splitThaiName, formatRdDate,
  buildRdPrepTxt, whtCertPrefillFromExpense, composeContactAddress,
  pickExpenseColumns, pickWhtColumns, mapExpenseItems, expenseStatusMeta, pndTypeMeta,
} from "../expenses";
import { bahtText, readThaiInteger } from "../baht-text";

// computeExpenseTotals MUST match recompute_expense_totals() (migration 21).
describe("computeExpenseTotals — mirrors the DB recompute", () => {
  it("exclusive VAT 7% + WHT 3% on a 1000 base", () => {
    const r = computeExpenseTotals({
      lines: [{ qty: 1, unit_price: 1000 }], vatRate: 7, vatInclusive: false, whtRate: 3,
    });
    expect(r).toMatchObject({ subtotal: 1000, net: 1000, vat: 70, total: 1070, whtAmount: 30, netPayable: 1040 });
  });
  it("inclusive VAT 7% + WHT 3% on a 1070 gross", () => {
    const r = computeExpenseTotals({
      lines: [{ qty: 1, unit_price: 1070 }], vatRate: 7, vatInclusive: true, whtRate: 3,
    });
    expect(r).toMatchObject({ subtotal: 1070, net: 1000, vat: 70, total: 1070, whtAmount: 30, netPayable: 1040 });
  });
  it("no VAT, no WHT → passthrough", () => {
    const r = computeExpenseTotals({ lines: [{ qty: 2, unit_price: 50 }] });
    expect(r).toMatchObject({ subtotal: 100, net: 100, vat: 0, total: 100, whtAmount: 0, netPayable: 100 });
  });
  it("empty args → all zeros", () => {
    expect(computeExpenseTotals()).toMatchObject({ subtotal: 0, net: 0, vat: 0, total: 0, whtAmount: 0, netPayable: 0 });
  });
});

describe("whtAmountFor — round(base*rate/100, 2) ties away from zero", () => {
  it("rounds a half up (away from zero)", () => {
    // 100.05 × 10% = 10.005 → 10.01
    expect(whtAmountFor(100.05, 10)).toBe(10.01);
  });
  it("rounds a negative half away from zero", () => {
    expect(whtAmountFor(-100.05, 10)).toBe(-10.01);
  });
  it("common 3% case", () => {
    expect(whtAmountFor(1000, 3)).toBe(30);
    expect(whtAmountFor(0, 3)).toBe(0);
    expect(whtAmountFor(1000, 0)).toBe(0);
  });
});

describe("splitThaiName", () => {
  it("splits an individual with a title", () => {
    expect(splitThaiName("นายสมชาย ใจดี")).toEqual({ title: "นาย", first: "สมชาย", last: "ใจดี" });
  });
  it("prefers นางสาว over นาง (longest title first)", () => {
    expect(splitThaiName("นางสาวสมหญิง รักไทย")).toEqual({ title: "นางสาว", first: "สมหญิง", last: "รักไทย" });
    expect(splitThaiName("นางมาลี ดีงาม")).toEqual({ title: "นาง", first: "มาลี", last: "ดีงาม" });
  });
  it("no title → title blank", () => {
    expect(splitThaiName("สมชาย ใจดี")).toEqual({ title: "", first: "สมชาย", last: "ใจดี" });
  });
  it("company keeps the whole legal name in first", () => {
    expect(splitThaiName("บริษัท เอบีซี จำกัด", true)).toEqual({ title: "", first: "บริษัท เอบีซี จำกัด", last: "" });
  });
  it("empty name → all blank", () => {
    expect(splitThaiName("")).toEqual({ title: "", first: "", last: "" });
  });
});

describe("formatRdDate — Buddhist-era DD/MM/YYYY", () => {
  it("converts an ISO date to BE", () => {
    expect(formatRdDate("2026-07-21")).toBe("21/07/2569");
  });
  it("tolerates a timestamp", () => {
    expect(formatRdDate("2026-01-05T09:00:00Z")).toBe("05/01/2569");
  });
  it("empty → empty", () => {
    expect(formatRdDate("")).toBe("");
    expect(formatRdDate(null)).toBe("");
  });
});

describe("buildRdPrepTxt — pipe-delimited ภ.ง.ด.3/53 attachment", () => {
  const row = {
    payee_name: "นายสมชาย ใจดี",
    payee_tax_id: "1-2345-67890-12-3",
    payee_address: "123 ถนนสุข\nกรุงเทพฯ",
    payment_date: "2026-07-21",
    income_type: "7",
    wht_rate: 3,
    amount_paid: 1000,
    wht_amount: 30,
    tax_condition: "1",
  };
  it("emits one 12-column line per row", () => {
    const txt = buildRdPrepTxt([row], { pndType: "pnd3" });
    const cols = txt.split("|");
    expect(cols).toHaveLength(12);
    expect(cols[0]).toBe("1"); // sequence
    expect(cols[1]).toBe("1234567890123"); // tax id, digits only
    expect(cols[2]).toBe("นาย"); // title
    expect(cols[3]).toBe("สมชาย"); // first
    expect(cols[4]).toBe("ใจดี"); // last
    expect(cols[5]).toBe("123 ถนนสุข กรุงเทพฯ"); // address, newline flattened
    expect(cols[6]).toBe("21/07/2569"); // payment date (BE)
    expect(cols[7]).toBe("7"); // income type
    expect(cols[8]).toBe("3"); // rate
    expect(cols[9]).toBe("1000.00"); // amount paid
    expect(cols[10]).toBe("30.00"); // wht amount
    expect(cols[11]).toBe("1"); // condition
  });
  it("pnd53 treats the payee as a company (name in first, no split)", () => {
    const txt = buildRdPrepTxt([{ ...row, payee_name: "บริษัท ทดสอบ จำกัด" }], { pndType: "pnd53" });
    const cols = txt.split("|");
    expect(cols[2]).toBe(""); // no title
    expect(cols[3]).toBe("บริษัท ทดสอบ จำกัด"); // whole name
    expect(cols[4]).toBe(""); // no last
  });
  it("joins multiple rows with CRLF and renumbers", () => {
    const txt = buildRdPrepTxt([row, row], { pndType: "pnd3" });
    const lines = txt.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1].split("|")[0]).toBe("2");
  });
  it("empty input → empty string", () => {
    expect(buildRdPrepTxt([])).toBe("");
  });
});

describe("whtCertPrefillFromExpense", () => {
  const expense = {
    id: 5, total: 1070, vat_amount: 70, wht_rate: 3, wht_amount: 30,
    description: "ค่าซ่อมแอร์", paid_at: "2026-07-20T04:00:00Z", contact_id: 9,
  };
  it("pulls the pre-VAT base + WHT off a paid expense", () => {
    const p = whtCertPrefillFromExpense(expense, { id: 9, is_company: false, name: "นายช่าง", tax_id: "x", address: "aa", zipcode: "10100" });
    expect(p.pnd_type).toBe("pnd3");
    expect(p.amount_paid).toBe(1000); // 1070 − 70 VAT
    expect(p.wht_amount).toBe(30);
    expect(p.wht_rate).toBe(3);
    expect(p.payment_date).toBe("2026-07-20");
    expect(p.payee_address).toBe("aa 10100");
    expect(p.expense_id).toBe(5);
  });
  it("a company vendor → pnd53", () => {
    const p = whtCertPrefillFromExpense(expense, { id: 9, is_company: true, name: "บริษัท ก", tax_id: "y" });
    expect(p.pnd_type).toBe("pnd53");
  });
});

describe("column whitelists + item mapping", () => {
  it("pickExpenseColumns drops unknown keys", () => {
    const r = pickExpenseColumns({ description: "x", bogus: 1, vat_rate: 7, id: 99 });
    expect(r).toEqual({ description: "x", vat_rate: 7 });
  });
  it("pickWhtColumns keeps only cert columns", () => {
    const r = pickWhtColumns({ number: "WHT-2026-00001", pnd_type: "pnd3", junk: true });
    expect(r).toEqual({ number: "WHT-2026-00001", pnd_type: "pnd3" });
  });
  it("mapExpenseItems coerces to the insert shape", () => {
    expect(mapExpenseItems([{ description: "a", qty: "2", unit_price: "10.5", unit: "" }])).toEqual([
      { sort_order: 0, description: "a", unit: null, qty: 2, unit_price: 10.5 },
    ]);
  });
});

describe("metadata + address helpers", () => {
  it("expenseStatusMeta falls back to draft", () => {
    expect(expenseStatusMeta("paid").en).toBe("Paid");
    expect(expenseStatusMeta("???").v).toBe("draft");
  });
  it("pndTypeMeta falls back to pnd3", () => {
    expect(pndTypeMeta("pnd53").v).toBe("pnd53");
    expect(pndTypeMeta("nope").v).toBe("pnd3");
  });
  it("composeContactAddress joins address + zip", () => {
    expect(composeContactAddress({ address: "99 หมู่ 1", zipcode: "50000" })).toBe("99 หมู่ 1 50000");
    expect(composeContactAddress({})).toBe("");
  });
});

describe("bahtText — Thai amount in words", () => {
  it("whole baht → …บาทถ้วน", () => {
    expect(bahtText(0)).toBe("ศูนย์บาทถ้วน");
    expect(bahtText(1)).toBe("หนึ่งบาทถ้วน");
    expect(bahtText(21)).toBe("ยี่สิบเอ็ดบาทถ้วน");
    expect(bahtText(100)).toBe("หนึ่งร้อยบาทถ้วน");
    expect(bahtText(101)).toBe("หนึ่งร้อยเอ็ดบาทถ้วน");
    expect(bahtText(1070)).toBe("หนึ่งพันเจ็ดสิบบาทถ้วน");
    expect(bahtText(1000000)).toBe("หนึ่งล้านบาทถ้วน");
  });
  it("with satang", () => {
    expect(bahtText(1234.5)).toBe("หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์");
    expect(bahtText(25.25)).toBe("ยี่สิบห้าบาทยี่สิบห้าสตางค์");
  });
  it("sub-baht only → …สตางค์ (no ศูนย์บาท)", () => {
    expect(bahtText(0.75)).toBe("เจ็ดสิบห้าสตางค์");
  });
  it("rounds to satang half away from zero", () => {
    expect(bahtText(1.005)).toBe("หนึ่งบาทหนึ่งสตางค์");
  });
  it("negatives get a ลบ prefix", () => {
    expect(bahtText(-5)).toBe("ลบห้าบาทถ้วน");
  });
  it("readThaiInteger handles millions grouping", () => {
    expect(readThaiInteger(0)).toBe("ศูนย์");
    expect(readThaiInteger(12000000)).toBe("สิบสองล้าน");
    expect(readThaiInteger(1000001)).toBe("หนึ่งล้านหนึ่ง");
  });
});
