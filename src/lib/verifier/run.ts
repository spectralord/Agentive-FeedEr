import { and, eq, gte, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { rawItems, reels } from "@/db/schema";
import { callStructured } from "@/lib/claude";
import { env } from "@/lib/env";
import {
  buildVerifierUserPrompt,
  VERIFIER_SYSTEM_PROMPT,
  VERIFIER_TOOL_NAME,
  type VerifierReelInput,
  type VerifierSourceInput,
} from "./prompt";
import { verifierOutputJsonSchema, verifierOutputSchema } from "./schema";

/**
 * Signature of the structured-call dependency — same shape as
 * src/lib/skilltagger/tagger.ts's StructuredCaller / the Executor type in
 * src/lib/executor/executor.ts. Executor seam (ADR 0015): there is
 * deliberately NO direct anthropicClient()/API call in this module.
 */
export type StructuredCaller = (opts: {
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
}) => Promise<unknown>;

export interface VerifierCheckResult {
  caveat: string | null;
}

/**
 * One critic pass over a single reel (T10.2 core): source + finished reel in,
 * `{ caveat }` out. `caveat` is null whenever the reel is a faithful,
 * modestly-worded reflection of the source — the expected normal case
 * (ADR 0003 / ADR 0011).
 */
export async function checkReel(
  source: VerifierSourceInput,
  reel: VerifierReelInput,
  caller: StructuredCaller = callStructured,
): Promise<VerifierCheckResult> {
  const raw = await caller({
    system: VERIFIER_SYSTEM_PROMPT,
    user: buildVerifierUserPrompt(source, reel),
    toolName: VERIFIER_TOOL_NAME,
    inputSchema: verifierOutputJsonSchema as unknown as Record<string, unknown>,
  });
  const output = verifierOutputSchema.parse(raw);
  return { caveat: output.caveat };
}

export interface VerifierRunResult {
  processed: number;
  flagged: number;
  failed: number;
}

interface PendingVerifierReel {
  id: number;
  summary: string;
  example: string | null;
  action: string | null;
  title: string;
  url: string;
  rawContent: string;
}

/**
 * Gated candidate set (T10.2): only reels that are actually displayed
 * (quality_score >= env().QUALITY_THRESHOLD — same floor as the feed's
 * default view, src/lib/feed.ts) AND haven't had a verifier pass yet
 * (`caveat_checked_at IS NULL`, the idempotency marker — see the schema
 * comment in src/db/schema.ts for why a second column was needed alongside
 * the nullable `caveat` itself).
 */
async function loadPendingReels(db: NodePgDatabase<typeof schema>): Promise<PendingVerifierReel[]> {
  return db
    .select({
      id: reels.id,
      summary: reels.summary,
      example: reels.example,
      action: reels.action,
      title: rawItems.title,
      url: rawItems.url,
      rawContent: rawItems.rawContent,
    })
    .from(reels)
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .where(and(gte(reels.qualityScore, env().QUALITY_THRESHOLD), isNull(reels.caveatCheckedAt)));
}

/**
 * Batch sweep (T10.3): checks every gated, not-yet-checked reel, idempotent
 * (a rerun with nothing new to check processes 0 — every checked reel gets
 * `caveat_checked_at = now()` regardless of whether a caveat was found).
 *
 * Per-item try/catch (same never-abort-the-run contract as skilltagger/
 * clustering): one reel's failure never aborts the sweep — it simply stays
 * `caveat_checked_at IS NULL` and is retried next run.
 */
export async function runVerifier(
  db: NodePgDatabase<typeof schema>,
  caller: StructuredCaller = callStructured,
): Promise<VerifierRunResult> {
  const pending = await loadPendingReels(db);

  let flagged = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const result = await checkReel(
        { title: item.title, url: item.url, rawContent: item.rawContent },
        { summary: item.summary, example: item.example, action: item.action },
        caller,
      );
      await db
        .update(reels)
        .set({ caveat: result.caveat, caveatCheckedAt: new Date() })
        .where(eq(reels.id, item.id));
      if (result.caveat !== null) flagged++;
    } catch (error) {
      failed++;
      console.error(`[verifier] reel ${item.id} failed:`, error);
    }
  }

  return { processed: pending.length, flagged, failed };
}
