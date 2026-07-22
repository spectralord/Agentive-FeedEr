// Integration test against local Postgres: verifies the Today's Top-N
// candidate window + 24h/48h fallback logic (T4.2). Seeds its own
// sources/raw_items/reels (TRUNCATE + insert), same pattern as feed.test.ts.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, sources } from "@/db/schema";
import { env } from "@/lib/env";
import { getTodayTopReels } from "./today";

const NOW = new Date("2026-07-22T12:00:00Z");

interface SeedSpec {
  externalId: string;
  ingestedAt: Date;
  publishedAt?: Date;
  relevanceScore: number;
  qualityScore: number;
}

async function seedReel(sourceId: number, spec: SeedSpec) {
  const [item] = await db()
    .insert(rawItems)
    .values({
      sourceId,
      externalId: spec.externalId,
      title: `Item ${spec.externalId}`,
      url: `https://example.com/${spec.externalId}`,
      rawContent: "content",
      publishedAt: spec.publishedAt ?? spec.ingestedAt,
      ingestedAt: spec.ingestedAt,
      enrichedAt: new Date(),
    })
    .returning();

  await db()
    .insert(reels)
    .values({
      rawItemId: item.id,
      summary: `Summary for ${spec.externalId}`,
      category: "tooling",
      maturity: "established",
      experimental: false,
      relevanceScore: spec.relevanceScore,
      qualityScore: spec.qualityScore,
    });

  return item;
}

function hoursAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 3_600_000);
}

describe("getTodayTopReels (integration)", () => {
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE reels, raw_items, sources RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("ranks candidates ingested within 24h by topScore, no fallback needed", async () => {
    const [source] = await db().insert(sources).values({ name: "s", type: "rss", url: "u" }).returning();
    // 4 candidates within 24h (>= TOP_N=3): weakest score should be dropped.
    await seedReel(source.id, { externalId: "best", ingestedAt: hoursAgo(1), relevanceScore: 100, qualityScore: 100 });
    await seedReel(source.id, { externalId: "mid", ingestedAt: hoursAgo(2), relevanceScore: 80, qualityScore: 80 });
    await seedReel(source.id, { externalId: "low", ingestedAt: hoursAgo(3), relevanceScore: 65, qualityScore: 65 });
    await seedReel(source.id, { externalId: "weakest", ingestedAt: hoursAgo(4), relevanceScore: 61, qualityScore: 61 });

    const result = await getTodayTopReels(NOW);

    expect(result.usedFallback).toBe(false);
    expect(result.reels).toHaveLength(env().TOP_N);
    expect(result.reels.map((r) => r.title)).toEqual(["Item best", "Item mid", "Item low"]);
  });

  it("excludes reels below QUALITY_THRESHOLD from candidates", async () => {
    const [source] = await db().insert(sources).values({ name: "s", type: "rss", url: "u" }).returning();
    await seedReel(source.id, {
      externalId: "weak",
      ingestedAt: hoursAgo(1),
      relevanceScore: 90,
      qualityScore: env().QUALITY_THRESHOLD - 1,
    });

    const result = await getTodayTopReels(NOW);
    expect(result.reels).toHaveLength(0);
  });

  it("widens to 48h and flags usedFallback when 24h yields fewer than TOP_N", async () => {
    const [source] = await db().insert(sources).values({ name: "s", type: "rss", url: "u" }).returning();
    // Only 1 candidate within 24h.
    await seedReel(source.id, { externalId: "recent", ingestedAt: hoursAgo(2), relevanceScore: 90, qualityScore: 90 });
    // 2 more show up only once the window widens to 48h.
    await seedReel(source.id, { externalId: "yesterday-1", ingestedAt: hoursAgo(30), relevanceScore: 85, qualityScore: 85 });
    await seedReel(source.id, { externalId: "yesterday-2", ingestedAt: hoursAgo(40), relevanceScore: 80, qualityScore: 80 });
    // Outside even the 48h window — must never appear.
    await seedReel(source.id, { externalId: "too-old", ingestedAt: hoursAgo(50), relevanceScore: 99, qualityScore: 99 });

    const result = await getTodayTopReels(NOW);

    expect(result.usedFallback).toBe(true);
    expect(result.reels.map((r) => r.title).sort()).toEqual(
      ["Item recent", "Item yesterday-1", "Item yesterday-2"].sort(),
    );
    expect(result.reels.map((r) => r.title)).not.toContain("Item too-old");
  });

  it("returns an empty result when there are no candidates in either window", async () => {
    const [source] = await db().insert(sources).values({ name: "s", type: "rss", url: "u" }).returning();
    await seedReel(source.id, { externalId: "ancient", ingestedAt: hoursAgo(200), relevanceScore: 99, qualityScore: 99 });

    const result = await getTodayTopReels(NOW);

    expect(result.usedFallback).toBe(true);
    expect(result.reels).toHaveLength(0);
  });
});
