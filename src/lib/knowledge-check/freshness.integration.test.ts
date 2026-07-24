// Integration test against local Postgres (T11.3 verification): seeds two
// topic clusters sharing a skill (via member reels.skill) plus one unrelated
// cluster on a different skill, and asserts the candidate-pairing + apply
// logic end-to-end with a mocked caller — no real API call.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, sources, topicClusters } from "@/db/schema";
import { loadSkillSharingGroups, runFreshnessCheck, type StructuredCaller } from "./freshness";

async function seedCluster(title: string) {
  const [cluster] = await db().insert(topicClusters).values({ title }).returning();
  return cluster;
}

async function seedMember(
  clusterId: number,
  externalId: string,
  opts: { title?: string; summary?: string; skill?: string | null } = {},
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
      title: opts.title ?? `Item ${externalId}`,
      url: `https://example.com/${externalId}`,
      rawContent: "content",
      publishedAt: new Date("2026-07-20T10:00:00Z"),
    })
    .returning();
  await db()
    .insert(reels)
    .values({
      rawItemId: item.id,
      summary: opts.summary ?? "summary",
      category: "tooling",
      maturity: "established",
      experimental: false,
      relevanceScore: 70,
      qualityScore: 90,
      topicClusterId: clusterId,
      isPrimary: true,
      skill: opts.skill === undefined ? "claude-code-cli" : opts.skill,
    });
}

describe("loadSkillSharingGroups / runFreshnessCheck (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE topic_clusters, reels, raw_items, sources RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("groups clusters that share a skill and excludes a lone cluster on another skill", async () => {
    const batch = await seedCluster("Claude Code batch command");
    await seedMember(batch.id, "batch-1", { skill: "claude-code-cli" });
    const fork = await seedCluster("Claude Code fork command");
    await seedMember(fork.id, "fork-1", { skill: "claude-code-cli" });
    const unrelated = await seedCluster("Totally different skill");
    await seedMember(unrelated.id, "other-1", { skill: "prompt-caching" });

    const groups = await loadSkillSharingGroups(db());
    expect(groups).toHaveLength(1);
    expect(groups[0].skill).toBe("claude-code-cli");
    expect(groups[0].clusters.map((c) => c.id).sort()).toEqual([batch.id, fork.id].sort());
  });

  it("clear supersession: applies superseded_by_cluster_id + reason without touching lifecycle_state", async () => {
    const batch = await seedCluster("Claude Code batch command");
    await seedMember(batch.id, "batch-1", {
      summary: "Introduces the batch flag.",
      skill: "claude-code-cli",
    });
    const fork = await seedCluster("Claude Code fork command");
    await seedMember(fork.id, "fork-1", {
      summary: "Changelog: the fork command replaces the now-deprecated batch flag.",
      skill: "claude-code-cli",
    });

    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      superseded_cluster_id: batch.id,
      superseded_by_cluster_id: fork.id,
      reason: "Changelog states fork replaces the deprecated batch flag.",
    });

    const result = await runFreshnessCheck(db(), caller);
    expect(result).toEqual({ groupsChecked: 1, supersededFound: 1, failed: 0 });

    const [updatedBatch] = await db().select().from(topicClusters).where(eq(topicClusters.id, batch.id));
    expect(updatedBatch.supersededByClusterId).toBe(fork.id);
    expect(updatedBatch.supersedeReason).toBe("Changelog states fork replaces the deprecated batch flag.");
    expect(updatedBatch.lifecycleState).toBe("active"); // T11.5 confirms deprecation, not this pass

    const [updatedFork] = await db().select().from(topicClusters).where(eq(topicClusters.id, fork.id));
    expect(updatedFork.supersededByClusterId).toBeNull();
  });

  it("unrelated topics: no-op, nothing written", async () => {
    const a = await seedCluster("Topic A");
    await seedMember(a.id, "a-1", { skill: "shared-skill" });
    const b = await seedCluster("Topic B");
    await seedMember(b.id, "b-1", { skill: "shared-skill" });

    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      superseded_cluster_id: null,
      superseded_by_cluster_id: null,
      reason: null,
    });

    const result = await runFreshnessCheck(db(), caller);
    expect(result).toEqual({ groupsChecked: 1, supersededFound: 0, failed: 0 });

    const [updatedA] = await db().select().from(topicClusters).where(eq(topicClusters.id, a.id));
    expect(updatedA.supersededByClusterId).toBeNull();
    expect(updatedA.supersedeReason).toBeNull();
  });

  it("ignores a model-invented id outside the candidate group", async () => {
    const a = await seedCluster("Topic A");
    await seedMember(a.id, "a-1", { skill: "shared-skill" });
    const b = await seedCluster("Topic B");
    await seedMember(b.id, "b-1", { skill: "shared-skill" });

    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      superseded_cluster_id: a.id,
      superseded_by_cluster_id: 999999, // not in the candidate group
      reason: "invented",
    });

    const result = await runFreshnessCheck(db(), caller);
    expect(result.supersededFound).toBe(0);

    const [updatedA] = await db().select().from(topicClusters).where(eq(topicClusters.id, a.id));
    expect(updatedA.supersededByClusterId).toBeNull();
  });

  it("clusterIdFilter restricts to groups touching a dirty cluster id (T11.6 gating seam)", async () => {
    const batch = await seedCluster("Claude Code batch command");
    await seedMember(batch.id, "batch-1", { skill: "claude-code-cli" });
    const fork = await seedCluster("Claude Code fork command");
    await seedMember(fork.id, "fork-1", { skill: "claude-code-cli" });
    const other1 = await seedCluster("Other topic 1");
    await seedMember(other1.id, "other-1", { skill: "unrelated-skill" });
    const other2 = await seedCluster("Other topic 2");
    await seedMember(other2.id, "other-2", { skill: "unrelated-skill" });

    const groups = await loadSkillSharingGroups(db(), [fork.id]);
    expect(groups).toHaveLength(1);
    expect(groups[0].clusters.map((c) => c.id).sort()).toEqual([batch.id, fork.id].sort());
  });

  it("a failing group is skipped without aborting the sweep", async () => {
    const a = await seedCluster("Topic A");
    await seedMember(a.id, "a-1", { skill: "skill-a" });
    const b = await seedCluster("Topic B");
    await seedMember(b.id, "b-1", { skill: "skill-a" });
    const c = await seedCluster("Topic C");
    await seedMember(c.id, "c-1", { skill: "skill-b" });
    const d = await seedCluster("Topic D");
    await seedMember(d.id, "d-1", { skill: "skill-b" });

    let call = 0;
    const caller: StructuredCaller = vi.fn().mockImplementation(async () => {
      call++;
      if (call === 1) throw new Error("boom");
      return { superseded_cluster_id: null, superseded_by_cluster_id: null, reason: null };
    });

    const result = await runFreshnessCheck(db(), caller);
    expect(result).toEqual({ groupsChecked: 2, supersededFound: 0, failed: 1 });
  });
});
