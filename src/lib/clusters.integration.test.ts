// Integration test against local Postgres (T11.5 support module): the
// cluster-detail read + "Confirm superseded" write, same pattern as
// src/lib/skilltagger/nodes.integration.test.ts.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, sources, topicClusters } from "@/db/schema";
import { deprecateCluster, getClusterWithMembers } from "./clusters";

async function seedMember(clusterId: number, externalId: string, opts: { isPrimary?: boolean } = {}) {
  const [source] = await db()
    .insert(sources)
    .values({ name: `source-${externalId}`, type: "rss", url: "https://example.com/feed" })
    .returning();
  const [item] = await db()
    .insert(rawItems)
    .values({
      sourceId: source.id,
      externalId,
      title: `Item ${externalId}`,
      url: `https://example.com/${externalId}`,
      rawContent: "content",
      publishedAt: new Date("2026-07-20T10:00:00Z"),
    })
    .returning();
  await db()
    .insert(reels)
    .values({
      rawItemId: item.id,
      summary: "summary",
      category: "tooling",
      maturity: "established",
      experimental: false,
      relevanceScore: 70,
      qualityScore: 90,
      topicClusterId: clusterId,
      isPrimary: opts.isPrimary ?? true,
    });
}

describe("getClusterWithMembers / deprecateCluster (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE topic_clusters, reels, raw_items, sources RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("returns undefined for a non-existent cluster", async () => {
    expect(await getClusterWithMembers(999)).toBeUndefined();
  });

  it("returns the cluster and its members", async () => {
    const [cluster] = await db().insert(topicClusters).values({ title: "Batch command" }).returning();
    await seedMember(cluster.id, "primary-1", { isPrimary: true });
    await seedMember(cluster.id, "echo-1", { isPrimary: false });

    const result = await getClusterWithMembers(cluster.id);
    expect(result?.cluster.title).toBe("Batch command");
    expect(result?.members).toHaveLength(2);
  });

  it("deprecateCluster sets lifecycle_state to deprecated and returns undefined for an unknown id", async () => {
    const [cluster] = await db().insert(topicClusters).values({ title: "Batch command" }).returning();

    const updated = await deprecateCluster(cluster.id);
    expect(updated?.lifecycleState).toBe("deprecated");

    expect(await deprecateCluster(999)).toBeUndefined();
  });
});
