import type { Env } from "@/lib/env";

/**
 * Execution model (Epic 17 / ADR 0015): two orthogonal axes selected via
 * profiles.
 *   - Trigger  = who kicks off a run.
 *   - Executor = what performs the LLM inference (paid API vs Claude Code quota).
 * `APP_PROFILE` sets sensible defaults; the two overrides win when set. The
 * profile matrix and its illegal combinations are validated here (cross-field),
 * not in the flat env schema.
 */
export type ExecutorKind = "api" | "claude-code";
export type TriggerKind = "railway-cron" | "claude-code-cron" | "manual";
export type AppProfile = "local" | "cloud";

export interface ExecutionConfig {
  profile: AppProfile;
  executor: ExecutorKind;
  trigger: TriggerKind;
}

const PROFILE_DEFAULTS: Record<AppProfile, { executor: ExecutorKind; trigger: TriggerKind }> = {
  // local: pure Claude Code quota, never Railway, never the paid API (ADR 0015).
  local: { executor: "claude-code", trigger: "manual" },
  // cloud: the status quo — Railway cron drives, API does inference.
  cloud: { executor: "api", trigger: "railway-cron" },
};

type ExecutionEnv = Pick<Env, "APP_PROFILE" | "PIPELINE_EXECUTOR" | "PIPELINE_TRIGGER">;

/**
 * Resolves the effective execution config from the environment and enforces the
 * ADR-0015 matrix. Throws on any illegal combination so a misconfiguration
 * fails loudly at startup rather than silently costing money or hitting Railway.
 */
export function resolveExecutionConfig(env: ExecutionEnv): ExecutionConfig {
  const profile = env.APP_PROFILE;
  const defaults = PROFILE_DEFAULTS[profile];
  const executor: ExecutorKind = env.PIPELINE_EXECUTOR ?? defaults.executor;
  const trigger: TriggerKind = env.PIPELINE_TRIGGER ?? defaults.trigger;

  // Hard guardrail: the local profile must never use the paid API or Railway.
  if (profile === "local") {
    if (executor === "api") {
      throw new Error(
        "APP_PROFILE=local forbids PIPELINE_EXECUTOR=api — local mode must never use the paid API (ADR 0015).",
      );
    }
    if (trigger === "railway-cron") {
      throw new Error(
        "APP_PROFILE=local forbids PIPELINE_TRIGGER=railway-cron — local mode never interacts with Railway (ADR 0015).",
      );
    }
  }

  // Impossible everywhere: Railway cannot spend Claude Code quota.
  if (trigger === "railway-cron" && executor === "claude-code") {
    throw new Error(
      "Illegal combination PIPELINE_TRIGGER=railway-cron + PIPELINE_EXECUTOR=claude-code — " +
        "Railway cannot use Claude Code quota (ADR 0015).",
    );
  }

  return { profile, executor, trigger };
}
