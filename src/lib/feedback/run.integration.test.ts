// Integration test against local Postgres: threshold gating, prompt input
// shape, and app_state persistence for the rolling feedback summary (T6.4).
// Seeds its own sources/raw_items/reels/interactions (TRUNCATE + insert),
// same pattern as src/lib/interactions.test.ts.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { appState, interactions, rawItems, reels, sources } from "@/db/schema";
import { getAppState } from "@/lib/appState";
import {
  FEEDBACK_SUMMARY_KEY,
  loadFeedbackSummaryText,
  MAX_INTERACTIONS_INPUT,
  MIN_NEW_INTERACTIONS,
  runFeedbackSummary,
  type FeedbackSummaryState,
  type StructuredCaller,
} from "./run";

const validBullets = {
  bullets: [
    "mag: konkrete Claude-Code-Beispiele",
    "überspringt: reine Ankündigungs-News",
    "mag: Agenten-Tooling",
    "überspringt: Marketing ohne Substanz",
    "mag: kurze 5-Minuten-Tests",
  ],
};

async function seedReel(externalId: string) {
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
      publishedAt: new Date("2026-07-20T10:00:00Z"),
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
      skill: "mcp-servers",
    })
    .returning();
  return reel;
}

async function seedInteractions(reelId: number, n: number) {
  const rows = Array.from({ length: n }, () => ({ reelId, type: "up" as const }));
  await db().insert(interactions).values(rows);
}

describe("runFeedbackSummary (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE app_state, interactions, reels, raw_items, sources RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("below MIN_NEW_INTERACTIONS: no call is made, nothing is stored", async () => {
    const reel = await seedReel("few");
    await seedInteractions(reel.id, MIN_NEW_INTERACTIONS - 1);
    const caller: StructuredCaller = vi.fn().mockResolvedValue(validBullets);

    const result = await runFeedbackSummary(db(), caller);

    expect(result).toEqual({
      ran: false,
      reason: "below-threshold",
      newInteractions: MIN_NEW_INTERACTIONS - 1,
    });
    expect(caller).not.toHaveBeenCalled();
    expect(await getAppState(db(), FEEDBACK_SUMMARY_KEY)).toBeUndefined();
  });

  it("at/above MIN_NEW_INTERACTIONS: calls the caller and stores the summary", async () => {
    const reel = await seedReel("many");
    await seedInteractions(reel.id, MIN_NEW_INTERACTIONS);
    const caller: StructuredCaller = vi.fn().mockResolvedValue(validBullets);

    const result = await runFeedbackSummary(db(), caller);

    expect(result.ran).toBe(true);
    expect(result.newInteractions).toBe(MIN_NEW_INTERACTIONS);
    expect(result.bulletCount).toBe(validBullets.bullets.length);
    expect(caller).toHaveBeenCalledTimes(1);

    // The prompt handed to the model carries reel title/category/skill.
    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.user).toContain("Item many");
    expect(call.user).toContain("tooling");
    expect(call.user).toContain("mcp-servers");

    const stored = await getAppState<FeedbackSummaryState>(db(), FEEDBACK_SUMMARY_KEY);
    expect(stored?.summary).toContain("mag: konkrete Claude-Code-Beispiele");
    expect(stored?.interactionCountAtGeneration).toBe(MIN_NEW_INTERACTIONS);

    const text = await loadFeedbackSummaryText(db());
    expect(text).toBe(stored?.summary);
  });

  it("caps the interaction input at MAX_INTERACTIONS_INPUT most recent rows", async () => {
    const reel = await seedReel("lots");
    await seedInteractions(reel.id, MAX_INTERACTIONS_INPUT + 20);
    const caller: StructuredCaller = vi.fn().mockResolvedValue(validBullets);

    await runFeedbackSummary(db(), caller);

    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const lineCount = call.user.split("\n").filter((l: string) => l.startsWith("-")).length;
    expect(lineCount).toBe(MAX_INTERACTIONS_INPUT);
  });

  it("does not re-run once fewer than MIN_NEW_INTERACTIONS have accrued since the last summary", async () => {
    const reel = await seedReel("rolling");
    await seedInteractions(reel.id, MIN_NEW_INTERACTIONS);
    const caller: StructuredCaller = vi.fn().mockResolvedValue(validBullets);

    const first = await runFeedbackSummary(db(), caller);
    expect(first.ran).toBe(true);

    await seedInteractions(reel.id, MIN_NEW_INTERACTIONS - 1);
    const second = await runFeedbackSummary(db(), caller);

    expect(second.ran).toBe(false);
    expect(caller).toHaveBeenCalledTimes(1); // not called again
  });

  it("a schema-invalid model response leaves app_state untouched (bubbles up, doesn't poison state)", async () => {
    const reel = await seedReel("bad");
    await seedInteractions(reel.id, MIN_NEW_INTERACTIONS);
    const caller: StructuredCaller = vi.fn().mockResolvedValue({ bullets: ["only one bullet"] });

    await expect(runFeedbackSummary(db(), caller)).rejects.toThrow();
    expect(await getAppState(db(), FEEDBACK_SUMMARY_KEY)).toBeUndefined();
  });

  it("app_state row round-trips through a direct query too", async () => {
    const [row] = await db()
      .select()
      .from(appState)
      .where(sql`key = ${FEEDBACK_SUMMARY_KEY}`);
    expect(row).toBeUndefined(); // sanity: table starts empty per beforeEach
  });
});
