import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Optional so the web process boots without it; only Claude calls (enrichment/
  // daily job) require it — enforced at use in src/lib/claude.ts.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  DEEPEN_MODEL: z.string().default("claude-sonnet-5"),
  MAX_ENRICH_PER_RUN: z.coerce.number().int().positive().default(100),
  QUALITY_THRESHOLD: z.coerce.number().int().min(0).max(100).default(60),
  TOP_N: z.coerce.number().int().positive().default(3),
  NEW_DAYS: z.coerce.number().int().positive().default(7),
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
