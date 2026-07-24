import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { rawItems, reels, sources, topicClusters } from "@/db/schema";
import { env } from "@/lib/env";

export type Confidence = "few" | "some" | "strong";

export interface ConfidenceResult {
  clusterId: number;
  independentCount: number;
  confidence: Confidence;
}

/**
 * Pure/grounded mapping from an independent-source count to the confidence
 * scale (ADR 0012/0013, T11.2) — no LLM involved. The epic file states the
 * mapping as "1 = few, CONF_SOME_MIN..CONF_STRONG_MIN-1 = some, >=
 * CONF_STRONG_MIN = strong" (defaults 2 and 4). This generalizes "1" to
 * "< CONF_SOME_MIN" so the mapping stays consistent for any threshold
 * configuration and also covers the (currently unreachable, see
 * computeConfidenceForActiveClusters) 0-independent-members edge case — see
 * docs/plan/epic-11-sota-recheck.md "Abweichungen/Fragen".
 */
export function confidenceForCount(count: number): Confidence {
  const { CONF_SOME_MIN, CONF_STRONG_MIN } = env();
  if (count >= CONF_STRONG_MIN) return "strong";
  if (count >= CONF_SOME_MIN) return "some";
  return "few";
}

/**
 * Counts distinct source names among a cluster's `is_primary=true` reel
 * members — ADR 0013 point 4 made `is_primary` the ground truth for
 * "independent"; reblogs (`is_primary=false`) are deliberately excluded so
 * they never inflate the corroboration count. Reels only: experience-report
 * corroboration is T11.7, explicitly deferred (no `topic_cluster_id`
 * linkage exists yet on `experience_reports` — see epic file
 * "Abweichungen/Fragen"). Only `active` clusters are considered (T11.2/ADR
 * 0012 — a deprecated cluster's confidence is frozen, not recomputed).
 */
export async function computeConfidenceForActiveClusters(
  db: NodePgDatabase<typeof schema>,
): Promise<ConfidenceResult[]> {
  const rows = await db
    .select({ clusterId: topicClusters.id, sourceName: sources.name })
    .from(topicClusters)
    .innerJoin(
      reels,
      and(eq(reels.topicClusterId, topicClusters.id), eq(reels.isPrimary, true)),
    )
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .innerJoin(sources, eq(rawItems.sourceId, sources.id))
    .where(eq(topicClusters.lifecycleState, "active"));

  const distinctByCluster = new Map<number, Set<string>>();
  for (const row of rows) {
    const set = distinctByCluster.get(row.clusterId) ?? new Set<string>();
    set.add(row.sourceName);
    distinctByCluster.set(row.clusterId, set);
  }

  return [...distinctByCluster.entries()].map(([clusterId, sourceNames]) => {
    const independentCount = sourceNames.size;
    return { clusterId, independentCount, confidence: confidenceForCount(independentCount) };
  });
}

/**
 * Applies computeConfidenceForActiveClusters' results to `topic_clusters`
 * (T11.6 wires this into the pipeline right after clustering, every run —
 * cheap and grounded, no gating needed). A cluster with zero `is_primary`
 * members is left untouched (confidence stays null); this cannot currently
 * happen because the clustering pass always marks a brand-new cluster's
 * first member primary (ADR 0013 point 4), but the computation degrades
 * safely rather than throwing if it ever did.
 */
export async function runConfidenceComputation(
  db: NodePgDatabase<typeof schema>,
): Promise<ConfidenceResult[]> {
  const results = await computeConfidenceForActiveClusters(db);
  for (const result of results) {
    await db
      .update(topicClusters)
      .set({ confidence: result.confidence, independentCount: result.independentCount })
      .where(eq(topicClusters.id, result.clusterId));
  }
  return results;
}
