// Integration test against local Postgres: toggle semantics, save/hide flags
// hydration, /saved listing, and the spaced-resurfacing candidate window
// (T6.2/T6.3/T6.5). Seeds its own sources/raw_items/reels (TRUNCATE +
// insert), same pattern as src/lib/feed.test.ts.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { interactions as interactionsTable, rawItems, reels, sources } from "@/db/schema";
import { getReels } from "./feed";
import {
  getInteractionFlags,
  getResurfacingCandidates,
  getSavedReels,
  removeInteraction,
  RESURFACE_MAX_AGE_DAYS,
  RESURFACE_MIN_AGE_DAYS,
  toggleInteraction,
} from "./interactions";

const NOW = new Date("2026-07-23T12:00:00Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

async function seedReel(externalId: string, publishedAt: Date = daysAgo(1)) {
  const [source] = await db()
    .insert(sources)
    .values({ name: `s-${externalId}`, type: "rss", url: "u" })
    .returning();
  const [item] = await db()
    .insert(rawItems)
    .values({
      sourceId: source.id,
      externalId,
      title: `Item ${externalId}`,
      url: `https://example.com/${externalId}`,
      rawContent: "content",
      publishedAt,
      enrichedAt: new Date(),
    })
    .returning();
  const [reel] = await db()
    .insert(reels)
    .values({
      rawItemId: item.id,
      summary: `Summary for ${externalId}`,
      category: "tooling",
      maturity: "established",
      experimental: false,
      relevanceScore: 80,
      qualityScore: 80,
    })
    .returning();
  return reel;
}

async function saveAt(reelId: number, createdAt: Date) {
  await db().insert(interactionsTable).values({ reelId, type: "save", createdAt });
}

describe("interactions (integration)", () => {
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE interactions, reels, raw_items, sources RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("toggleInteraction inserts on first call, deletes on second call (untoggle)", async () => {
    const reel = await seedReel("a");

    const first = await toggleInteraction(reel.id, "save");
    expect(first).toEqual({ active: true });

    const second = await toggleInteraction(reel.id, "save");
    expect(second).toEqual({ active: false });

    const flags = await getInteractionFlags([reel.id]);
    expect(flags.get(reel.id)).toBeUndefined();
  });

  it("toggleInteraction tracks each type independently on the same reel", async () => {
    const reel = await seedReel("b");

    await toggleInteraction(reel.id, "save");
    await toggleInteraction(reel.id, "up");

    const flags = await getInteractionFlags([reel.id]);
    expect(flags.get(reel.id)).toEqual({ save: true, up: true, down: false });
  });

  it("toggleInteraction returns undefined for a non-existent reel", async () => {
    expect(await toggleInteraction(999999, "save")).toBeUndefined();
  });

  it("hide excludes the reel from getReels (T6.2)", async () => {
    const reel = await seedReel("hidden");

    expect((await getReels()).map((r) => r.id)).toContain(reel.id);

    await toggleInteraction(reel.id, "hide");
    expect((await getReels()).map((r) => r.id)).not.toContain(reel.id);

    // Untoggling hide brings it back.
    await toggleInteraction(reel.id, "hide");
    expect((await getReels()).map((r) => r.id)).toContain(reel.id);
  });

  it("getSavedReels lists active saves newest-save-first and removeInteraction retracts one (T6.3)", async () => {
    const first = await seedReel("first");
    const second = await seedReel("second");
    await seedReel("never-saved");

    await toggleInteraction(first.id, "save");
    await toggleInteraction(second.id, "save");

    const saved = await getSavedReels();
    expect(saved.map((r) => r.id)).toEqual([second.id, first.id]);

    await removeInteraction(first.id, "save");
    const afterRemove = await getSavedReels();
    expect(afterRemove.map((r) => r.id)).toEqual([second.id]);
  });

  it("removeInteraction is a no-op when nothing is active", async () => {
    const reel = await seedReel("noop");
    await expect(removeInteraction(reel.id, "save")).resolves.toBeUndefined();
  });

  it("getResurfacingCandidates only includes saves within the 7-21 day window (T6.5)", async () => {
    const tooRecent = await seedReel("too-recent");
    const inWindowOld = await seedReel("in-window-old");
    const inWindowNew = await seedReel("in-window-new");
    const tooOld = await seedReel("too-old");

    await saveAt(tooRecent.id, daysAgo(RESURFACE_MIN_AGE_DAYS - 1)); // 6 days — too recent
    await saveAt(inWindowOld.id, daysAgo(RESURFACE_MAX_AGE_DAYS)); // 21 days — boundary, included
    await saveAt(inWindowNew.id, daysAgo(RESURFACE_MIN_AGE_DAYS)); // 7 days — boundary, included
    await saveAt(tooOld.id, daysAgo(RESURFACE_MAX_AGE_DAYS + 1)); // 22 days — too old

    const candidates = await getResurfacingCandidates(NOW, 10);
    expect(candidates.map((r) => r.id).sort()).toEqual([inWindowOld.id, inWindowNew.id].sort());
  });

  it("getResurfacingCandidates respects the limit and orders oldest-save-first", async () => {
    const a = await seedReel("cand-a");
    const b = await seedReel("cand-b");
    const c = await seedReel("cand-c");

    await saveAt(a.id, daysAgo(10));
    await saveAt(b.id, daysAgo(20));
    await saveAt(c.id, daysAgo(15));

    const candidates = await getResurfacingCandidates(NOW, 2);
    expect(candidates.map((r) => r.id)).toEqual([b.id, c.id]); // oldest save first, limited to 2
  });
});
