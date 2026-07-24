// Integration test against local Postgres: valid output creates a reel,
// persistently invalid output sets enrich_error after retry, reruns are idempotent.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, sources } from "@/db/schema";
import { setAppState } from "@/lib/appState";
import { FEEDBACK_SUMMARY_KEY, type FeedbackSummaryState } from "@/lib/feedback/run";
import { runEnrichment, type StructuredCaller } from "./run";

const validOutput = {
  summary: "Zusammenfassung des Items in zwei Sätzen. Konkret und sachlich.",
  category: "tooling",
  maturity: "established",
  experimental: false,
  relevance_score: 70,
  quality_score: 80,
  example: null,
  action: null,
  effort_tag: null,
  skill_hint: "MCP servers",
};

async function seedRawItem(externalId: string) {
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
      rawContent: "content",
      publishedAt: new Date("2026-07-20T10:00:00Z"),
    })
    .returning();
  return item;
}

describe("runEnrichment (integration)", () => {
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE app_state, reels, raw_items, sources RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("creates a reel and marks the item enriched; rerun processes nothing", async () => {
    const item = await seedRawItem("ok-1");
    const caller: StructuredCaller = vi.fn().mockResolvedValue(validOutput);

    const result = await runEnrichment(db(), caller, "profile");
    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });

    const [reel] = await db().select().from(reels);
    expect(reel.rawItemId).toBe(item.id);
    expect(reel.qualityScore).toBe(80);
    expect(reel.action).toBeNull();
    // ADR 0009: enrichment never sets the canonical skill — only the
    // SkillTagger does. The raw hint rides along in metadata instead.
    expect(reel.skill).toBeNull();
    expect(reel.metadata).toEqual({ skillHint: "MCP servers" });

    const rerun = await runEnrichment(db(), caller, "profile");
    expect(rerun.processed).toBe(0); // enriched_at set — never billed twice
  });

  it("retries once, then sets enrich_error and creates no reel", async () => {
    await seedRawItem("bad-1");
    const caller: StructuredCaller = vi
      .fn()
      .mockResolvedValue({ ...validOutput, relevance_score: 999 }); // always invalid

    const result = await runEnrichment(db(), caller, "profile");
    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
    expect(caller).toHaveBeenCalledTimes(2); // 1 attempt + 1 retry

    expect(await db().select().from(reels)).toHaveLength(0);
    const [item] = await db().select().from(rawItems);
    expect(item.enrichError).toBeTruthy();

    const rerun = await runEnrichment(db(), caller, "profile");
    expect(rerun.processed).toBe(0); // errored items are never retried
  });

  it("aborts on API errors without poisoning items (transient infra failure)", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    await seedRawItem("infra-1");
    const apiError = new Anthropic.APIError(401, { error: "auth" }, "invalid api key", undefined);
    const caller: StructuredCaller = vi.fn().mockRejectedValue(apiError);

    await expect(runEnrichment(db(), caller, "profile")).rejects.toThrow(/401/);

    const [item] = await db().select().from(rawItems);
    expect(item.enrichError).toBeNull(); // stays retryable on the next run
    expect(item.enrichedAt).toBeNull();
  });

  it("recovers when the retry succeeds", async () => {
    await seedRawItem("flaky-1");
    const caller: StructuredCaller = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue(validOutput);

    const result = await runEnrichment(db(), caller, "profile");
    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
  });

  it("picks up a stored rolling feedback summary as extra prompt context (T6.4)", async () => {
    await seedRawItem("with-feedback");
    const state: FeedbackSummaryState = {
      summary: "- mag: konkrete Beispiele\n- überspringt: reine Ankündigungen",
      generatedAt: "2026-07-23T00:00:00.000Z",
      interactionCountAtGeneration: 42,
    };
    await setAppState(db(), FEEDBACK_SUMMARY_KEY, state);
    const caller: StructuredCaller = vi.fn().mockResolvedValue(validOutput);

    await runEnrichment(db(), caller, "profile");

    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.user).toContain("## Observed behavior (rolling feedback summary)");
    expect(call.user).toContain("mag: konkrete Beispiele");
  });

  it("omits the feedback-summary section when app_state has none yet", async () => {
    await seedRawItem("no-feedback");
    const caller: StructuredCaller = vi.fn().mockResolvedValue(validOutput);

    await runEnrichment(db(), caller, "profile");

    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.user).not.toContain("Observed behavior");
  });
});
