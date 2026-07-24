import { and, eq, exists, gt, inArray, isNull, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { reels, topicClusters } from "@/db/schema";
import { callStructured } from "@/lib/claude";
import {
  runConfidenceComputation,
  type ConfidenceResult,
} from "./confidence";
import { runFreshnessCheck, type FreshnessCheckResult, type StructuredCaller } from "./freshness";

export type { StructuredCaller } from "./freshness";

export interface KnowledgeCheckResult {
  confidence: ConfidenceResult[];
  /** null when the freshness pass was skipped entirely (no dirty clusters —
   *  no LLM call made at all, not even an empty sweep). */
  freshness: FreshnessCheckResult | null;
}

/**
 * "Dirty" clusters (T11.6 gating): active clusters that have never been
 * knowledge-checked (`knowledge_checked_at IS NULL`) or that gained a member
 * reel since their last check. Only these are candidates for the freshness
 * LLM pass — confidence (T11.2) is cheap/grounded and recomputed for every
 * active cluster regardless (see runKnowledgeCheck below).
 */
async function loadDirtyClusterIds(db: NodePgDatabase<typeof schema>): Promise<number[]> {
  const rows = await db
    .select({ id: topicClusters.id })
    .from(topicClusters)
    .where(
      and(
        eq(topicClusters.lifecycleState, "active"),
        or(
          isNull(topicClusters.knowledgeCheckedAt),
          exists(
            db
              .select({ id: reels.id })
              .from(reels)
              .where(
                and(
                  eq(reels.topicClusterId, topicClusters.id),
                  gt(reels.createdAt, topicClusters.knowledgeCheckedAt),
                ),
              ),
          ),
        ),
      ),
    );
  return rows.map((r) => r.id);
}

async function markChecked(db: NodePgDatabase<typeof schema>, clusterIds: number[]): Promise<void> {
  if (clusterIds.length === 0) return;
  await db
    .update(topicClusters)
    .set({ knowledgeCheckedAt: new Date() })
    .where(inArray(topicClusters.id, clusterIds));
}

/**
 * Topic-Knowledge-Check pipeline step (T11.6, ADR 0012), run right after
 * clustering (src/lib/pipeline.ts). Two parts, per the epic file's "Kadenz":
 * - `confidence` (T11.2) is cheap/grounded (no LLM) — recomputed for every
 *   active cluster on every run, unconditionally.
 * - `freshness` (T11.3) is gated: only clusters with new members since their
 *   `knowledge_checked_at` (or never checked) are candidates, and the whole
 *   pass is skipped (no LLM call at all) when there are none. Checked
 *   clusters get `knowledge_checked_at = now()` afterwards so an immediate
 *   rerun with nothing new makes no LLM call.
 *
 * Never throws — same never-abort-the-run contract as clustering/skilltagger
 * (src/lib/pipeline.ts wraps this call in its own try/catch regardless, but
 * the internal steps are already per-phase safe via runConfidenceComputation/
 * runFreshnessCheck's own per-item/per-group guards).
 */
export async function runKnowledgeCheck(
  db: NodePgDatabase<typeof schema>,
  caller: StructuredCaller = callStructured,
): Promise<KnowledgeCheckResult> {
  const confidence = await runConfidenceComputation(db);

  const dirtyClusterIds = await loadDirtyClusterIds(db);
  if (dirtyClusterIds.length === 0) {
    return { confidence, freshness: null };
  }

  const freshness = await runFreshnessCheck(db, caller, { clusterIdFilter: dirtyClusterIds });
  await markChecked(db, dirtyClusterIds);

  return { confidence, freshness };
}
