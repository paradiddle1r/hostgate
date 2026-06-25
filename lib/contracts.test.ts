import { describe, it, expect } from "vitest";
import { buildContractBody, ContractTerms } from "./contracts";

const sample: ContractTerms = {
  landlordName: "Alice Owner",
  tenantName: "Bob Tenant",
  propertyName: "Seaside Villa",
  roomNumber: "101",
  monthlyRent: 8000,
  deposit: 16000,
  startDate: "2026-07-01",
  endDate: "2026-12-31",
  currency: "THB",
};

describe("buildContractBody", () => {
  it("returns an object with both th and en string bodies", () => {
    const result = buildContractBody(sample);
    expect(typeof result.th).toBe("string");
    expect(typeof result.en).toBe("string");
    expect(result.th.length).toBeGreaterThan(0);
    expect(result.en.length).toBeGreaterThan(0);
  });

  it("embeds landlordName, tenantName, propertyName, and roomNumber in both bodies", () => {
    const result = buildContractBody(sample);
    for (const body of [result.th, result.en]) {
      expect(body).toContain(sample.landlordName);
      expect(body).toContain(sample.tenantName);
      expect(body).toContain(sample.propertyName);
      expect(body).toContain(sample.roomNumber);
    }
  });

  it("embeds formatted money values for monthlyRent and deposit in both bodies", () => {
    const result = buildContractBody(sample);
    const rentStr = `${sample.currency} ${sample.monthlyRent.toLocaleString()}`;
    const depositStr = `${sample.currency} ${sample.deposit.toLocaleString()}`;
    for (const body of [result.th, result.en]) {
      expect(body).toContain(rentStr);
      expect(body).toContain(depositStr);
    }
  });

  it('shows "ไม่กำหนด / open-ended" when endDate is an empty string', () => {
    const result = buildContractBody({ ...sample, endDate: "" });
    expect(result.th).toContain("ไม่กำหนด / open-ended");
    expect(result.en).toContain("ไม่กำหนด / open-ended");
  });

  it('shows "ไม่กำหนด / open-ended" when endDate is exactly 2099-01-01', () => {
    const result = buildContractBody({ ...sample, endDate: "2099-01-01" });
    expect(result.th).toContain("ไม่กำหนด / open-ended");
    expect(result.en).toContain("ไม่กำหนด / open-ended");
  });

  it('shows "ไม่กำหนด / open-ended" when endDate is beyond 2099-01-01', () => {
    const result = buildContractBody({ ...sample, endDate: "2150-06-01" });
    expect(result.th).toContain("ไม่กำหนด / open-ended");
    expect(result.en).toContain("ไม่กำหนด / open-ended");
  });

  it("shows the actual endDate and not the open-ended label when endDate is a normal date", () => {
    const result = buildContractBody(sample); // endDate: '2026-12-31'
    expect(result.th).toContain("2026-12-31");
    expect(result.en).toContain("2026-12-31");
    expect(result.th).not.toContain("ไม่กำหนด / open-ended");
    expect(result.en).not.toContain("ไม่กำหนด / open-ended");
  });
});
