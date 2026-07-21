import { describe, it, expect } from "vitest";
import {
  monthLabel, formatBEDate, summarizeReport, computePhoPho30, pho30FromReports,
  buildSalesReportCsv, buildPurchaseReportCsv, SALES_CSV_HEADERS, PURCHASE_CSV_HEADERS, round2,
} from "../vat";

// ── Buddhist-era dates & month labels ────────────────────────────────────────
describe("formatBEDate", () => {
  it("converts yyyy-mm-dd to DD/MM/YYYY with Buddhist-era year", () => {
    expect(formatBEDate("2026-07-15")).toBe("15/07/2569");
    expect(formatBEDate("2026-01-01")).toBe("01/01/2569");
  });
  it("slices a timestamp down to the date part", () => {
    expect(formatBEDate("2026-12-31T10:20:00+07:00")).toBe("31/12/2569");
  });
  it("returns empty string for null / undefined", () => {
    expect(formatBEDate(null)).toBe("");
    expect(formatBEDate(undefined)).toBe("");
  });
});

describe("monthLabel", () => {
  it("Thai uses month name + Buddhist-era year", () => {
    expect(monthLabel(2026, 7, "th")).toBe("กรกฎาคม 2569");
  });
  it("English uses month name + Gregorian year", () => {
    expect(monthLabel(2026, 7, "en")).toBe("July 2026");
  });
  it("rejects out-of-range months", () => {
    expect(monthLabel(2026, 0, "th")).toBe("");
    expect(monthLabel(2026, 13, "th")).toBe("");
  });
});

// ── summariser (credit-note negatives) ───────────────────────────────────────
describe("summarizeReport", () => {
  it("sums net + vat and counts rows", () => {
    const rows = [
      { net_amount: 587.91, vat_amount: 41.15 },
      { net_amount: 1175.79, vat_amount: 82.31 },
    ];
    const s = summarizeReport(rows);
    expect(s.count).toBe(2);
    expect(s.net).toBeCloseTo(1763.7, 2);
    expect(s.vat).toBeCloseTo(123.46, 2);
  });
  it("honours NEGATIVE credit-note rows (they reduce the totals)", () => {
    const rows = [
      { net_amount: 1000, vat_amount: 70, doc_kind: "invoice" },
      { net_amount: -200, vat_amount: -14, doc_kind: "credit-note" },
      { net_amount: 500, vat_amount: 35, doc_kind: "debit-note" },
    ];
    const s = summarizeReport(rows);
    expect(s.net).toBeCloseTo(1300, 2);
    expect(s.vat).toBeCloseTo(91, 2);
  });
  it("accepts numeric strings from PostgREST without float drift", () => {
    const rows = [{ net_amount: "0.10", vat_amount: "0.01" }, { net_amount: "0.20", vat_amount: "0.02" }];
    const s = summarizeReport(rows);
    expect(s.net).toBeCloseTo(0.3, 2);
    expect(s.vat).toBeCloseTo(0.03, 2);
  });
  it("empty input → zeros", () => {
    const s = summarizeReport([]);
    expect(s).toEqual({ count: 0, net: 0, vat: 0 });
  });
});

// ── ภ.พ.30 (PP30) summary math ───────────────────────────────────────────────
describe("computePhoPho30", () => {
  it("output > input → VAT payable, no credit carry", () => {
    const r = computePhoPho30({ salesTotal: 71995.19, outputVat: 5039.58, purchaseTotal: 10000, inputVat: 700 });
    expect(r.vatPayable).toBeCloseTo(4339.58, 2);
    expect(r.vatCreditCarry).toBe(0);
  });
  it("input > output → credit carried forward, nothing payable", () => {
    const r = computePhoPho30({ salesTotal: 1000, outputVat: 70, purchaseTotal: 5000, inputVat: 350 });
    expect(r.vatPayable).toBe(0);
    expect(r.vatCreditCarry).toBeCloseTo(280, 2);
  });
  it("output == input → both zero", () => {
    const r = computePhoPho30({ outputVat: 100, inputVat: 100 });
    expect(r.vatPayable).toBe(0);
    expect(r.vatCreditCarry).toBe(0);
  });
  it("no purchases (live July case) → payable equals output VAT", () => {
    const r = computePhoPho30({ salesTotal: 71995.19, outputVat: 5039.58, purchaseTotal: 0, inputVat: 0 });
    expect(r.salesTotal).toBeCloseTo(71995.19, 2);
    expect(r.outputVat).toBeCloseTo(5039.58, 2);
    expect(r.vatPayable).toBeCloseTo(5039.58, 2);
    expect(r.vatCreditCarry).toBe(0);
  });
  it("defaults everything to zero", () => {
    expect(computePhoPho30()).toEqual({ salesTotal: 0, outputVat: 0, purchaseTotal: 0, inputVat: 0, vatPayable: 0, vatCreditCarry: 0 });
  });
});

describe("pho30FromReports", () => {
  it("derives the summary from raw report rows incl. a credit-note", () => {
    const sales = [
      { net_amount: 1000, vat_amount: 70 },
      { net_amount: -300, vat_amount: -21 }, // credit-note
    ];
    const purchase = [{ net_amount: 400, vat_amount: 28 }];
    const r = pho30FromReports(sales, purchase);
    expect(r.salesTotal).toBeCloseTo(700, 2);
    expect(r.outputVat).toBeCloseTo(49, 2);
    expect(r.inputVat).toBeCloseTo(28, 2);
    expect(r.vatPayable).toBeCloseTo(21, 2);
  });
});

// ── CSV builders (RD layout, Thai headers, BE dates) ─────────────────────────
describe("buildSalesReportCsv", () => {
  const rows = [
    { seq: 1, doc_date: "2026-07-01", doc_number: "INV-2026-00496", customer_name: "น.ส. โสภาพรรณ วรวิทย์ขจร", tax_id: null, branch: null, net_amount: 587.91, vat_amount: 41.15 },
    { seq: 2, doc_date: "2026-07-02", doc_number: "INV-2026-00498", customer_name: "บริษัท เอส.ดี. จำกัด", tax_id: "0105512345678", branch: "สำนักงานใหญ่", net_amount: 1175.79, vat_amount: 82.31 },
  ];
  const csv = buildSalesReportCsv(rows);
  const lines = csv.split("\r\n");

  it("first line is the RD Thai sales header", () => {
    expect(lines[0]).toBe(SALES_CSV_HEADERS.join(","));
  });
  it("data rows use BE dates and 2dp amounts", () => {
    expect(lines[1]).toContain("01/07/2569");
    expect(lines[1]).toContain("INV-2026-00496");
    expect(lines[1].endsWith("587.91,41.15")).toBe(true);
  });
  it("blank tax_id / branch render as empty cells (legal for B2C)", () => {
    const cells = lines[1].split(",");
    expect(cells[cells.length - 4]).toBe(""); // tax_id
    expect(cells[cells.length - 3]).toBe(""); // branch
  });
  it("last line is the total row (รวม) with summed net + vat", () => {
    const last = lines[lines.length - 1];
    expect(last.startsWith("รวม")).toBe(true);
    expect(last.endsWith("1763.70,123.46")).toBe(true);
  });
});

describe("buildPurchaseReportCsv", () => {
  it("uses the purchase header, doc_ref, vendor_name and a negative-safe total", () => {
    const rows = [
      { seq: 1, doc_date: "2026-07-05", doc_ref: "BILL-88", vendor_name: "ร้านค้าวัสดุ", tax_id: "0994000123456", branch: "สำนักงานใหญ่", net_amount: 1000, vat_amount: 70 },
    ];
    const csv = buildPurchaseReportCsv(rows);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(PURCHASE_CSV_HEADERS.join(","));
    expect(lines[1]).toContain("05/07/2569");
    expect(lines[1]).toContain("BILL-88");
    expect(lines[1]).toContain("ร้านค้าวัสดุ");
    expect(lines[lines.length - 1]).toBe("รวม,,,,,,1000.00,70.00");
  });
  it("quotes cells that contain a comma", () => {
    const rows = [{ seq: 1, doc_date: "2026-07-05", doc_ref: "A,B", vendor_name: "X", tax_id: "", branch: "", net_amount: 1, vat_amount: 0.07 }];
    const csv = buildPurchaseReportCsv(rows);
    expect(csv).toContain('"A,B"');
  });
});

describe("round2", () => {
  it("rounds half away from zero (matches DB round())", () => {
    expect(round2(0.005)).toBeCloseTo(0.01, 2);
    expect(round2(-0.005)).toBeCloseTo(-0.01, 2);
  });
});
