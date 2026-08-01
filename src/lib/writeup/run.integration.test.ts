// Integration test against local Postgres (T19.2 verification): loads a Reel
// joined to raw_items/sources, persists a generated write-up, is idempotent
// once one exists, and leaves `writeup` untouched on a null/failed result.
// Uses a mocked caller — no real API call (ADR 0015).
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, sources } from "@/db/schema";
import { runWriteupForReel, type StructuredCaller } from "./run";

async function seedReel(externalId: string, opts: { writeup?: string | null } = {}) {
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
      summary: "It is 10% faster on one benchmark.",
      category: "tooling",
      maturity: "established",
      experimental: false,
      relevanceScore: 70,
      qualityScore: 70,
      writeup: opts.writeup ?? null,
    })
    .returning();
  return reel;
}

describe("runWriteupForReel (integration)", () => {
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE reels, raw_items, sources RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("generates and persists a write-up for a Reel with none yet", async () => {
    const reel = await seedReel("w-1");
    const caller: StructuredCaller = vi
      .fn()
      .mockResolvedValue({ writeup: "A longer, honest elaboration on the benchmark result." });

    const result = await runWriteupForReel(db(), reel.id, caller);
    expect(result).toEqual({ status: "generated" });

    const [updated] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(updated.writeup).toBe("A longer, honest elaboration on the benchmark result.");
  });

  it("is idempotent: does not call the model when writeup already exists (ADR 0024 decision 4)", async () => {
    const reel = await seedReel("w-2", { writeup: "Already there." });
    const caller: StructuredCaller = vi.fn();

    const result = await runWriteupForReel(db(), reel.id, caller);
    expect(result).toEqual({ status: "already-present" });
    expect(caller).not.toHaveBeenCalled();

    const [row] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(row.writeup).toBe("Already there.");
  });

  it("returns not-found for a nonexistent Reel id without throwing", async () => {
    const caller: StructuredCaller = vi.fn();

    const result = await runWriteupForReel(db(), 999999, caller);
    expect(result).toEqual({ status: "not-found" });
    expect(caller).not.toHaveBeenCalled();
  });

  it("leaves writeup untouched (null) when the model returns null (ADR 0003)", async () => {
    const reel = await seedReel("w-3");
    const caller: StructuredCaller = vi.fn().mockResolvedValue({ writeup: null });

    const result = await runWriteupForReel(db(), reel.id, caller);
    expect(result).toEqual({ status: "empty" });

    const [row] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(row.writeup).toBeNull();
  });

  it("returns failed and leaves writeup untouched when the caller throws", async () => {
    const reel = await seedReel("w-4");
    const caller: StructuredCaller = vi.fn().mockRejectedValue(new Error("boom"));

    const result = await runWriteupForReel(db(), reel.id, caller);
    expect(result).toEqual({ status: "failed" });

    const [row] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(row.writeup).toBeNull();
  });

  it("returns failed and leaves writeup untouched when the response is schema-invalid", async () => {
    const reel = await seedReel("w-5");
    const caller: StructuredCaller = vi.fn().mockResolvedValue({ writeup: "" }); // violates min(1)

    const result = await runWriteupForReel(db(), reel.id, caller);
    expect(result).toEqual({ status: "failed" });

    const [row] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(row.writeup).toBeNull();
  });
});
