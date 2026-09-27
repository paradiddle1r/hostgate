import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "./pagination";

describe("complete booking inventory", () => {
  it.each([0, 1, 499, 500, 1000, 1023, 2000])("loads %i rows without truncation", async (count) => {
    const rows = Array.from({ length: count }, (_, id) => ({ id }));
    const page = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1), error: null,
    }));
    expect(await fetchAllPages(page)).toEqual(rows);
    expect(page).toHaveBeenCalledTimes(Math.floor(count / 500) + 1);
    expect(page).toHaveBeenNthCalledWith(1, 0, 499);
    if (count >= 500) expect(page).toHaveBeenNthCalledWith(2, 500, 999);
  });

  it("rejects a later-page failure instead of exposing partial availability", async () => {
    const error = { message: "connection lost", code: "503" };
    await expect(fetchAllPages(async (from) => from === 0
      ? { data: Array.from({ length: 500 }, (_, id) => id), error: null }
      : { data: null, error })).rejects.toBe(error);
  });

  it("does not mistake a missing response for an empty property", async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: null })))
      .rejects.toThrow("Missing page data");
  });

  it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid page size %s", async (pageSize) => {
    await expect(fetchAllPages(async () => ({ data: [], error: null }), pageSize))
      .rejects.toThrow("Page size must be a positive integer");
  });
});
