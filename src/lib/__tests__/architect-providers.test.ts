import { describe, expect, it } from "vitest";

import {
  ARCHITECT_PROVIDER_OPTIONS,
  isArchitectProviderId,
  labelForArchitectProvider,
} from "@/lib/architect-providers";

describe("ARCHITECT_PROVIDER_OPTIONS", () => {
  it("lists the three supported providers", () => {
    expect(ARCHITECT_PROVIDER_OPTIONS.map((o) => o.id)).toEqual([
      "gemini",
      "groq",
      "nvidia",
    ]);
  });
});

describe("isArchitectProviderId", () => {
  it("returns true for known provider ids", () => {
    expect(isArchitectProviderId("gemini")).toBe(true);
    expect(isArchitectProviderId("groq")).toBe(true);
    expect(isArchitectProviderId("nvidia")).toBe(true);
  });

  it("returns false for unknown or empty input", () => {
    expect(isArchitectProviderId("openai")).toBe(false);
    expect(isArchitectProviderId("")).toBe(false);
    expect(isArchitectProviderId("GEMINI")).toBe(false);
  });
});

describe("labelForArchitectProvider", () => {
  it("returns the human label for each provider", () => {
    expect(labelForArchitectProvider("gemini")).toBe("Google Gemini");
    expect(labelForArchitectProvider("groq")).toBe("Groq");
    expect(labelForArchitectProvider("nvidia")).toBe("NVIDIA NIM");
  });

  it("falls back to the raw id for an unknown provider", () => {
    // @ts-expect-error intentionally passing an invalid provider id
    expect(labelForArchitectProvider("unknown")).toBe("unknown");
  });
});
