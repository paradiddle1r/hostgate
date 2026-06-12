import { describe, it, expect } from "vitest";
import { parseBookingText } from "./booking-parse";

describe("parseBookingText — dates", () => {
  it("reads ISO dates", () => {
    const r = parseBookingText("Check-in 2026-07-01 Check-out 2026-07-04");
    expect(r.checkIn).toBe("2026-07-01");
    expect(r.checkOut).toBe("2026-07-04");
  });

  it("reads bare numeric as DD/MM/YYYY (Thai context)", () => {
    const r = parseBookingText("เข้าพัก 01/07/2026 ถึง 04/07/2026");
    expect(r.checkIn).toBe("2026-07-01");
    expect(r.checkOut).toBe("2026-07-04");
  });

  it("reads '12 Jun 2026' style", () => {
    const r = parseBookingText("Arrival: 12 Jun 2026, Departure: 15 June 2026");
    expect(r.checkIn).toBe("2026-06-12");
    expect(r.checkOut).toBe("2026-06-15");
  });

  it("reads 'Jun 12, 2026' style", () => {
    const r = parseBookingText("From Jun 12, 2026 to Jun 14, 2026");
    expect(r.checkIn).toBe("2026-06-12");
    expect(r.checkOut).toBe("2026-06-14");
  });

  it("orders swapped dates and rejects equal dates", () => {
    const r = parseBookingText("2026-07-10 ... 2026-07-05");
    expect(r.checkIn).toBe("2026-07-05");
    expect(r.checkOut).toBe("2026-07-10");
    const same = parseBookingText("only 2026-07-05 here");
    expect(same.checkIn).toBe("2026-07-05");
    expect(same.checkOut).toBeUndefined();
  });

  it("rejects impossible dates", () => {
    const r = parseBookingText("31/02/2026 and 2026-13-40");
    expect(r.checkIn).toBeUndefined();
  });
});

describe("parseBookingText — name + phone", () => {
  it("pulls a labelled guest name and phone", () => {
    const text = [
      "Booking confirmation",
      "Guest name: John Smith",
      "Phone: +66 81 234 5678",
      "Check-in: 2026-07-01",
      "Check-out: 2026-07-03",
    ].join("\n");
    const r = parseBookingText(text);
    expect(r.guestName).toBe("John Smith");
    expect(r.phone?.replace(/\s/g, "")).toBe("+66812345678");
    expect(r.checkIn).toBe("2026-07-01");
    expect(r.checkOut).toBe("2026-07-03");
  });

  it("reads a Thai name label", () => {
    const r = parseBookingText("ชื่อ: สมชาย ใจดี\nเข้า 2026-08-01 ออก 2026-08-02");
    expect(r.guestName).toBe("สมชาย ใจดี");
  });

  it("does not invent a name when none is labelled", () => {
    const r = parseBookingText("2026-07-01 to 2026-07-02, 2 adults");
    expect(r.guestName).toBeUndefined();
  });

  it("returns empty for empty input", () => {
    expect(parseBookingText("")).toEqual({});
  });
});

describe("parseBookingText — realistic Agoda-style paste", () => {
  it("extracts from a multi-line confirmation", () => {
    const text = [
      "Agoda Booking ID 1234567",
      "Guest: Somchai Prasert",
      "Mobile +66898887777",
      "Check-in  15 Aug 2026",
      "Check-out 18 Aug 2026",
      "Room: Deluxe, 2 guests",
    ].join("\n");
    const r = parseBookingText(text);
    expect(r.guestName).toBe("Somchai Prasert");
    expect(r.checkIn).toBe("2026-08-15");
    expect(r.checkOut).toBe("2026-08-18");
    expect(r.phone?.replace(/\s/g, "")).toBe("+66898887777");
  });
});
