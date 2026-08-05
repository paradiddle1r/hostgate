import { describe, it, expect } from "vitest";
import { namedRoomTypes, unpricedRoomTypes, unpricedProvisionRows } from "./onboarding";

describe("namedRoomTypes", () => {
  it("keeps only rows the owner actually named", () => {
    const rows = [
      { name: "Standard", rate: 900 },
      { name: "   ", rate: 1200 },
      { name: "", rate: "" },
      { name: " Deluxe ", rate: 1500 },
    ];
    expect(namedRoomTypes(rows).map((r) => r.name)).toEqual(["Standard", " Deluxe "]);
  });
});

describe("unpricedRoomTypes", () => {
  it("passes a fully priced set", () => {
    expect(
      unpricedRoomTypes([
        { name: "Standard", rate: 900 },
        { name: "Deluxe", rate: 1200 },
      ]),
    ).toEqual([]);
  });

  it("catches the exact shape the wizard produced — a cleared rate field", () => {
    // `rate: ""` is what the input holds after the owner deletes the number.
    const bad = unpricedRoomTypes([
      { name: "Standard", rate: 900 },
      { name: "Deluxe", rate: "" },
    ]);
    expect(bad.map((r) => r.name)).toEqual(["Deluxe"]);
  });

  it("rejects zero, negatives, null, undefined, and non-numeric text", () => {
    const bad = unpricedRoomTypes([
      { name: "zero", rate: 0 },
      { name: "negative", rate: -100 },
      { name: "null", rate: null },
      { name: "undefined", rate: undefined },
      { name: "text", rate: "abc" },
    ]);
    expect(bad.map((r) => r.name)).toEqual([
      "zero",
      "negative",
      "null",
      "undefined",
      "text",
    ]);
  });

  it("ignores unnamed rows — a blank row is dropped, not a validation error", () => {
    expect(unpricedRoomTypes([{ name: "", rate: "" }])).toEqual([]);
  });

  it("accepts a numeric string, which is what a number input yields", () => {
    expect(unpricedRoomTypes([{ name: "Standard", rate: "1500" }])).toEqual([]);
  });

  it("treats a fractional rate as priced", () => {
    expect(unpricedRoomTypes([{ name: "Standard", rate: 0.5 }])).toEqual([]);
  });
});

describe("unpricedProvisionRows", () => {
  it("catches an UNNAMED unpriced row that unpricedRoomTypes lets through", () => {
    // provisionTenant backfills a blank name to "Type N" and persists it, so on
    // the server this row is a real room type — and an unpriced one.
    const rows = [
      { name: "Standard", rate: 900 },
      { name: "", rate: "" },
    ];
    expect(unpricedRoomTypes(rows)).toEqual([]); // client view: just a blank row
    expect(unpricedProvisionRows(rows).length).toBe(1); // server view: a hole
  });

  it("passes when every row carries a rate", () => {
    expect(
      unpricedProvisionRows([
        { name: "Standard", rate: 900 },
        { name: "", rate: 1200 },
      ]),
    ).toEqual([]);
  });

  it("is empty for an empty payload", () => {
    expect(unpricedProvisionRows([])).toEqual([]);
  });
});
