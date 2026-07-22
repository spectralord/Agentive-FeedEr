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
  });

  it("coerces numeric strings", () => {
    const env = parseEnv({ ...required, TOP_N: "5", QUALITY_THRESHOLD: "70" });
    expect(env.TOP_N).toBe(5);
    expect(env.QUALITY_THRESHOLD).toBe(70);
  });

  it("throws a readable error when a required variable is missing", () => {
    expect(() => parseEnv({ ANTHROPIC_API_KEY: "sk-test" })).toThrow(/DATABASE_URL/);
  });

  it("rejects out-of-range values", () => {
    expect(() => parseEnv({ ...required, QUALITY_THRESHOLD: "101" })).toThrow();
  });
});
