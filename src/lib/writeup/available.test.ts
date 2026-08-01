// T19.5 (ADR 0024 decision 3): pins the cloud guard the same way
// src/lib/env.test.ts:56-65 pins the APP_PROFILE default — nothing else in
// the suite asserts this boolean, so a silent regression here (e.g. someone
// "simplifying" writeupGenerationAvailable to always return true) would not
// fail any other test. Verified by deleting the `!== "api"` check locally:
// this test fails immediately (see PR/commit description).
import { describe, expect, it, vi } from "vitest";

const required = {
  DATABASE_URL: "postgres://localhost/test",
};

describe("writeupGenerationAvailable (ADR 0024 decision 3, cloud guard)", () => {
  it("is false when the resolved executor is api (cloud profile)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: () => ({ ...required, APP_PROFILE: "cloud" }),
    }));
    const { writeupGenerationAvailable } = await import("./run");
    expect(writeupGenerationAvailable()).toBe(false);
    vi.doUnmock("@/lib/env");
  });

  it("is true when the resolved executor is claude-code (local profile, the default)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: () => ({ ...required, APP_PROFILE: "local" }),
    }));
    const { writeupGenerationAvailable } = await import("./run");
    expect(writeupGenerationAvailable()).toBe(true);
    vi.doUnmock("@/lib/env");
  });

  it("is false when PIPELINE_EXECUTOR=api overrides an otherwise-local profile", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: () => ({ ...required, APP_PROFILE: "cloud", PIPELINE_EXECUTOR: "api" }),
    }));
    const { writeupGenerationAvailable } = await import("./run");
    expect(writeupGenerationAvailable()).toBe(false);
    vi.doUnmock("@/lib/env");
  });
});
