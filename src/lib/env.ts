import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Optional so the web process boots without it; only Claude calls (enrichment/
  // daily job) require it — enforced at use in src/lib/claude.ts. An empty
  // string (e.g. a misconfigured Railway shared-var reference) is treated as
  // unset so the process boots instead of crashing at env validation.
  ANTHROPIC_API_KEY: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  DEEPEN_MODEL: z.string().default("claude-sonnet-5"),
  MAX_ENRICH_PER_RUN: z.coerce.number().int().positive().default(100),
  QUALITY_THRESHOLD: z.coerce.number().int().min(0).max(100).default(60),
  TOP_N: z.coerce.number().int().positive().default(3),
  NEW_DAYS: z.coerce.number().int().positive().default(7),
  // Epic 9 (T9.2): display name for `own` experience reports — stands in for
  // real multi-user auth, which doesn't exist in the MVP (ADR 0007).
  OWNER_NAME: z.string().min(1).default("Ich"),
  // Epic 13 (T13.1): shared secret gating the admin console. Unset (or empty)
  // ⇒ the admin area is disabled (safe default on a public URL). ADR 0010.
  ADMIN_TOKEN: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  // Epic 17 (ADR 0015): execution model on two axes (trigger × executor) via
  // profiles. APP_PROFILE sets defaults; the two overrides win when set. The
  // profile matrix / illegal-combo validation lives in
  // src/lib/executor/config.ts (resolveExecutionConfig), not here, because it
  // is cross-field.
  // Default flipped cloud -> local on 2026-08-01 (owner's decision; ADR 0015's
  // matrix is otherwise unchanged and `cloud` remains fully supported by
  // setting APP_PROFILE explicitly). Two reasons: the Railway deployment is
  // dormant, and — the load-bearing one — `cloud` implies executor=api, i.e.
  // the PAID Anthropic API. An unset APP_PROFILE therefore used to mean "spend
  // API credit"; it now means Claude Code quota + manual trigger, which cannot
  // spend money or reach a cloud cron by accident. Failing safe is the right
  // default for a single-user tool that is currently run locally.
  APP_PROFILE: z.enum(["local", "cloud"]).default("local"),
  PIPELINE_EXECUTOR: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["api", "claude-code"]).optional(),
  ),
  PIPELINE_TRIGGER: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["railway-cron", "claude-code-cron", "manual"]).optional(),
  ),
  // Epic 15 (ADR 0013): Match-or-Propose topic clustering config. Only
  // clusters matched within CLUSTER_WINDOW_DAYS are match candidates for a
  // new reel ("active window"); MAX_CLUSTER_CANDIDATES caps how many of
  // those ride along in the prompt per reel (cost/context guard, same idea
  // as MAX_ENRICH_PER_RUN).
  CLUSTER_WINDOW_DAYS: z.coerce.number().int().positive().default(30),
  MAX_CLUSTER_CANDIDATES: z.coerce.number().int().positive().default(40),
  // Epic 11 (ADR 0012, T11.2): confidence-scale thresholds — number of
  // independent (is_primary=true) cluster members mapped to few/some/strong.
  // `1` is always "few" (below CONF_SOME_MIN); CONF_SOME_MIN..CONF_STRONG_MIN-1
  // is "some"; >= CONF_STRONG_MIN is "strong". See src/lib/knowledge-check/confidence.ts.
  CONF_SOME_MIN: z.coerce.number().int().positive().default(2),
  CONF_STRONG_MIN: z.coerce.number().int().positive().default(4),
  // Epic 11 (T11.3): optional model override for the freshness/supersession
  // LLM pass. Left optional/undefined here (same "empty string = unset"
  // preprocess pattern as ANTHROPIC_API_KEY/ADMIN_TOKEN above) rather than
  // given its own hardcoded default like DEEPEN_MODEL — the fallback to
  // ANTHROPIC_MODEL is resolved at the call site (same `opts.model ??
  // env().ANTHROPIC_MODEL` pattern callStructured uses in src/lib/claude.ts),
  // see src/lib/knowledge-check/freshness.ts.
  KNOWLEDGE_CHECK_MODEL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Lazily parsed process env — throws a readable error on first access if invalid. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
