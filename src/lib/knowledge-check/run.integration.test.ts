// Integration test against local Postgres (T11.6 verification): after a run,
// confidence is set on active clusters; a second run with no new cluster
// members makes no additional LLM (freshness) call — same "no-op on rerun"
// assertion style as src/lib/clustering/run.integration.test.ts (assert the
// mocked caller's call count).
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, sources, topicClusters } from "@/db/schema";
import { runKnowledgeCheck, type StructuredCaller } from "./run";

async function seedCluster(title: string) {
  const [cluster] = await db().insert(topicClusters).values({ title }).returning();
  return cluster;
}

async function seedMember(
  clusterId: number,
  externalId: string,
  opts: { skill?: string | null; isPrimary?: boolean } = {},
) {
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
      skill: opts.skill === undefined ? "shared-skill" : opts.skill,
    });
}

describe("runKnowledgeCheck (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE topic_clusters, reels, raw_items, sources RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("sets confidence on active clusters and runs the freshness pass once for never-checked clusters", async () => {
    const a = await seedCluster("Topic A");
    await seedMember(a.id, "a-1");
    const b = await seedCluster("Topic B");
    await seedMember(b.id, "b-1");

    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      superseded_cluster_id: null,
      superseded_by_cluster_id: null,
      reason: null,
    });

    const result = await runKnowledgeCheck(db(), caller);

    expect(result.confidence).toHaveLength(2);
    expect(result.freshness).toEqual({ groupsChecked: 1, supersededFound: 0, failed: 0 });
    expect(caller).toHaveBeenCalledTimes(1);

    const [updatedA] = await db().select().from(topicClusters).where(eq(topicClusters.id, a.id));
    expect(updatedA.confidence).toBe("few");
    expect(updatedA.knowledgeCheckedAt).not.toBeNull();
  });

  it("a second run with no new members makes no additional LLM call, but still recomputes confidence", async () => {
    const a = await seedCluster("Topic A");
    await seedMember(a.id, "a-1");
    const b = await seedCluster("Topic B");
    await seedMember(b.id, "b-1");

    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      superseded_cluster_id: null,
      superseded_by_cluster_id: null,
      reason: null,
    });

    const first = await runKnowledgeCheck(db(), caller);
    expect(first.freshness).not.toBeNull();
    expect(caller).toHaveBeenCalledTimes(1);

    const second = await runKnowledgeCheck(db(), caller);
    expect(second.freshness).toBeNull(); // skipped entirely — no dirty clusters
    expect(second.confidence).toHaveLength(2); // still recomputed, cheap/grounded
    expect(caller).toHaveBeenCalledTimes(1); // no additional LLM call
  });

  it("a cluster with a brand-new member becomes dirty again and triggers one more freshness call", async () => {
    const a = await seedCluster("Topic A");
    await seedMember(a.id, "a-1");
    const b = await seedCluster("Topic B");
    await seedMember(b.id, "b-1");

    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      superseded_cluster_id: null,
      superseded_by_cluster_id: null,
      reason: null,
    });

    await runKnowledgeCheck(db(), caller);
    expect(caller).toHaveBeenCalledTimes(1);

    // A new member joins cluster A after the check ran.
    await seedMember(a.id, "a-2");

    await runKnowledgeCheck(db(), caller);
    expect(caller).toHaveBeenCalledTimes(2);
  });

  it("skips the freshness pass entirely (no LLM call) when no cluster shares a skill with another", async () => {
    const solo = await seedCluster("Solo topic");
    await seedMember(solo.id, "solo-1", { skill: "unique-skill" });

    const caller: StructuredCaller = vi.fn();

    const result = await runKnowledgeCheck(db(), caller);
    // Dirty (never checked), but loadSkillSharingGroups finds no >= 2-cluster
    // group for "unique-skill", so runFreshnessCheck itself makes no call —
    // still returns a (zero) result object, not null, since the cluster WAS
    // a dirty candidate that got its knowledge_checked_at bumped.
    expect(result.freshness).toEqual({ groupsChecked: 0, supersededFound: 0, failed: 0 });
    expect(caller).not.toHaveBeenCalled();

    const [updated] = await db().select().from(topicClusters).where(eq(topicClusters.id, solo.id));
    expect(updated.knowledgeCheckedAt).not.toBeNull();
  });
});
