import { describe, it, expect } from "vitest";
import type { Booking } from "@/lib/db/bookings";
import {
  neutralize,
  csvField,
  htmlEscape,
  nights,
  cellValue,
  rowValues,
} from "./bookings-export";

// ---------------------------------------------------------------------------
// neutralize
// ---------------------------------------------------------------------------
describe("neutralize", () => {
  it("prefixes a single quote when cell starts with =", () => {
    expect(neutralize("=SUM(A1)")).toBe("'=SUM(A1)");
  });
  it("prefixes a single quote when cell starts with +", () => {
    expect(neutralize("+1")).toBe("'+1");
  });
  it("prefixes a single quote when cell starts with -", () => {
    expect(neutralize("-5")).toBe("'-5");
  });
  it("prefixes a single quote when cell starts with @", () => {
    expect(neutralize("@user")).toBe("'@user");
  });
  it("prefixes a single quote for a leading tab", () => {
    expect(neutralize("\tcell")).toBe("'\tcell");
  });
  it("prefixes a single quote for a leading CR", () => {
    expect(neutralize("\rcell")).toBe("'\rcell");
  });
  it("leaves normal text untouched", () => {
    expect(neutralize("hello")).toBe("hello");
    expect(neutralize("10.50")).toBe("10.50");
    expect(neutralize("Confirmed")).toBe("Confirmed");
  });
  it("leaves empty string untouched", () => {
    expect(neutralize("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// csvField
// ---------------------------------------------------------------------------
describe("csvField", () => {
  it("wraps a plain value in double quotes", () => {
    expect(csvField("hello")).toBe('"hello"');
  });
  it("doubles internal double-quotes (RFC-4180)", () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });
  it("applies neutralize before quoting (formula injection guard)", () => {
    expect(csvField("=formula")).toBe('"\'=formula"');
  });
  it("handles empty string", () => {
    expect(csvField("")).toBe('""');
  });
});

// ---------------------------------------------------------------------------
// htmlEscape
// ---------------------------------------------------------------------------
describe("htmlEscape", () => {
  it("escapes &", () => {
    expect(htmlEscape("a & b")).toBe("a &amp; b");
  });
  it("escapes <", () => {
    expect(htmlEscape("<tag")).toBe("&lt;tag");
  });
  it("escapes >", () => {
    expect(htmlEscape("x > y")).toBe("x &gt; y");
  });
  it("escapes all three in one string", () => {
    expect(htmlEscape("<a & b>")).toBe("&lt;a &amp; b&gt;");
  });
  it("applies neutralize before escaping", () => {
    expect(htmlEscape("=<script>")).toBe("'=&lt;script&gt;");
  });
  it("leaves normal text untouched", () => {
    expect(htmlEscape("hello")).toBe("hello");
  });
});

// ---------------------------------------------------------------------------
// nights
// ---------------------------------------------------------------------------
describe("nights", () => {
  it("returns the whole-day UTC diff for a normal stay", () => {
    expect(nights("2026-06-01", "2026-06-04")).toBe(3);
  });
  it("returns 1 for a one-night stay", () => {
    expect(nights("2026-01-01", "2026-01-02")).toBe(1);
  });
  it("returns 0 when check-in equals check-out", () => {
    expect(nights("2026-06-01", "2026-06-01")).toBe(0);
  });
  it("returns 0 for invalid check-in date", () => {
    expect(nights("not-a-date", "2026-06-04")).toBe(0);
  });
  it("returns 0 for invalid check-out date", () => {
    expect(nights("2026-06-01", "bad")).toBe(0);
  });
  it("returns 0 when check-out is before check-in (negative diff)", () => {
    expect(nights("2026-06-04", "2026-06-01")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// cellValue
// ---------------------------------------------------------------------------
describe("cellValue", () => {
  it("resolves 'room' to the number from roomNumberById", () => {
    const b = { room_id: "r1" } as unknown as Booking;
    expect(cellValue(b, "room", { r1: "101" })).toBe("101");
  });
  it("returns '—' when room_id is present but not in the map", () => {
    const b = { room_id: "r99" } as unknown as Booking;
    expect(cellValue(b, "room", {})).toBe("—");
  });
  it("returns '—' when room_id is null", () => {
    const b = { room_id: null } as unknown as Booking;
    expect(cellValue(b, "room", {})).toBe("—");
  });
  it("returns nights as a stringified number", () => {
    const b = { check_in: "2026-06-01", check_out: "2026-06-04" } as unknown as Booking;
    expect(cellValue(b, "nights", {})).toBe("3");
  });
  it("returns outstanding = total_amount − amount_paid", () => {
    const b = { total_amount: 3000, amount_paid: 1000 } as unknown as Booking;
    expect(cellValue(b, "outstanding", {})).toBe("2000");
  });
  it("returns '0' when amount_paid >= total_amount (clamps at 0)", () => {
    const b = { total_amount: 3000, amount_paid: 3500 } as unknown as Booking;
    expect(cellValue(b, "outstanding", {})).toBe("0");
  });
  it("returns '' when total_amount is null", () => {
    const b = { total_amount: null, amount_paid: 0 } as unknown as Booking;
    expect(cellValue(b, "outstanding", {})).toBe("");
  });
});

// ---------------------------------------------------------------------------
// rowValues — spot-check the three derived columns
// ---------------------------------------------------------------------------
describe("rowValues", () => {
  // COLUMNS order (0-based): reservation_no=0, code=1, ota=2, source=3,
  // booking_type=4, status=5, room=6, guest_name=7, guest_first_name=8,
  // guest_last_name=9, thai_name=10, phone=11, check_in=12, check_out=13,
  // nights=14, booked_date=15, total_amount=16, amount_paid=17,
  // outstanding=18, …
  it("places room, nights, and outstanding at the expected indices", () => {
    const b = {
      room_id: "r1",
      check_in: "2026-06-01",
      check_out: "2026-06-03",
      total_amount: 2000,
      amount_paid: 500,
      // required Booking fields (unused by the three derived columns)
      id: "bid",
      tenant_id: "t1",
      property_id: "p1",
      code: "BK-TST-0001",
      guest_name: "Test Guest",
      status: "confirmed",
      source: "direct",
      booking_type: "standard",
      adults: 1,
      children: 0,
      created_at: "2026-06-01T00:00:00Z",
      is_open_ended: false,
      extra_bed: false,
    } as unknown as Booking;

    const vals = rowValues(b, { r1: "201" });

    expect(vals[6]).toBe("201");    // room
    expect(vals[14]).toBe("2");     // nights (2026-06-01 → 2026-06-03)
    expect(vals[18]).toBe("1500");  // outstanding (2000 − 500)
  });

  it("returns '—' for room when room_id is absent from the map", () => {
    const b = {
      room_id: "missing",
      check_in: "2026-06-01",
      check_out: "2026-06-02",
      total_amount: null,
      amount_paid: 0,
    } as unknown as Booking;

    const vals = rowValues(b, {});
    expect(vals[6]).toBe("—");   // room → missing key
    expect(vals[14]).toBe("1");  // nights
    expect(vals[18]).toBe("");   // outstanding → total_amount null
  });
});
