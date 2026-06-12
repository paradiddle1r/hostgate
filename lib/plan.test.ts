import { describe, it, expect } from "vitest";
import { canAddProperty, hasGlassThemes, availableThemes, isThemeAllowed, planLimits } from "./plan";

describe("plan limits", () => {
  it("non-pro plans cap at 1 property", () => {
    expect(canAddProperty("trial", 0)).toBe(true);
    expect(canAddProperty("trial", 1)).toBe(false);
    expect(canAddProperty("standard", 1)).toBe(false);
  });
  it("pro allows many properties", () => {
    expect(canAddProperty("pro", 1)).toBe(true);
    expect(canAddProperty("pro", 24)).toBe(true);
    expect(canAddProperty("pro", 25)).toBe(false);
  });
  // Glass themes are temporarily unlocked for every plan (promo). When they go
  // back to being a Pro perk, flip trial/standard glassThemes in lib/plan.ts
  // and restore the "pro-only" expectations here.
  it("glass themes currently unlocked for all plans", () => {
    expect(hasGlassThemes("trial")).toBe(true);
    expect(hasGlassThemes("pro")).toBe(true);
    expect(availableThemes("trial")).toEqual(["light", "dark", "light-glass", "dark-glass"]);
    expect(availableThemes("pro")).toEqual(["light", "dark", "light-glass", "dark-glass"]);
  });
  it("isThemeAllowed permits glass on every plan (promo)", () => {
    expect(isThemeAllowed("trial", "dark")).toBe(true);
    expect(isThemeAllowed("trial", "dark-glass")).toBe(true);
    expect(isThemeAllowed("pro", "dark-glass")).toBe(true);
  });
  it("unknown plan falls back to trial limits", () => {
    expect(planLimits("garbage").maxProperties).toBe(1);
  });
});
