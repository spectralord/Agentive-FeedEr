// Integration test against local Postgres (T11.2 verification): seeds cluster
// members with a primary/echo (reblog) mix and asserts the resulting
// confidence scale + independent_count. Experience-report corroboration
// (T11.7) is out of scope — reels only, per epic-11 "Abweichungen/Fragen".
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, sources, topicClusters } from "@/db/schema";
import { confidenceForCount, computeConfidenceForActiveClusters, runConfidenceComputation } from "./confidence";

async function seedCluster(title: string, lifecycleState: "active" | "deprecated" = "active") {
  const [cluster] = await db().insert(topicClusters).values({ title, lifecycleState }).returning();
  return cluster;
}

async function seedMember(
  clusterId: number,
  externalId: string,
  opts: { sourceName?: string; isPrimary?: boolean } = {},
) {
  const sourceName = opts.sourceName ?? `source-${externalId}`;
  const [existing] = await db().select().from(sources).where(eq(sources.name, sourceName));
  const source =
    existing ??
    (await db()
      .insert(sources)
      .values({ name: sourceName, type: "rss", url: "https://example.com/feed" })
      .returning()
      .then((rows) => rows[0]));
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

describe("confidenceForCount (pure mapping, defaults CONF_SOME_MIN=2/CONF_STRONG_MIN=4)", () => {
  it("maps below CONF_SOME_MIN to few", () => {
    expect(confidenceForCount(0)).toBe("few");
    expect(confidenceForCount(1)).toBe("few");
  });

  it("maps CONF_SOME_MIN..CONF_STRONG_MIN-1 to some", () => {
    expect(confidenceForCount(2)).toBe("some");
    expect(confidenceForCount(3)).toBe("some");
  });

  it("maps >= CONF_STRONG_MIN to strong", () => {
    expect(confidenceForCount(4)).toBe("strong");
    expect(confidenceForCount(10)).toBe("strong");
  });
});

describe("computeConfidenceForActiveClusters / runConfidenceComputation (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE topic_clusters, reels, raw_items, sources RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("counts distinct independent (is_primary=true) sources, ignoring reblogs", async () => {
    const cluster = await seedCluster("Claude Code batch command");
    // Two independent sources...
    await seedMember(cluster.id, "primary-1", { sourceName: "anthropic-blog", isPrimary: true });
    await seedMember(cluster.id, "primary-2", { sourceName: "hn", isPrimary: true });
    // ...and two echoes that must NOT inflate the count.
    await seedMember(cluster.id, "echo-1", { sourceName: "aggregator-a", isPrimary: false });
    await seedMember(cluster.id, "echo-2", { sourceName: "aggregator-b", isPrimary: false });

    const results = await computeConfidenceForActiveClusters(db());
    expect(results).toEqual([{ clusterId: cluster.id, independentCount: 2, confidence: "some" }]);
  });

  it("a single independent source yields few", async () => {
    const cluster = await seedCluster("Solo topic");
    await seedMember(cluster.id, "primary-1", { sourceName: "anthropic-blog", isPrimary: true });

    const results = await computeConfidenceForActiveClusters(db());
    expect(results).toEqual([{ clusterId: cluster.id, independentCount: 1, confidence: "few" }]);
  });

  it("four or more independent sources yields strong", async () => {
    const cluster = await seedCluster("Widely corroborated topic");
    for (const name of ["a", "b", "c", "d"]) {
      await seedMember(cluster.id, `primary-${name}`, { sourceName: `source-${name}`, isPrimary: true });
    }

    const results = await computeConfidenceForActiveClusters(db());
    expect(results).toEqual([{ clusterId: cluster.id, independentCount: 4, confidence: "strong" }]);
  });

  it("the same independent source appearing twice is not double-counted", async () => {
    const cluster = await seedCluster("Repeated source topic");
    await seedMember(cluster.id, "primary-1", { sourceName: "anthropic-blog", isPrimary: true });
    await seedMember(cluster.id, "primary-2", { sourceName: "anthropic-blog", isPrimary: true });

    const results = await computeConfidenceForActiveClusters(db());
    expect(results).toEqual([{ clusterId: cluster.id, independentCount: 1, confidence: "few" }]);
  });

  it("skips deprecated clusters (confidence stays frozen, not recomputed)", async () => {
    const cluster = await seedCluster("Deprecated topic", "deprecated");
    await seedMember(cluster.id, "primary-1", { sourceName: "anthropic-blog", isPrimary: true });
    await seedMember(cluster.id, "primary-2", { sourceName: "hn", isPrimary: true });

    const results = await computeConfidenceForActiveClusters(db());
    expect(results).toEqual([]);
  });

  it("runConfidenceComputation persists confidence + independent_count onto topic_clusters", async () => {
    const cluster = await seedCluster("Persisted topic");
    await seedMember(cluster.id, "primary-1", { sourceName: "anthropic-blog", isPrimary: true });
    await seedMember(cluster.id, "primary-2", { sourceName: "hn", isPrimary: true });
    await seedMember(cluster.id, "primary-3", { sourceName: "reddit", isPrimary: true });

    await runConfidenceComputation(db());

    const [updated] = await db().select().from(topicClusters).where(eq(topicClusters.id, cluster.id));
    expect(updated.confidence).toBe("some");
    expect(updated.independentCount).toBe(3);
  });
});
