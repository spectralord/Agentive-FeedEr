import { and, count, eq, isNotNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { rawItems, sources } from "@/db/schema";

/**
 * Data access for the T13.7 admin sources section: a read-only list of
 * configured sources plus the "reset enrich errors" retry action. Kept
 * separate from src/app/admin/page.tsx and the retry route handler (mirrors
 * how src/lib/pipeline.ts's recentRuns is a plain function the page imports).
 */

export interface SourceWithErrorCount {
  id: number;
  name: string;
  type: string;
  enabled: boolean;
  lastPolledAt: Date | null;
  enrichErrorCount: number;
}

/** All sources with a per-source count of raw_items currently stuck on an
 *  enrich error (a single grouped query, admin-only/low-traffic). */
export async function listSourcesWithErrorCounts(
  db: NodePgDatabase<typeof schema>,
): Promise<SourceWithErrorCount[]> {
  const errorCounts = await db
    .select({ sourceId: rawItems.sourceId, v: count() })
    .from(rawItems)
    .where(isNotNull(rawItems.enrichError))
    .groupBy(rawItems.sourceId);
  const countBySource = new Map(errorCounts.map((r) => [r.sourceId, r.v]));

  const allSources = await db.select().from(sources).orderBy(sources.name);
  return allSources.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    enabled: s.enabled,
    lastPolledAt: s.lastPolledAt,
    enrichErrorCount: countBySource.get(s.id) ?? 0,
  }));
}

/**
 * "Reset enrich errors" (T13.7): clears `enrich_error` for every raw_items
 * row belonging to `sourceId` that currently has one set. Deliberately does
 * NOT touch `enriched_at` — runEnrichment (src/lib/enrichment/run.ts) only
 * selects rows where both `enriched_at IS NULL` and `enrich_error IS NULL`,
 * so clearing just the error is enough to make the row eligible for the next
 * enrichment run. Returns the number of rows cleared.
 */
export async function resetEnrichErrors(
  db: NodePgDatabase<typeof schema>,
  sourceId: number,
): Promise<number> {
  const updated = await db
    .update(rawItems)
    .set({ enrichError: null })
    .where(and(eq(rawItems.sourceId, sourceId), isNotNull(rawItems.enrichError)))
    .returning({ id: rawItems.id });
  return updated.length;
}
