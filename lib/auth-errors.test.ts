import { describe, expect, it } from "vitest";
import { classifyAuthError, safeNextPath } from "./auth-errors";

describe("classifyAuthError", () => {
  it.each([
    "Unsupported provider: custom:line",
    "Provider is not enabled",
    "OAuth provider not configured",
    "validation failed for provider",
  ])("recognizes provider configuration errors: %s", (message) => {
    expect(classifyAuthError(message)).toBe("providerNotConfigured");
  });

  it("keeps other callback failures generic", () => {
    expect(classifyAuthError("The user denied the request")).toBe("generic");
  });
});

describe("safeNextPath", () => {
  const origin = "https://hostgate.app";

  it("keeps a same-origin path with query and hash", () => {
    expect(safeNextPath("/onboarding?step=2#hotel", origin)).toBe(
      "/onboarding?step=2#hotel"
    );
  });

  it.each(["https://evil.example", "//evil.example/path", "/\\evil.example/path", "app"])(
    "rejects an unsafe next target: %s",
    (value) => {
      expect(safeNextPath(value, origin)).toBeNull();
    }
  );
});
