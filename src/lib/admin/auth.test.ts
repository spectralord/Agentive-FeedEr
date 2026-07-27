import { describe, expect, it, vi } from "vitest";
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

  // NOTE: `expectedSessionValue(token = env().ADMIN_TOKEN)` — passing
  // `undefined` explicitly does NOT bypass the default parameter, it
  // *triggers* it. So this test used to depend on ADMIN_TOKEN being unset in
  // the ambient environment, and started failing the moment `.env` gained an
  // ADMIN_TOKEN (which `.env.example` now sets, so `cp .env.example .env`
  // reproduced it). Mock the env module instead of relying on the machine's.
  it("expectedSessionValue is null when admin is disabled", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ env: () => ({ ADMIN_TOKEN: undefined }) }));
    const auth = await import("./auth");
    expect(auth.expectedSessionValue()).toBeNull();
    vi.doUnmock("@/lib/env");
    vi.resetModules();
  });

  it("expectedSessionValue derives the session value from an explicit token", () => {
    expect(expectedSessionValue("secret")).toBe(sessionValueForToken("secret"));
  });

  it("constantTimeEqual compares correctly", () => {
    expect(constantTimeEqual("x", "x")).toBe(true);
    expect(constantTimeEqual("x", "y")).toBe(false);
    expect(constantTimeEqual("x", "xx")).toBe(false);
  });
});
