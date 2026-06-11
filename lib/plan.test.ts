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
  it("glass themes are pro-only", () => {
    expect(hasGlassThemes("trial")).toBe(false);
    expect(hasGlassThemes("pro")).toBe(true);
    expect(availableThemes("trial")).toEqual(["light", "dark"]);
    expect(availableThemes("pro")).toEqual(["light", "dark", "light-glass", "dark-glass"]);
  });
  it("isThemeAllowed gates glass for non-pro", () => {
    expect(isThemeAllowed("trial", "dark")).toBe(true);
    expect(isThemeAllowed("trial", "dark-glass")).toBe(false);
    expect(isThemeAllowed("pro", "dark-glass")).toBe(true);
  });
  it("unknown plan falls back to trial limits", () => {
    expect(planLimits("garbage").maxProperties).toBe(1);
  });
});
