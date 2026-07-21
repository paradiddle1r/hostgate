import { describe, it, expect } from "vitest";
import {
  docPrefix, docTypeMeta, docStatusMeta,
  mapDocItemsToInvoiceItems, mapDocItemsToDocItems,
  buildInvoiceFromDocumentPayload, applyableInvoicePatch,
  creditDebitPrefill, cloneDocumentHeader, pickHeaderColumns,
  dueDateFrom, newDocumentDraft,
} from "../documents";
import { computeTotals } from "../money";

// The prefixes here MUST match sales_document_prefix() (migration 21) — the app
// and DB share one numbering convention. If these drift, gapless numbering breaks.
describe("docPrefix — matches the DB sales_document_prefix()", () => {
  it("maps every doc_type to its RD-style prefix", () => {
    expect(docPrefix("quotation")).toBe("QT");
    expect(docPrefix("billing-note")).toBe("BN");
    expect(docPrefix("cash-sale")).toBe("CS");
    expect(docPrefix("credit-note")).toBe("CN");
    expect(docPrefix("debit-note")).toBe("DN");
  });
  it("falls back to the first type for an unknown value", () => {
    expect(docTypeMeta("nope").type).toBe("quotation");
  });
});

describe("docStatusMeta", () => {
  it("returns bilingual + hue for a known status", () => {
    const m = docStatusMeta("approved");
    expect(m.en).toBe("Approved");
    expect(m.th).toBe("อนุมัติแล้ว");
    expect(m.color).toMatch(/^#/);
  });
  it("falls back to draft for an unknown status", () => {
    expect(docStatusMeta("???").v).toBe("draft");
  });
});

describe("mapDocItemsToInvoiceItems", () => {
  it("strips to the invoice_items insert shape and coerces numbers", () => {
    const out = mapDocItemsToInvoiceItems([
      { description: "Room", qty: "3", unit_price: "1000", unit: "night", extra: "x" },
      { description: "Discount", qty: 1, unit_price: -500, is_discount: true },
    ]);
    expect(out).toEqual([
      { sort_order: 0, description: "Room", qty: 3, unit_price: 1000, is_discount: false },
      { sort_order: 1, description: "Discount", qty: 1, unit_price: -500, is_discount: true },
    ]);
  });
  it("defaults missing / non-numeric qty & price to 0", () => {
    const out = mapDocItemsToInvoiceItems([{ description: "x" }]);
    expect(out[0]).toMatchObject({ qty: 0, unit_price: 0 });
  });
});

describe("mapDocItemsToDocItems keeps the unit column", () => {
  it("retains unit but drops unknown keys", () => {
    const out = mapDocItemsToDocItems([{ description: "Room", qty: 2, unit_price: 900, unit: "night", junk: 1 }]);
    expect(out[0]).toEqual({ sort_order: 0, description: "Room", unit: "night", qty: 2, unit_price: 900, is_discount: false });
  });
  it("empty unit → null", () => {
    expect(mapDocItemsToDocItems([{ description: "a", unit: "" }])[0].unit).toBe(null);
  });
});

describe("buildInvoiceFromDocumentPayload — mapping to the invoice core + patch", () => {
  const doc = {
    id: 7,
    booking_id: 42,
    customer_name: "Somchai",
    customer_company_name: "Acme Co., Ltd.",
    customer_company_name_th: "บริษัท แอคมี จำกัด",
    customer_branch: "สำนักงานใหญ่",
    customer_tax_id: "0105551234567",
    customer_address: "1 Main Rd",
    customer_address_th: "1 ถนนหลัก",
    customer_phone: "021234567",
    customer_email: "a@acme.co",
    contact_id: 3,
    vat_rate: 7,
    vat_inclusive: true,
    discount: 200,
    due_date: "2026-08-01",
    notes: "thanks",
  };
  const items = [{ description: "Room", qty: 3, unit_price: 1000 }];

  it("core carries the fields createInvoiceCore supports", () => {
    const { core } = buildInvoiceFromDocumentPayload(doc, items);
    expect(core.booking_id).toBe(42);
    expect(core.guest_name).toBe("Somchai");
    expect(core.guest_tax_id).toBe("0105551234567");
    expect(core.guest_address).toBe("1 Main Rd");
    expect(core.guest_phone).toBe("021234567");
    expect(core.guest_email).toBe("a@acme.co");
    expect(core.due_date).toBe("2026-08-01");
    expect(core.vat_rate).toBe(7);
    expect(core.vat_inclusive).toBe(true);
    expect(core.items).toHaveLength(1);
    // discount / corporate fields are NOT on the core (core can't set them)
    expect((core as Record<string, unknown>).discount).toBeUndefined();
    expect((core as Record<string, unknown>).guest_company_name).toBeUndefined();
  });

  it("patch carries what the core cannot set", () => {
    const { patch } = buildInvoiceFromDocumentPayload(doc, items);
    expect(patch).toEqual({
      contact_id: 3,
      guest_company_name: "Acme Co., Ltd.",
      guest_company_name_th: "บริษัท แอคมี จำกัด",
      guest_branch: "สำนักงานใหญ่",
      guest_address_th: "1 ถนนหลัก",
      discount: 200,
    });
  });

  it("guest_name falls back to the company name when the contact name is blank", () => {
    const { core } = buildInvoiceFromDocumentPayload({ customer_company_name: "Acme" }, []);
    expect(core.guest_name).toBe("Acme");
  });

  it('guest_name falls back to "Customer" when nothing is set', () => {
    const { core } = buildInvoiceFromDocumentPayload({}, []);
    expect(core.guest_name).toBe("Customer");
  });
});

describe("applyableInvoicePatch — prunes no-op fields", () => {
  it("drops nulls and a zero discount", () => {
    const out = applyableInvoicePatch({
      contact_id: null, guest_company_name: null, guest_branch: "", discount: 0,
    });
    expect(out).toEqual({});
  });
  it("keeps real values and a non-zero discount", () => {
    const out = applyableInvoicePatch({
      contact_id: 5, guest_company_name: "X", guest_branch: null, discount: 150,
    });
    expect(out).toEqual({ contact_id: 5, guest_company_name: "X", discount: 150 });
  });
});

describe("conversion parity — the invoice total equals the document total", () => {
  const cases = [
    { vat_rate: 7, vat_inclusive: true, discount: 200, items: [{ qty: 3, unit_price: 1000 }] },
    { vat_rate: 7, vat_inclusive: false, discount: 0, items: [{ qty: 2, unit_price: 1234.5 }, { qty: 1, unit_price: -500, is_discount: true }] },
    { vat_rate: 0, vat_inclusive: false, discount: 0, items: [{ qty: 1, unit_price: 4500 }] },
  ];
  it("same inputs → same totals through the mapping", () => {
    for (const c of cases) {
      const doc = { ...c };
      const docTotals = computeTotals({ lines: c.items, discount: c.discount, vatRate: c.vat_rate, vatInclusive: c.vat_inclusive });
      const { core, patch } = buildInvoiceFromDocumentPayload(doc, c.items);
      const invTotals = computeTotals({
        lines: core.items,
        discount: patch.discount, // discount is applied via the patch
        vatRate: core.vat_rate,
        vatInclusive: core.vat_inclusive,
      });
      expect(invTotals.total).toBeCloseTo(docTotals.total, 2);
      expect(invTotals.vat).toBeCloseTo(docTotals.vat, 2);
      expect(invTotals.subtotal).toBeCloseTo(docTotals.subtotal, 2);
    }
  });
});

describe("creditDebitPrefill", () => {
  const invoice = {
    id: 99, contact_id: 4, booking_id: 12,
    guest_name: "Jane", guest_company_name: "BigCorp", guest_tax_id: "0100000000001",
    guest_address: "HQ", currency: "THB", vat_rate: 7, vat_inclusive: true, discount: 0,
  };
  const invItems = [{ description: "Room 301 · 2 nights", qty: 2, unit_price: 1500 }];

  it("references the invoice and copies the bill-to + items (positive amounts)", () => {
    const cn = creditDebitPrefill(invoice, invItems, "credit-note");
    expect(cn.doc_type).toBe("credit-note");
    expect(cn.ref_invoice_id).toBe(99);
    expect(cn.customer_company_name).toBe("BigCorp");
    expect(cn.vat_inclusive).toBe(true);
    expect(cn.items[0]).toMatchObject({ description: "Room 301 · 2 nights", qty: 2, unit_price: 1500 });
    // Amounts stay positive — the sign lives in the doc_type, not the numbers.
    expect(cn.items[0].unit_price).toBeGreaterThan(0);
  });
  it("supports debit notes too", () => {
    expect(creditDebitPrefill(invoice, invItems, "debit-note").doc_type).toBe("debit-note");
  });
});

describe("cloneDocumentHeader / pickHeaderColumns", () => {
  it("clone keeps bill-to + pricing, coerces numbers", () => {
    const h = cloneDocumentHeader({ customer_name: "A", vat_rate: "7", discount: "50", credit_days: "30", junk: 1 });
    expect(h.customer_name).toBe("A");
    expect(h.vat_rate).toBe(7);
    expect(h.discount).toBe(50);
    expect(h.credit_days).toBe(30);
    expect((h as Record<string, unknown>).junk).toBeUndefined();
  });
  it("pickHeaderColumns drops non-column keys", () => {
    const row = pickHeaderColumns({ doc_type: "quotation", total: 999, id: 5, notes: "x" });
    expect(row).toEqual({ doc_type: "quotation", notes: "x" });
  });
});

describe("dueDateFrom", () => {
  it("adds credit days to the issue date", () => {
    expect(dueDateFrom("2026-07-21", 30)).toBe("2026-08-20");
  });
  it("zero / missing credit days → no due date", () => {
    expect(dueDateFrom("2026-07-21", 0)).toBe(null);
    expect(dueDateFrom("", 30)).toBe(null);
  });
});

describe("newDocumentDraft", () => {
  it("inherits the company VAT defaults", () => {
    const d = newDocumentDraft("quotation", { settings: { vat_rate: 7, vat_inclusive: true, currency: "THB" } });
    expect(d.doc_type).toBe("quotation");
    expect(d.status).toBe("draft");
    expect(d.vat_inclusive).toBe(true);
    expect(d.vat_rate).toBe(7);
    expect(d.currency).toBe("THB");
  });
  it("seeds the bill-to from a company contact", () => {
    const d = newDocumentDraft("billing-note", {
      settings: { vat_inclusive: true },
      contact: { id: 8, is_company: true, name: "บริษัท ก", name_en: "Kor Co", tax_id: "0105500000001", branch: "สำนักงานใหญ่", credit_days: 15 },
    });
    expect(d.contact_id).toBe(8);
    expect(d.customer_company_name).toBe("Kor Co");
    expect(d.customer_company_name_th).toBe("บริษัท ก");
    expect(d.customer_tax_id).toBe("0105500000001");
    expect(d.credit_days).toBe(15);
  });
});
