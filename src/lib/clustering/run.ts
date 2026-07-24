import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { rawItems, reels, sources, topicClusters } from "@/db/schema";
import { callStructured } from "@/lib/claude";
import { env } from "@/lib/env";
import { assignCluster, type CandidateCluster, type ClusterResult, type StructuredCaller } from "./cluster";

export type { StructuredCaller } from "./cluster";

export interface ClusteringResult {
  processed: number;
  matched: number;
  proposed: number;
  failed: number;
}

interface PendingReel {
  id: number;
  title: string;
  summary: string;
  sourceName: string;
}

/**
 * Active candidate clusters (T15.2): those matched within CLUSTER_WINDOW_DAYS,
 * capped at MAX_CLUSTER_CANDIDATES, each with the source names of its
 * current members (context for the is_primary judgement).
 */
async function loadActiveClusters(
  db: NodePgDatabase<typeof schema>,
): Promise<CandidateCluster[]> {
  const cutoff = new Date(Date.now() - env().CLUSTER_WINDOW_DAYS * 86_400_000);
  const clusterRows = await db
    .select({ id: topicClusters.id, title: topicClusters.title })
    .from(topicClusters)
    .where(gte(topicClusters.lastMatchedAt, cutoff))
    .orderBy(desc(topicClusters.lastMatchedAt))
    .limit(env().MAX_CLUSTER_CANDIDATES);

  if (clusterRows.length === 0) return [];

  const clusterIds = clusterRows.map((c) => c.id);
  const memberRows = await db
    .select({ clusterId: reels.topicClusterId, sourceName: sources.name })
    .from(reels)
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .innerJoin(sources, eq(rawItems.sourceId, sources.id))
    .where(inArray(reels.topicClusterId, clusterIds));

  const membersByCluster = new Map<number, string[]>();
  for (const row of memberRows) {
    if (row.clusterId === null) continue;
    const list = membersByCluster.get(row.clusterId) ?? [];
    list.push(row.sourceName);
    membersByCluster.set(row.clusterId, list);
  }

  return clusterRows.map((c) => ({
    id: c.id,
    title: c.title,
    memberSourceNames: membersByCluster.get(c.id) ?? [],
  }));
}

/**
 * Gated (T15.2): only reels that are actually displayed (quality_score >=
 * QUALITY_THRESHOLD) and not yet clustered. Idempotent — a reel with
 * topic_cluster_id set is never re-processed.
 */
async function loadPendingReels(db: NodePgDatabase<typeof schema>): Promise<PendingReel[]> {
  return db
    .select({ id: reels.id, title: rawItems.title, summary: reels.summary, sourceName: sources.name })
    .from(reels)
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .innerJoin(sources, eq(rawItems.sourceId, sources.id))
    .where(and(isNull(reels.topicClusterId), gte(reels.qualityScore, env().QUALITY_THRESHOLD)));
}

/**
 * Applies a cluster decision: `match` sets the reel's cluster + is_primary
 * and bumps the cluster's last_matched_at (keeps it in the active window);
 * `propose` creates a new cluster and assigns the reel to it as its first
 * (primary) member. Also mirrors the change into the in-memory candidate
 * map so later reels in the same sweep see it — see runClustering.
 */
async function applyResult(
  db: NodePgDatabase<typeof schema>,
  reelId: number,
  sourceName: string,
  result: ClusterResult,
  candidatesById: Map<number, CandidateCluster>,
): Promise<void> {
  if ("match" in result) {
    await db
      .update(reels)
      .set({ topicClusterId: result.match.clusterId, isPrimary: result.match.isPrimary })
      .where(eq(reels.id, reelId));
    await db
      .update(topicClusters)
      .set({ lastMatchedAt: new Date() })
      .where(eq(topicClusters.id, result.match.clusterId));

    candidatesById.get(result.match.clusterId)?.memberSourceNames.push(sourceName);
    return;
  }

  const [cluster] = await db
    .insert(topicClusters)
    .values({ title: result.propose.title })
    .returning({ id: topicClusters.id, title: topicClusters.title });
  await db.update(reels).set({ topicClusterId: cluster.id, isPrimary: true }).where(eq(reels.id, reelId));

  candidatesById.set(cluster.id, { id: cluster.id, title: cluster.title, memberSourceNames: [sourceName] });
}

/**
 * Batch sweep (T15.2/T15.3): clusters every displayed reel with
 * `topic_cluster_id IS NULL`, idempotent (a rerun with nothing new to
 * cluster processes 0). This is both the daily-job stage (after enrichment +
 * SkillTagger, see src/lib/pipeline.ts) and, per README §1, tolerant of
 * per-item failure — one reel's failure never aborts the run.
 *
 * The active-cluster candidate list is loaded once, then kept up to date
 * in-memory as reels are processed within this same run: a cluster proposed
 * earlier in the sweep is visible as a match candidate for a later reel in
 * the same sweep (needed so multiple same-run sources covering a brand-new
 * story land in one cluster instead of each spawning its own — see
 * docs/plan/epic-15-topic-clustering.md "Abweichungen/Fragen").
 */
export async function runClustering(
  db: NodePgDatabase<typeof schema>,
  caller: StructuredCaller = callStructured,
): Promise<ClusteringResult> {
  const items = await loadPendingReels(db);
  const candidates = await loadActiveClusters(db);
  const candidatesById = new Map(candidates.map((c) => [c.id, c]));

  let matched = 0;
  let proposed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const result = await assignCluster(
        { title: item.title, summary: item.summary, sourceName: item.sourceName },
        [...candidatesById.values()],
        caller,
      );
      await applyResult(db, item.id, item.sourceName, result, candidatesById);
      if ("match" in result) matched++;
      else proposed++;
    } catch (error) {
      failed++;
      console.error(`[clustering] reel ${item.id} failed:`, error);
    }
  }

  return { processed: items.length, matched, proposed, failed };
}
