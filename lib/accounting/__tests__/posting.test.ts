import { describe, it, expect } from "vitest";
import { computeTotals } from "../money";
import {
  netVatFromInclusive, round2, sumSides, validateEntryLines, naturalAmount,
  summarizeTrialBalance, buildProfitAndLoss, buildBalanceSheet, parseCoaCsv,
  categoryNormal, bookMeta, type Account,
} from "../posting";

// Chart used across the statement tests.
const ACCOUNTS: Account[] = [
  { code: "11110", name_th: "เงินสด", name_en: "Cash", category: "asset" },
  { code: "11210", name_th: "ลูกหนี้", name_en: "AR", category: "asset" },
  { code: "12125", name_th: "ค่าเสื่อมสะสม", name_en: "Accum dep", category: "asset" },
  { code: "21230", name_th: "ภาษีขาย", name_en: "VAT out", category: "liability" },
  { code: "31110", name_th: "ทุน", name_en: "Capital", category: "equity" },
  { code: "41110", name_th: "รายได้ห้องพัก", name_en: "Room rev", category: "revenue" },
  { code: "52220", name_th: "ค่าไฟฟ้า", name_en: "Electricity", category: "expense" },
];

describe("netVatFromInclusive — parity with money.ts", () => {
  it("strips 7% out of 3000 exactly like computeTotals", () => {
    const got = netVatFromInclusive(3000, 7);
    const want = computeTotals({ lines: [3000], vatRate: 7, vatInclusive: true });
    expect(got.net).toBeCloseTo(2803.74, 2);
    expect(got.vat).toBeCloseTo(196.26, 2);
    expect(got.net).toBe(want.net);
    expect(got.vat).toBe(want.vat);
  });
  it("exact 1.07 multiple divides cleanly", () => {
    expect(netVatFromInclusive(10700, 7)).toEqual({ net: 10000, vat: 700 });
  });
  it("net + vat always reconstructs the gross", () => {
    for (const g of [1, 99.99, 368167.05, 4500, 1234.5]) {
      const { net, vat } = netVatFromInclusive(g, 7);
      expect(round2(net + vat)).toBe(round2(g));
    }
  });
});

describe("validateEntryLines — mirrors the DB approval guard", () => {
  it("accepts a balanced 2-line entry", () => {
    const v = validateEntryLines([{ account_code: "11110", debit: 1000 }, { account_code: "41110", credit: 1000 }]);
    expect(v.ok).toBe(true);
    expect(v.balanced).toBe(true);
    expect(v.totalDebit).toBe(1000);
    expect(v.totalCredit).toBe(1000);
  });
  it("rejects an out-of-balance entry", () => {
    const v = validateEntryLines([{ account_code: "11110", debit: 1000 }, { account_code: "41110", credit: 900 }]);
    expect(v.ok).toBe(false);
    expect(v.errors).toContain("not-balanced");
  });
  it("rejects a line with both debit and credit", () => {
    const v = validateEntryLines([{ account_code: "11110", debit: 500, credit: 500 }, { account_code: "41110", credit: 500 }]);
    expect(v.errors).toContain("line-both-sides");
  });
  it("rejects negative amounts", () => {
    const v = validateEntryLines([{ account_code: "11110", debit: -100 }, { account_code: "41110", credit: -100 }]);
    expect(v.errors).toContain("line-negative");
  });
  it("needs at least two real lines", () => {
    const v = validateEntryLines([{ account_code: "11110", debit: 100 }]);
    expect(v.errors).toContain("need-two-lines");
  });
  it("half-away-from-zero: many satang lines still balance exactly", () => {
    // 3 lines of 33.34 vs one 100.02 credit — integer-cent sum, no float drift.
    const v = validateEntryLines([
      { account_code: "11110", debit: 33.34 },
      { account_code: "11110", debit: 33.34 },
      { account_code: "11110", debit: 33.34 },
      { account_code: "41110", credit: 100.02 },
    ]);
    expect(v.balanced).toBe(true);
  });
});

describe("sumSides + naturalAmount", () => {
  it("sums integer cents without drift", () => {
    const s = sumSides([{ debit: 0.1 }, { debit: 0.2 }, { credit: 0.3 }]);
    expect(s.debit).toBe(0.3);
    expect(s.credit).toBe(0.3);
  });
  it("debit-normal vs credit-normal signs", () => {
    expect(categoryNormal("asset")).toBe("debit");
    expect(categoryNormal("revenue")).toBe("credit");
    expect(naturalAmount("asset", 1000, 200)).toBe(800); // debit-normal
    expect(naturalAmount("revenue", 200, 1000)).toBe(800); // credit-normal
    expect(naturalAmount("asset", 0, 500)).toBe(-500); // accum-dep style contra
  });
});

describe("summarizeTrialBalance", () => {
  const tb = [
    { account_code: "11110", opening: 5000, period_debit: 2000, period_credit: 500 },
    { account_code: "41110", opening: 0, period_debit: 0, period_credit: 3210 },
    { account_code: "21230", opening: 0, period_debit: 0, period_credit: 0 }, // dropped (no activity)
  ];
  it("computes signed closing and drops empty accounts", () => {
    const { rows } = summarizeTrialBalance(tb, ACCOUNTS);
    expect(rows.map((r) => r.code)).toEqual(["11110", "41110"]);
    const cash = rows.find((r) => r.code === "11110")!;
    expect(cash.closing).toBe(6500); // 5000 + 2000 − 500
    const rev = rows.find((r) => r.code === "41110")!;
    expect(rev.closing).toBe(-3210); // credit-side balance is negative signed
  });
  it("period debit total equals period credit total for balanced books", () => {
    const balanced = [
      { account_code: "11110", opening: 0, period_debit: 3210, period_credit: 0 },
      { account_code: "41110", opening: 0, period_debit: 0, period_credit: 3000 },
      { account_code: "21230", opening: 0, period_debit: 0, period_credit: 210 },
    ];
    const { totals } = summarizeTrialBalance(balanced, ACCOUNTS);
    expect(totals.debit).toBe(totals.credit);
    expect(totals.debit).toBe(3210);
  });
});

describe("buildProfitAndLoss", () => {
  const month = [
    { account_code: "41110", period_debit: 0, period_credit: 3000 },
    { account_code: "52220", period_debit: 800, period_credit: 0 },
  ];
  const ytd = [
    { account_code: "41110", period_debit: 0, period_credit: 12000 },
    { account_code: "52220", period_debit: 3200, period_credit: 0 },
  ];
  it("nets revenue minus expense for month and ytd", () => {
    const pl = buildProfitAndLoss(month, ytd, ACCOUNTS);
    expect(pl.totalRevenueMonth).toBe(3000);
    expect(pl.totalExpenseMonth).toBe(800);
    expect(pl.netProfitMonth).toBe(2200);
    expect(pl.totalRevenueYtd).toBe(12000);
    expect(pl.netProfitYtd).toBe(8800);
    expect(pl.revenue).toHaveLength(1);
    expect(pl.expense).toHaveLength(1);
  });
});

describe("buildBalanceSheet", () => {
  it("balances: assets = liabilities + equity + net profit", () => {
    // Cash 10000 (Dr), AR 3210 (Dr) ; VAT payable 210 (Cr), Capital 10000 (Cr) ;
    // Revenue 3000 (Cr). Net profit = 3000. 13210 = 210+10000+3000.
    const asof = [
      { account_code: "11110", period_debit: 10000, period_credit: 0 },
      { account_code: "11210", period_debit: 3210, period_credit: 0 },
      { account_code: "21230", period_debit: 0, period_credit: 210 },
      { account_code: "31110", period_debit: 0, period_credit: 10000 },
      { account_code: "41110", period_debit: 0, period_credit: 3000 },
    ];
    const bs = buildBalanceSheet(asof, ACCOUNTS);
    expect(bs.totalAssets).toBe(13210);
    expect(bs.netProfit).toBe(3000);
    expect(bs.totalLiabilitiesAndEquity).toBe(13210);
    expect(bs.balanced).toBe(true);
    expect(bs.difference).toBe(0);
  });
  it("accumulated depreciation (asset-category contra) reduces total assets", () => {
    const asof = [
      { account_code: "11110", period_debit: 10000, period_credit: 0 },
      { account_code: "12125", period_debit: 0, period_credit: 1500 }, // contra asset
      { account_code: "31110", period_debit: 0, period_credit: 8500 },
    ];
    const bs = buildBalanceSheet(asof, ACCOUNTS);
    expect(bs.totalAssets).toBe(8500); // 10000 − 1500
    expect(bs.balanced).toBe(true);
  });
});

describe("parseCoaCsv", () => {
  it("parses a header + rows, infers category from leading digit", () => {
    const csv = "code,name,name_en,category\n61000,ค่าใช้จ่ายพิเศษ,Special,expense\n13000,ลูกหนี้พิเศษ,Special AR,";
    const { rows, errors } = parseCoaCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ code: "61000", category: "expense", is_system: false });
    expect(rows[1].category).toBe("asset"); // inferred from leading '1'
  });
  it("handles quoted commas", () => {
    const csv = 'code,name\n"61001","Fees, misc"';
    const { rows } = parseCoaCsv(csv);
    expect(rows[0].name_th).toBe("Fees, misc");
  });
  it("empty input yields an error", () => {
    expect(parseCoaCsv("").errors).toContain("empty");
  });
});

describe("bookMeta", () => {
  it("maps books to prefixes", () => {
    expect(bookMeta("purchase").prefix).toBe("PUV");
    expect(bookMeta("receipt").prefix).toBe("RV");
    expect(bookMeta("unknown").prefix).toBe("");
  });
});
