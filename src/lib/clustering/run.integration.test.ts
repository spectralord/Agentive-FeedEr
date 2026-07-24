// Integration test against local Postgres (T15.2/T15.3 verification): match
// assigns a reel to an existing cluster, propose creates a new cluster and
// assigns the reel as its first (primary) member, a rerun is idempotent.
// Uses a mocked caller — no real API call.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, sources, topicClusters } from "@/db/schema";
import { env } from "@/lib/env";
import { runClustering, type StructuredCaller } from "./run";

async function seedReel(
  externalId: string,
  opts: { sourceName?: string; summary?: string; qualityScore?: number; publishedAt?: Date } = {},
) {
  const [source] = await db()
    .insert(sources)
    .values({ name: opts.sourceName ?? `test-${externalId}`, type: "rss", url: "https://example.com/feed" })
    .returning();
  const [item] = await db()
    .insert(rawItems)
    .values({
      sourceId: source.id,
      externalId,
      title: `Item ${externalId}`,
      url: `https://example.com/${externalId}`,
      rawContent: "content",
      publishedAt: opts.publishedAt ?? new Date("2026-07-20T10:00:00Z"),
    })
    .returning();
  const [reel] = await db()
    .insert(reels)
    .values({
      rawItemId: item.id,
      summary: opts.summary ?? "A text about a specific topic.",
      category: "tooling",
      maturity: "established",
      experimental: false,
      relevanceScore: 70,
      qualityScore: opts.qualityScore ?? env().QUALITY_THRESHOLD + 10,
    })
    .returning();
  return reel;
}

describe("runClustering (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE topic_clusters, reels, raw_items, sources RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("match: assigns the reel to the matched existing cluster and bumps last_matched_at", async () => {
    const [cluster] = await db()
      .insert(topicClusters)
      .values({ title: "Claude Code batch command", lastMatchedAt: new Date("2026-06-01T00:00:00Z") })
      .returning();
    const reel = await seedReel("match-1");
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_cluster_id: cluster.id,
      propose_title: null,
      is_primary: true,
    });

    const result = await runClustering(db(), caller);
    expect(result).toEqual({ processed: 1, matched: 1, proposed: 0, failed: 0 });

    const [updated] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(updated.topicClusterId).toBe(cluster.id);
    expect(updated.isPrimary).toBe(true);

    const [updatedCluster] = await db().select().from(topicClusters).where(eq(topicClusters.id, cluster.id));
    expect(updatedCluster.lastMatchedAt.getTime()).toBeGreaterThan(new Date("2026-06-01T00:00:00Z").getTime());
  });

  it("propose: creates a new cluster and assigns the reel as its primary member", async () => {
    const reel = await seedReel("propose-1");
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "propose",
      match_cluster_id: null,
      propose_title: "Brand new topic",
      is_primary: false, // deliberately inconsistent — must be ignored, see cluster.test.ts
    });

    const result = await runClustering(db(), caller);
    expect(result).toEqual({ processed: 1, matched: 0, proposed: 1, failed: 0 });

    const [updated] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(updated.topicClusterId).not.toBeNull();
    expect(updated.isPrimary).toBe(true); // first member is primary by definition, regardless of model output

    const [newCluster] = await db()
      .select()
      .from(topicClusters)
      .where(eq(topicClusters.id, updated.topicClusterId as number));
    expect(newCluster.title).toBe("Brand new topic");
  });

  it("is idempotent: a rerun with nothing new to cluster processes 0", async () => {
    const [cluster] = await db().insert(topicClusters).values({ title: "Existing topic" }).returning();
    await seedReel("idem-1");
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_cluster_id: cluster.id,
      propose_title: null,
      is_primary: true,
    });

    await runClustering(db(), caller);
    const rerun = await runClustering(db(), caller);
    expect(rerun).toEqual({ processed: 0, matched: 0, proposed: 0, failed: 0 });
    expect(caller).toHaveBeenCalledTimes(1);
  });

  it("gates on quality_score >= QUALITY_THRESHOLD: a low-quality reel is left untouched", async () => {
    const reel = await seedReel("weak-1", { qualityScore: env().QUALITY_THRESHOLD - 10 });
    const caller: StructuredCaller = vi.fn();

    const result = await runClustering(db(), caller);
    expect(result).toEqual({ processed: 0, matched: 0, proposed: 0, failed: 0 });
    expect(caller).not.toHaveBeenCalled();

    const [unchanged] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(unchanged.topicClusterId).toBeNull();
  });

  it("a failing item is skipped without aborting the run, and stays unclustered for retry", async () => {
    await seedReel("fail-1");
    const okReel = await seedReel("ok-1");
    const cluster = { id: 999 }; // any id — caller will alternate outcomes below
    void cluster;

    let call = 0;
    const caller: StructuredCaller = vi.fn().mockImplementation(async () => {
      call++;
      if (call === 1) throw new Error("boom");
      return {
        decision: "propose",
        match_cluster_id: null,
        propose_title: "Recovered topic",
        is_primary: true,
      };
    });

    const result = await runClustering(db(), caller);
    expect(result).toEqual({ processed: 2, matched: 0, proposed: 1, failed: 1 });

    const [okUpdated] = await db().select().from(reels).where(eq(reels.id, okReel.id));
    expect(okUpdated.topicClusterId).not.toBeNull();
  });

  it("a cluster proposed earlier in the same sweep is visible as a match candidate for a later reel in the same sweep", async () => {
    await seedReel("first", { sourceName: "source-a", summary: "Coverage of a brand-new specific story." });
    const second = await seedReel("second", { sourceName: "source-b", summary: "Independent coverage of the same specific story." });

    let call = 0;
    const caller: StructuredCaller = vi.fn().mockImplementation(async (opts: { user: string }) => {
      call++;
      if (call === 1) {
        return { decision: "propose", match_cluster_id: null, propose_title: "The new story", is_primary: true };
      }
      // Second call should see the cluster just created by the first call.
      expect(opts.user).toContain("The new story");
      const match = /\[id (\d+)\] The new story/.exec(opts.user);
      return { decision: "match", match_cluster_id: match ? Number(match[1]) : null, propose_title: null, is_primary: true };
    });

    const result = await runClustering(db(), caller);
    expect(result).toEqual({ processed: 2, matched: 1, proposed: 1, failed: 0 });

    const [secondUpdated] = await db().select().from(reels).where(eq(reels.id, second.id));
    expect(secondUpdated.topicClusterId).not.toBeNull();

    const clustersInDb = await db().select().from(topicClusters);
    expect(clustersInDb).toHaveLength(1); // both reels landed in the same cluster, not two
  });
});
