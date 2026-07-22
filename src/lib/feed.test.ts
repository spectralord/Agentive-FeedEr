// Integration test against local Postgres: verifies each filter dimension of
// getReels() and the combination used by pagination ("Mehr laden").
// Seeds its own sources/raw_items/reels (TRUNCATE + insert) — see epic-3 notes
// on why this is acceptable even though it clears any externally seeded reels.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, sources } from "@/db/schema";
import { env } from "@/lib/env";
import { getReels } from "./feed";

const NOW = new Date("2026-07-22T12:00:00Z");

interface SeedSpec {
  externalId: string;
  publishedAt: Date;
  category: "claude-feature" | "tooling" | "technique" | "industry-news" | "research" | "opinion";
  qualityScore: number;
  example?: string | null;
  action?: string | null;
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
      publishedAt: spec.publishedAt,
      enrichedAt: new Date(),
    })
    .returning();

  await db()
    .insert(reels)
    .values({
      rawItemId: item.id,
      summary: `Summary for ${spec.externalId}`,
      category: spec.category,
      maturity: "established",
      experimental: false,
      relevanceScore: 50,
      qualityScore: spec.qualityScore,
      example: spec.example ?? null,
      action: spec.action ?? null,
    });

  return item;
}

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

describe("getReels (integration)", () => {
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE reels, raw_items, sources RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("hides low-quality reels by default and reveals them with showWeak", async () => {
    const [source] = await db().insert(sources).values({ name: "s", type: "rss", url: "u" }).returning();
    await seedReel(source.id, {
      externalId: "strong",
      publishedAt: daysAgo(1),
      category: "tooling",
      qualityScore: env().QUALITY_THRESHOLD + 10,
    });
    await seedReel(source.id, {
      externalId: "weak",
      publishedAt: daysAgo(1),
      category: "tooling",
      qualityScore: env().QUALITY_THRESHOLD - 10,
    });

    const defaultResult = await getReels();
    expect(defaultResult.map((r) => r.rawItemId).sort()).toEqual([1]);

    const withWeak = await getReels({ showWeak: true });
    expect(withWeak).toHaveLength(2);
  });

  it("filters by exact category and ignores unknown category values", async () => {
    const [source] = await db().insert(sources).values({ name: "s", type: "rss", url: "u" }).returning();
    await seedReel(source.id, {
      externalId: "a",
      publishedAt: daysAgo(1),
      category: "tooling",
      qualityScore: 90,
    });
    await seedReel(source.id, {
      externalId: "b",
      publishedAt: daysAgo(1),
      category: "research",
      qualityScore: 90,
    });

    const tooling = await getReels({ category: "tooling" });
    expect(tooling).toHaveLength(1);
    expect(tooling[0].category).toBe("tooling");

    const unknown = await getReels({ category: "not-a-real-category" });
    expect(unknown).toHaveLength(2); // filter silently ignored, not an empty result
  });

  it("onlyNew restricts to published_at within NEW_DAYS", async () => {
    const [source] = await db().insert(sources).values({ name: "s", type: "rss", url: "u" }).returning();
    await seedReel(source.id, {
      externalId: "recent",
      publishedAt: new Date(Date.now() - 1 * 86_400_000),
      category: "tooling",
      qualityScore: 90,
    });
    await seedReel(source.id, {
      externalId: "old",
      publishedAt: new Date(Date.now() - (env().NEW_DAYS + 5) * 86_400_000),
      category: "tooling",
      qualityScore: 90,
    });

    const onlyNew = await getReels({ onlyNew: true });
    expect(onlyNew.map((r) => r.rawItemId)).toEqual([1]);

    const all = await getReels({});
    expect(all).toHaveLength(2);
  });

  it("orders newest first and paginates via before without duplicates or gaps", async () => {
    const [source] = await db().insert(sources).values({ name: "s", type: "rss", url: "u" }).returning();
    for (let i = 0; i < 5; i++) {
      await seedReel(source.id, {
        externalId: `item-${i}`,
        publishedAt: daysAgo(i), // item-0 newest, item-4 oldest
        category: "tooling",
        qualityScore: 90,
      });
    }

    const firstPage = await getReels({ limit: 2 });
    expect(firstPage.map((r) => r.title)).toEqual(["Item item-0", "Item item-1"]);

    const cursor = firstPage[firstPage.length - 1].publishedAt;
    const secondPage = await getReels({ limit: 2, before: cursor });
    expect(secondPage.map((r) => r.title)).toEqual(["Item item-2", "Item item-3"]);

    const thirdPage = await getReels({ limit: 2, before: secondPage[secondPage.length - 1].publishedAt });
    expect(thirdPage.map((r) => r.title)).toEqual(["Item item-4"]);

    // No duplicates, no gaps across all pages combined.
    const combinedIds = [...firstPage, ...secondPage, ...thirdPage].map((r) => r.rawItemId);
    expect(new Set(combinedIds).size).toBe(5);
  });

  it("joins source name and raw item fields, defaults limit to 50", async () => {
    const [source] = await db().insert(sources).values({ name: "my-source", type: "rss", url: "u" }).returning();
    await seedReel(source.id, {
      externalId: "x",
      publishedAt: daysAgo(1),
      category: "tooling",
      qualityScore: 90,
      example: "const x = 1;",
      action: "Do the thing",
    });

    const [reel] = await getReels();
    expect(reel.sourceName).toBe("my-source");
    expect(reel.title).toBe("Item x");
    expect(reel.url).toBe("https://example.com/x");
    expect(reel.example).toBe("const x = 1;");
    expect(reel.action).toBe("Do the thing");
  });
});
