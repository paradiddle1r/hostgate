import { describe, it, expect } from "vitest";
import {
  validateBookableAddon,
  findAddonForProductName,
  toggleBookableAddon,
  listActiveBookableAddons,
  type BookableAddon,
} from "./bookable-addons";

const list: BookableAddon[] = [
  {
    id: "breakfast",
    name: { th: "อาหารเช้า", en: "Breakfast" },
    description: { th: "…", en: "…" },
    price: 150,
    matchNames: ["breakfast", "อาหารเช้า"],
    active: true,
  },
  {
    id: "airport_transfer",
    name: { th: "รถรับส่งสนามบิน", en: "Airport transfer" },
    description: { th: "…", en: "…" },
    price: 500,
    matchNames: ["airport transfer", "airport pickup"],
    active: true,
  },
  {
    id: "late_checkout",
    name: { th: "เช็คเอาต์ล่าช้า", en: "Late checkout" },
    description: { th: "…", en: "…" },
    price: 300,
    matchNames: ["late checkout"],
    active: false,
  },
];

describe("validateBookableAddon", () => {
  it("accepts a valid, active add-on (case-insensitive)", () => {
    const r = validateBookableAddon("BREAKFAST", list);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.addon.id).toBe("breakfast");
  });

  it("rejects an unknown id", () => {
    const r = validateBookableAddon("spa", list);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/not found/);
  });

  it("rejects an empty id", () => {
    const r = validateBookableAddon("   ", list);
    expect(r.ok).toBe(false);
  });

  it("rejects an inactive add-on", () => {
    const r = validateBookableAddon("late_checkout", list);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/not currently offered/);
  });
});

describe("findAddonForProductName", () => {
  it("matches a POS product name case-insensitively", () => {
    const addon = findAddonForProductName("Breakfast Buffet", list);
    expect(addon?.id).toBe("breakfast");
  });

  it("matches a Thai product name", () => {
    const addon = findAddonForProductName("บริการอาหารเช้า", list);
    expect(addon?.id).toBe("breakfast");
  });

  it("matches on a partial phrase (substring)", () => {
    const addon = findAddonForProductName("Airport Transfer Service (1-way)", list);
    expect(addon?.id).toBe("airport_transfer");
  });

  it("returns undefined for a non-matching product", () => {
    const addon = findAddonForProductName("Bottled Water 500ml", list);
    expect(addon).toBeUndefined();
  });

  it("returns undefined for an empty name", () => {
    expect(findAddonForProductName("", list)).toBeUndefined();
  });
});

describe("toggleBookableAddon", () => {
  it("flips the active flag for the matching id", () => {
    const next = toggleBookableAddon("breakfast", list);
    expect(next.find((a) => a.id === "breakfast")?.active).toBe(false);
    expect(next.find((a) => a.id === "airport_transfer")?.active).toBe(true);
  });

  it("is case-insensitive", () => {
    const next = toggleBookableAddon("LATE_CHECKOUT", list);
    expect(next.find((a) => a.id === "late_checkout")?.active).toBe(true);
  });

  it("does not mutate the original list", () => {
    const before = list.find((a) => a.id === "breakfast")?.active;
    toggleBookableAddon("breakfast", list);
    expect(list.find((a) => a.id === "breakfast")?.active).toBe(before);
  });

  it("leaves the list unchanged for an unknown id", () => {
    const next = toggleBookableAddon("spa", list);
    expect(next).toEqual(list);
  });
});

describe("listActiveBookableAddons", () => {
  it("returns only active add-ons", () => {
    const active = listActiveBookableAddons(list);
    expect(active.map((a) => a.id).sort()).toEqual(["airport_transfer", "breakfast"]);
  });
});
