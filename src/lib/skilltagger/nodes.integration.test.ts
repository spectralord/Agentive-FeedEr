// Integration test against local Postgres (T12.6 verification): confirming a
// pending node flips it active and unblocks the next runSkillTagging sweep;
// merge reassigns referencing content and removes the pending row; discard
// just removes it.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, skillNodes, sources } from "@/db/schema";
import { confirmNode, discardNode, listActiveNodes, listPendingNodes, mergeNode } from "./nodes";
import { runSkillTagging, type StructuredCaller } from "./run";

async function seedReel(externalId: string) {
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
  const [reel] = await db()
    .insert(reels)
    .values({
      rawItemId: item.id,
      summary: "Ein Text über parallele Sub-Agenten.",
      category: "tooling",
      maturity: "established",
      experimental: false,
      relevanceScore: 70,
      qualityScore: 70,
    })
    .returning();
  return reel;
}

describe("skill node confirmation (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE skill_nodes, experience_reports, reels, raw_items, sources RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("confirmNode flips pending to active; the next sweep then tags waiting items", async () => {
    const reel = await seedReel("wait-1");
    const proposeCaller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "propose",
      match_slug: null,
      propose_slug: "agentic-parallelization",
      propose_title: "Agenten parallelisieren",
      propose_theme: "parallelization",
      propose_description: "…",
    });

    await runSkillTagging(db(), proposeCaller); // creates the pending node, item stays null
    const [pending] = await listPendingNodes();
    expect(pending.status).toBe("pending");

    const confirmed = await confirmNode(pending.id);
    expect(confirmed?.status).toBe("active");
    expect(await listPendingNodes()).toHaveLength(0);
    expect(await listActiveNodes()).toHaveLength(1);

    const matchCaller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_slug: "agentic-parallelization",
      propose_slug: null,
      propose_title: null,
      propose_theme: null,
      propose_description: null,
    });
    const result = await runSkillTagging(db(), matchCaller); // the backstop sweep
    expect(result).toEqual({ processed: 1, matched: 1, proposed: 0, failed: 0 });

    const [updatedReel] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(updatedReel.skill).toBe("agentic-parallelization");
  });

  it("mergeNode re-points referencing content and removes the pending row", async () => {
    const reel = await seedReel("merge-1");
    await db().update(reels).set({ skill: "duplicate-slug" }).where(eq(reels.id, reel.id));
    const [target] = await db()
      .insert(skillNodes)
      .values({ slug: "agentic-parallelization", title: "Agenten parallelisieren", theme: "parallelization", description: "…", status: "active" })
      .returning();
    const [pendingDup] = await db()
      .insert(skillNodes)
      .values({ slug: "duplicate-slug", title: "Duplikat", theme: "parallelization", description: "…", status: "pending" })
      .returning();

    await mergeNode(pendingDup.id, target.slug);

    const [updatedReel] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(updatedReel.skill).toBe("agentic-parallelization");
    expect(await listPendingNodes()).toHaveLength(0);
  });

  it("discardNode removes the pending row without touching content", async () => {
    const [pending] = await db()
      .insert(skillNodes)
      .values({ slug: "throwaway", title: "Wegwerf", theme: "tooling", description: "…", status: "pending" })
      .returning();

    await discardNode(pending.id);

    expect(await listPendingNodes()).toHaveLength(0);
  });
});
