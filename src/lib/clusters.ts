import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { rawItems, reels, sources, topicClusters } from "@/db/schema";
import type { TopicCluster } from "@/db/schema";

/**
 * Data access for topic-cluster detail pages / the T11.5 deprecate action.
 * Separate from src/lib/clustering/run.ts (that module only ever reads
 * *active* clusters within the match window) and from
 * src/lib/knowledge-check/* (those write confidence/freshness) — this is the
 * human-facing read/confirm side (mirrors src/lib/skilltagger/nodes.ts).
 */

export interface ClusterMember {
  id: number;
  title: string;
  url: string;
  sourceName: string;
  publishedAt: Date;
  isPrimary: boolean | null;
}

export interface ClusterWithMembers {
  cluster: TopicCluster;
  members: ClusterMember[];
}

export async function getClusterWithMembers(id: number): Promise<ClusterWithMembers | undefined> {
  const [cluster] = await db().select().from(topicClusters).where(eq(topicClusters.id, id));
  if (!cluster) return undefined;

  const members = await db()
    .select({
      id: reels.id,
      title: rawItems.title,
      url: rawItems.url,
      sourceName: sources.name,
      publishedAt: rawItems.publishedAt,
      isPrimary: reels.isPrimary,
    })
    .from(reels)
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .innerJoin(sources, eq(rawItems.sourceId, sources.id))
    .where(eq(reels.topicClusterId, id))
    .orderBy(desc(rawItems.publishedAt));

  return { cluster, members };
}

/**
 * "Confirm superseded" (T11.5): sets `lifecycle_state = deprecated` for
 * real. The freshness pass (src/lib/knowledge-check/freshness.ts) only ever
 * writes a *proposal* (`superseded_by_cluster_id` + `supersede_reason`) —
 * this is the human-in-the-loop confirmation that actually deprecates the
 * cluster (ADR 0008, no auto-hide).
 */
export async function deprecateCluster(id: number): Promise<TopicCluster | undefined> {
  const [row] = await db()
    .update(topicClusters)
    .set({ lifecycleState: "deprecated" })
    .where(eq(topicClusters.id, id))
    .returning();
  return row;
}
