// Integration test against local Postgres (T10.3 verification): a new,
// displayed reel gets checked (caveat set or null) after a run; a second run
// with nothing new to check processes 0. Uses a mocked caller — no real API
// call.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, sources } from "@/db/schema";
import { runVerifier, type StructuredCaller } from "./run";

async function seedReel(
  externalId: string,
  opts: { qualityScore?: number; summary?: string } = {},
) {
  const [source] = await db()
    .insert(sources)
    .values({ name: `test-${externalId}`, type: "rss", url: "https://example.com/feed" })
    .returning();
  const [item] = await db()
    .insert(rawItems)
    .values({
      sourceId: source.id,
      externalId,
      title: `Item ${externalId}`,
      url: `https://example.com/${externalId}`,
      rawContent: "The source says it is 10% faster on one benchmark.",
      publishedAt: new Date("2026-07-20T10:00:00Z"),
    })
    .returning();
  const [reel] = await db()
    .insert(reels)
    .values({
      rawItemId: item.id,
      summary: opts.summary ?? "It is 10% faster on one benchmark.",
      category: "tooling",
      maturity: "established",
      experimental: false,
      relevanceScore: 70,
      qualityScore: opts.qualityScore ?? 70,
    })
    .returning();
  return reel;
}

describe("runVerifier (integration)", () => {
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE reels, raw_items, sources RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("checks a new displayed reel and sets caveat + caveat_checked_at", async () => {
    const reel = await seedReel("v-1");
    const caller: StructuredCaller = vi
      .fn()
      .mockResolvedValue({ caveat: "Summary overclaims: source says 10% on one benchmark, not universally faster." });

    const result = await runVerifier(db(), caller);
    expect(result).toEqual({ processed: 1, flagged: 1, failed: 0 });

    const [updated] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(updated.caveat).toBe(
      "Summary overclaims: source says 10% on one benchmark, not universally faster.",
    );
    expect(updated.caveatCheckedAt).not.toBeNull();
  });

  it("sets caveat_checked_at even when no caveat is found (null is a valid, checked result)", async () => {
    const reel = await seedReel("v-2");
    const caller: StructuredCaller = vi.fn().mockResolvedValue({ caveat: null });

    const result = await runVerifier(db(), caller);
    expect(result).toEqual({ processed: 1, flagged: 0, failed: 0 });

    const [updated] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(updated.caveat).toBeNull();
    expect(updated.caveatCheckedAt).not.toBeNull();
  });

  it("is idempotent: a second run with nothing new to check processes 0", async () => {
    await seedReel("v-3");
    const caller: StructuredCaller = vi.fn().mockResolvedValue({ caveat: null });

    await runVerifier(db(), caller);
    const rerun = await runVerifier(db(), caller);
    expect(rerun).toEqual({ processed: 0, flagged: 0, failed: 0 });
    expect(caller).toHaveBeenCalledTimes(1);
  });

  it("does not check a reel below the quality threshold (not displayed)", async () => {
    await seedReel("v-4", { qualityScore: 10 }); // below default QUALITY_THRESHOLD (60)
    const caller: StructuredCaller = vi.fn();

    const result = await runVerifier(db(), caller);
    expect(result).toEqual({ processed: 0, flagged: 0, failed: 0 });
    expect(caller).not.toHaveBeenCalled();
  });

  it("leaves caveat_checked_at null on a failed check so it is retried next run", async () => {
    const reel = await seedReel("v-5");
    const caller: StructuredCaller = vi.fn().mockRejectedValue(new Error("boom"));

    const result = await runVerifier(db(), caller);
    expect(result).toEqual({ processed: 1, flagged: 0, failed: 1 });

    const [updated] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(updated.caveatCheckedAt).toBeNull();
  });
});
