import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  expectedSessionValue,
  sessionValueForToken,
  verifyToken,
} from "./auth";

describe("admin auth", () => {
  it("verifyToken accepts the exact token and rejects others", () => {
    expect(verifyToken("secret", "secret")).toBe(true);
    expect(verifyToken("wrong", "secret")).toBe(false);
    expect(verifyToken("secre", "secret")).toBe(false); // length mismatch
  });

  it("verifyToken rejects everything when no token is configured", () => {
    expect(verifyToken("anything", undefined)).toBe(false);
  });

  it("session value is deterministic per token and differs across tokens", () => {
    expect(sessionValueForToken("a")).toBe(sessionValueForToken("a"));
    expect(sessionValueForToken("a")).not.toBe(sessionValueForToken("b"));
    // HMAC-SHA256 hex is 64 chars and never equals the raw token
    expect(sessionValueForToken("secret")).toHaveLength(64);
    expect(sessionValueForToken("secret")).not.toContain("secret");
  });

  it("expectedSessionValue is null when admin is disabled", () => {
    expect(expectedSessionValue(undefined)).toBeNull();
    expect(expectedSessionValue("secret")).toBe(sessionValueForToken("secret"));
  });

  it("constantTimeEqual compares correctly", () => {
    expect(constantTimeEqual("x", "x")).toBe(true);
    expect(constantTimeEqual("x", "y")).toBe(false);
    expect(constantTimeEqual("x", "xx")).toBe(false);
  });
});
