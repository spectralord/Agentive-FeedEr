import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { rawItems, reels, sources, type RawItem } from "@/db/schema";
import { callStructured } from "@/lib/claude";
import { env } from "@/lib/env";
import { loadFeedbackSummaryText } from "@/lib/feedback/run";
import { loadProfile } from "./profile";
import {
  buildEnrichmentUserPrompt,
  ENRICHMENT_SYSTEM_PROMPT,
  ENRICHMENT_TOOL_NAME,
} from "./prompt";
import { reelOutputJsonSchema, reelOutputSchema, type ReelOutput } from "./schema";

export interface EnrichmentResult {
  processed: number;
  succeeded: number;
  failed: number;
}

/** Signature of the structured-call dependency — injectable for tests. */
export type StructuredCaller = (opts: {
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
}) => Promise<unknown>;

export async function runEnrichment(
  db: NodePgDatabase<typeof schema>,
  caller: StructuredCaller = callStructured,
  profile: string = loadProfile(),
): Promise<EnrichmentResult> {
  const pending = await db
    .select({ item: rawItems, sourceName: sources.name })
    .from(rawItems)
    .innerJoin(sources, eq(rawItems.sourceId, sources.id))
    .where(and(isNull(rawItems.enrichedAt), isNull(rawItems.enrichError)))
    .orderBy(asc(rawItems.publishedAt))
    .limit(env().MAX_ENRICH_PER_RUN);

  // T6.4: the rolling feedback summary (if one has been generated yet) rides
  // along as extra relevance context on every item this run — see
  // src/lib/enrichment/prompt.ts and src/lib/feedback/run.ts.
  const feedbackSummary = await loadFeedbackSummaryText(db);

  let succeeded = 0;
  let failed = 0;

  for (const { item, sourceName } of pending) {
    try {
      const output = await enrichWithRetry(caller, item, sourceName, profile, feedbackSummary);
      await db.transaction(async (tx) => {
        await tx.insert(reels).values({
          rawItemId: item.id,
          summary: output.summary,
          category: output.category,
          maturity: output.maturity,
          experimental: output.experimental,
          relevanceScore: output.relevance_score,
          qualityScore: output.quality_score,
          example: output.example,
          action: output.action,
          effortTag: output.effort_tag,
          // reels.skill is deliberately NOT set here (ADR 0009): it stays
          // null until the SkillTagger (Epic 12) reconciles the raw
          // skill_hint below against the canonical skill_nodes list. The
          // hint rides along in `metadata` (schema-migration-free field,
          // see CONTEXT.md "Attribut") so the tagger can read it back.
          metadata: output.skill_hint ? { skillHint: output.skill_hint } : {},
        });
        await tx.update(rawItems).set({ enrichedAt: new Date() }).where(eq(rawItems.id, item.id));
      });
      succeeded++;
    } catch (error) {
      // Infrastructure problems (auth, rate limit, server errors) are transient:
      // abort the run and leave items untouched so the next run retries them.
      // Only content-level failures (schema validation) poison the item.
      if (error instanceof Anthropic.APIError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      await db.update(rawItems).set({ enrichError: message }).where(eq(rawItems.id, item.id));
      failed++;
    }
  }

  return { processed: pending.length, succeeded, failed };
}

async function enrichWithRetry(
  caller: StructuredCaller,
  item: RawItem,
  sourceName: string,
  profile: string,
  feedbackSummary?: string,
): Promise<ReelOutput> {
  const opts = {
    system: ENRICHMENT_SYSTEM_PROMPT,
    user: buildEnrichmentUserPrompt({ item, sourceName, profile, feedbackSummary }),
    toolName: ENRICHMENT_TOOL_NAME,
    inputSchema: reelOutputJsonSchema as unknown as Record<string, unknown>,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await caller(opts);
      return reelOutputSchema.parse(raw);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
