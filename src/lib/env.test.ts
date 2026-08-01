import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const required = {
  DATABASE_URL: "postgres://localhost/test",
  ANTHROPIC_API_KEY: "sk-test",
};

describe("parseEnv", () => {
  it("applies defaults for optional variables", () => {
    const env = parseEnv(required);
    expect(env.ANTHROPIC_MODEL).toBe("claude-haiku-4-5-20251001");
    expect(env.MAX_ENRICH_PER_RUN).toBe(100);
    expect(env.QUALITY_THRESHOLD).toBe(60);
    expect(env.TOP_N).toBe(3);
    expect(env.NEW_DAYS).toBe(7);
    expect(env.OWNER_NAME).toBe("Ich");
  });

  it("allows overriding OWNER_NAME (T9.2)", () => {
    const env = parseEnv({ ...required, OWNER_NAME: "Max" });
    expect(env.OWNER_NAME).toBe("Max");
  });

  it("treats an empty ANTHROPIC_API_KEY as unset (T13/robustness)", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://localhost/test", ANTHROPIC_API_KEY: "" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("ADMIN_TOKEN is undefined by default and empty is treated as unset (T13.1)", () => {
    expect(parseEnv(required).ADMIN_TOKEN).toBeUndefined();
    expect(parseEnv({ ...required, ADMIN_TOKEN: "" }).ADMIN_TOKEN).toBeUndefined();
    expect(parseEnv({ ...required, ADMIN_TOKEN: "s3cret" }).ADMIN_TOKEN).toBe("s3cret");
  });

  it("coerces numeric strings", () => {
    const env = parseEnv({ ...required, TOP_N: "5", QUALITY_THRESHOLD: "70" });
    expect(env.TOP_N).toBe(5);
    expect(env.QUALITY_THRESHOLD).toBe(70);
  });

  it("throws a readable error when a required variable is missing", () => {
    expect(() => parseEnv({ ANTHROPIC_API_KEY: "sk-test" })).toThrow(/DATABASE_URL/);
  });

  it("allows ANTHROPIC_API_KEY to be absent (web process needs only DATABASE_URL)", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://localhost/test" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.DATABASE_URL).toBe("postgres://localhost/test");
  });

  it("rejects out-of-range values", () => {
    expect(() => parseEnv({ ...required, QUALITY_THRESHOLD: "101" })).toThrow();
  });

  it("defaults APP_PROFILE to local, so an unset profile cannot spend API credit", () => {
    // Changed from "cloud" on 2026-08-01. `cloud` resolves to executor=api —
    // the PAID Anthropic API — plus a cron trigger, so the old default meant an
    // unconfigured process would reach for money and a dormant deployment.
    // `local` resolves to claude-code + manual, which can do neither. Pinned
    // here because nothing else asserts the zod default: the
    // resolveExecutionConfig tests all pass APP_PROFILE explicitly, so a silent
    // flip back would not fail any existing test.
    expect(parseEnv(required).APP_PROFILE).toBe("local");
  });

  it("still accepts an explicit cloud profile (ADR 0015's matrix is unchanged)", () => {
    expect(parseEnv({ ...required, APP_PROFILE: "cloud" }).APP_PROFILE).toBe("cloud");
  });
});
