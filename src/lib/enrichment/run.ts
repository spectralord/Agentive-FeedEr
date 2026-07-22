import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { rawItems, reels, sources, type RawItem } from "@/db/schema";
import { callStructured } from "@/lib/claude";
import { env } from "@/lib/env";
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

  let succeeded = 0;
  let failed = 0;

  for (const { item, sourceName } of pending) {
    try {
      const output = await enrichWithRetry(caller, item, sourceName, profile);
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
          skill: output.skill,
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
): Promise<ReelOutput> {
  const opts = {
    system: ENRICHMENT_SYSTEM_PROMPT,
    user: buildEnrichmentUserPrompt({ item, sourceName, profile }),
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
