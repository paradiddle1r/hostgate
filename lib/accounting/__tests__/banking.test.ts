import { describe, it, expect } from "vitest";
import {
  parseStatementCsv, parseThaiDate, parseAmount, dayDiff,
  suggestMatches, paymentCandidate, expenseCandidate,
} from "../banking";

// ── parseThaiDate / parseAmount ──────────────────────────────────────────────
describe("parseThaiDate", () => {
  it("parses ISO YYYY-MM-DD", () => {
    expect(parseThaiDate("2026-01-15")).toBe("2026-01-15");
  });
  it("parses DD/MM/YYYY", () => {
    expect(parseThaiDate("15/01/2026")).toBe("2026-01-15");
  });
  it("parses DD.MM.YYYY and DD-MM-YYYY", () => {
    expect(parseThaiDate("05.02.2026")).toBe("2026-02-05");
    expect(parseThaiDate("05-02-2026")).toBe("2026-02-05");
  });
  it("converts Buddhist-era (>2400) years back 543", () => {
    expect(parseThaiDate("15/01/2569")).toBe("2026-01-15");
    expect(parseThaiDate("2569-01-15")).toBe("2026-01-15");
  });
  it("returns null on junk", () => {
    expect(parseThaiDate("opening balance")).toBeNull();
    expect(parseThaiDate("")).toBeNull();
  });
});

describe("parseAmount", () => {
  it("strips thousands separators", () => {
    expect(parseAmount("1,234.50")).toBe(1234.5);
    expect(parseAmount("1,070.00")).toBe(1070);
  });
  it("handles leading minus and parentheses as negative", () => {
    expect(parseAmount("-535.00")).toBe(-535);
    expect(parseAmount("(535.00)")).toBe(-535);
  });
  it("strips currency symbols", () => {
    expect(parseAmount("฿1,000.00")).toBe(1000);
  });
  it("returns null for empty / dash cells", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("-")).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

// ── parseStatementCsv — both layouts + BE + commas ───────────────────────────
describe("parseStatementCsv — single signed amount column", () => {
  const csv = [
    "Date,Description,Amount,Balance",
    '15/01/2026,Room payment,"1,070.00","10,000.00"',
    '16/01/2026,Supplier ABC,"-535.00","9,465.00"',
    "Total,,,",
  ].join("\n");
  it("parses signed amounts, commas and dates", () => {
    const { rows, layout } = parseStatementCsv(csv);
    expect(layout).toBe("amount");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ txn_date: "2026-01-15", amount: 1070, balance: 10000, description: "Room payment" });
    expect(rows[1]).toMatchObject({ txn_date: "2026-01-16", amount: -535, balance: 9465 });
  });
});

describe("parseStatementCsv — separate debit / credit columns", () => {
  const csv = [
    "Date,Description,Debit,Credit,Balance",
    "2026-01-15,Deposit from guest,,1070.00,10000.00",
    "2026-01-16,Payment to vendor,535.00,,9465.00",
  ].join("\n");
  it("credit → +, debit → −", () => {
    const { rows, layout } = parseStatementCsv(csv);
    expect(layout).toBe("debit-credit");
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(1070);
    expect(rows[1].amount).toBe(-535);
  });
});

describe("parseStatementCsv — Buddhist-era dates", () => {
  const csv = [
    "Date,Description,Amount",
    "15/01/2569,ค่าห้อง,1070.00",
    "16/01/2569,ซื้อของ,-200.00",
  ].join("\n");
  it("shifts BE years to Gregorian", () => {
    const { rows } = parseStatementCsv(csv);
    expect(rows[0].txn_date).toBe("2026-01-15");
    expect(rows[1].txn_date).toBe("2026-01-16");
  });
});

// ── suggestMatches — exact, window, no double-match ──────────────────────────
describe("suggestMatches", () => {
  it("matches an exact amount + same day", () => {
    const lines = [{ id: 1, txn_date: "2026-01-15", amount: 1070, status: "unmatched" }];
    const cands = [paymentCandidate({ id: 10, amount: 1070, paid_at: "2026-01-15T09:00:00Z", invoice_id: 5 })];
    const m = suggestMatches(lines, cands);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ lineId: 1, dayDiff: 0 });
    expect(m[0].candidate).toMatchObject({ id: 10, type: "payment" });
  });

  it("matches within ±windowDays but not beyond", () => {
    const cands = [paymentCandidate({ id: 10, amount: 1070, paid_at: "2026-01-13T00:00:00Z", invoice_id: 5 })];
    const near = suggestMatches([{ id: 1, txn_date: "2026-01-15", amount: 1070 }], cands);
    expect(near).toHaveLength(1); // 2 days apart
    const far = suggestMatches([{ id: 2, txn_date: "2026-01-20", amount: 1070 }], cands);
    expect(far).toHaveLength(0); // 7 days apart
  });

  it("matches a paid expense (money out, negative)", () => {
    const lines = [{ id: 3, txn_date: "2026-02-01", amount: -1040 }];
    const cands = [expenseCandidate({ id: 77, total: 1070, wht_amount: 30, paid_at: "2026-02-01T00:00:00Z" })];
    const m = suggestMatches(lines, cands);
    expect(m).toHaveLength(1);
    expect(m[0].candidate).toMatchObject({ id: 77, type: "expense", amount: -1040 });
    expect(m[0].sameSign).toBe(true);
  });

  it("never suggests the same candidate to two lines (no double-match)", () => {
    const lines = [
      { id: 1, txn_date: "2026-01-15", amount: 1070 },
      { id: 2, txn_date: "2026-01-16", amount: 1070 },
    ];
    const cands = [
      paymentCandidate({ id: 10, amount: 1070, paid_at: "2026-01-15T00:00:00Z", invoice_id: 1 }),
      paymentCandidate({ id: 11, amount: 1070, paid_at: "2026-01-16T00:00:00Z", invoice_id: 2 }),
    ];
    const m = suggestMatches(lines, cands);
    expect(m).toHaveLength(2);
    const ids = m.map((x) => x.candidate.id).sort();
    expect(ids).toEqual([10, 11]); // distinct candidates
    expect(m.find((x) => x.lineId === 1)!.candidate.id).toBe(10);
    expect(m.find((x) => x.lineId === 2)!.candidate.id).toBe(11);
  });

  it("leaves a line unmatched when no candidate is close enough", () => {
    const m = suggestMatches(
      [{ id: 1, txn_date: "2026-01-15", amount: 999 }],
      [paymentCandidate({ id: 10, amount: 1070, paid_at: "2026-01-15T00:00:00Z", invoice_id: 1 })],
    );
    expect(m).toHaveLength(0);
  });
});

describe("dayDiff", () => {
  it("computes signed whole-day differences", () => {
    expect(dayDiff("2026-01-15", "2026-01-13")).toBe(2);
    expect(dayDiff("2026-01-13", "2026-01-15")).toBe(-2);
    expect(dayDiff("2026-01-15", "2026-01-15")).toBe(0);
  });
});
