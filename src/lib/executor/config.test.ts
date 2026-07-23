import { describe, expect, it } from "vitest";
import { resolveExecutionConfig } from "./config";

type Overrides = Parameters<typeof resolveExecutionConfig>[0];

function envWith(overrides: Partial<Overrides>): Overrides {
  return {
    APP_PROFILE: "cloud",
    PIPELINE_EXECUTOR: undefined,
    PIPELINE_TRIGGER: undefined,
    ...overrides,
  };
}

describe("resolveExecutionConfig — profile defaults", () => {
  it("cloud defaults to railway-cron + api (status quo)", () => {
    expect(resolveExecutionConfig(envWith({ APP_PROFILE: "cloud" }))).toEqual({
      profile: "cloud",
      executor: "api",
      trigger: "railway-cron",
    });
  });

  it("local defaults to manual + claude-code", () => {
    expect(resolveExecutionConfig(envWith({ APP_PROFILE: "local" }))).toEqual({
      profile: "local",
      executor: "claude-code",
      trigger: "manual",
    });
  });
});

describe("resolveExecutionConfig — cloud overrides (the three usable variants)", () => {
  it('"Cloud": railway-cron + api', () => {
    const cfg = resolveExecutionConfig(
      envWith({ PIPELINE_TRIGGER: "railway-cron", PIPELINE_EXECUTOR: "api" }),
    );
    expect(cfg).toMatchObject({ trigger: "railway-cron", executor: "api" });
  });

  it('"Claude Code Cron": claude-code-cron + claude-code', () => {
    const cfg = resolveExecutionConfig(
      envWith({ PIPELINE_TRIGGER: "claude-code-cron", PIPELINE_EXECUTOR: "claude-code" }),
    );
    expect(cfg).toMatchObject({ trigger: "claude-code-cron", executor: "claude-code" });
  });

  it('"Claude Code API": claude-code-cron + api', () => {
    const cfg = resolveExecutionConfig(
      envWith({ PIPELINE_TRIGGER: "claude-code-cron", PIPELINE_EXECUTOR: "api" }),
    );
    expect(cfg).toMatchObject({ trigger: "claude-code-cron", executor: "api" });
  });
});

describe("resolveExecutionConfig — illegal combinations throw (ADR 0015)", () => {
  it("rejects railway-cron + claude-code (Railway cannot use CC quota)", () => {
    expect(() =>
      resolveExecutionConfig(
        envWith({ PIPELINE_TRIGGER: "railway-cron", PIPELINE_EXECUTOR: "claude-code" }),
      ),
    ).toThrow(/Railway cannot use Claude Code quota/);
  });

  it("rejects local + api executor (local must never use the paid API)", () => {
    expect(() =>
      resolveExecutionConfig(envWith({ APP_PROFILE: "local", PIPELINE_EXECUTOR: "api" })),
    ).toThrow(/must never use the paid API/);
  });

  it("rejects local + railway-cron (local never touches Railway)", () => {
    expect(() =>
      resolveExecutionConfig(envWith({ APP_PROFILE: "local", PIPELINE_TRIGGER: "railway-cron" })),
    ).toThrow(/never interacts with Railway/);
  });

  it("allows local + claude-code-cron override", () => {
    expect(
      resolveExecutionConfig(envWith({ APP_PROFILE: "local", PIPELINE_TRIGGER: "claude-code-cron" })),
    ).toEqual({ profile: "local", executor: "claude-code", trigger: "claude-code-cron" });
  });
});
