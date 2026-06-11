import { describe, it, expect } from "vitest";
import { generateRooms, uniformFloors, MAX_ROOMS_PER_FLOOR } from "./rooms-generator";

describe("generateRooms", () => {
  it("numbers rooms floor*100 + n", () => {
    const r = generateRooms([{ floor: 1, count: 3 }, { floor: 2, count: 2 }]);
    expect(r.map((x) => x.number)).toEqual(["101", "102", "103", "201", "202"]);
  });
  it("carries floor and a monotonic sort_order", () => {
    const r = generateRooms([{ floor: 1, count: 2 }, { floor: 3, count: 1 }]);
    expect(r.map((x) => x.floor)).toEqual([1, 1, 3]);
    expect(r.map((x) => x.sort_order)).toEqual([0, 1, 2]);
  });
  it("clamps count to 1..99 per floor", () => {
    const r = generateRooms([{ floor: 1, count: 250 }]);
    expect(r.length).toBe(MAX_ROOMS_PER_FLOOR);
    expect(r[r.length - 1].number).toBe("199");
  });
  it("zero count yields no rooms for that floor", () => {
    expect(generateRooms([{ floor: 1, count: 0 }])).toEqual([]);
  });
});

describe("uniformFloors", () => {
  it("builds N floors with the same room count", () => {
    expect(uniformFloors(2, 4)).toEqual([
      { floor: 1, count: 4 },
      { floor: 2, count: 4 },
    ]);
  });
});
