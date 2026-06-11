import { describe, it, expect } from "vitest";
import { ok, fail, hgError, HGError, mapPgError } from "./errors";

describe("ActionResult helpers", () => {
  it("ok wraps data", () => {
    expect(ok({ x: 1 })).toEqual({ ok: true, data: { x: 1 } });
  });
  it("fail carries code + message", () => {
    expect(fail("HG-BOOK-409", "clash")).toEqual({ ok: false, code: "HG-BOOK-409", message: "clash" });
  });
});

describe("mapPgError", () => {
  it("recovers an HGError's code", () => {
    const r = mapPgError(hgError("HG-PROP-403", "limit"));
    expect(r).toEqual({ ok: false, code: "HG-PROP-403", message: "limit" });
  });

  it("extracts the code from a trigger exception message", () => {
    const r = mapPgError({ message: "HG-BOOK-409: room already booked for these dates" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("HG-BOOK-409");
      expect(r.message).toContain("room already booked");
    }
  });

  it("maps unique_violation on rooms to HG-ROOM-409", () => {
    const r = mapPgError({ code: "23505", message: 'duplicate key value violates unique constraint "rooms_property_number"' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("HG-ROOM-409");
  });

  it("falls back to HG-UNKNOWN-500 for anything else", () => {
    const r = mapPgError(new Error("boom"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("HG-UNKNOWN-500");
  });

  it("HGError is an Error with hgCode", () => {
    const e = hgError("HG-AUTH-401", "no session");
    expect(e).toBeInstanceOf(HGError);
    expect(e.hgCode).toBe("HG-AUTH-401");
  });
});
