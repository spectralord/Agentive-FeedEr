// Integration test against local Postgres (T12.4 verification): match tags
// content, propose creates a pending node while the item stays untagged, a
// rerun is idempotent. Uses a mocked caller — no real API call.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { experienceReports, rawItems, reels, skillNodes, sources } from "@/db/schema";
import { createReport } from "@/lib/experienceReports";
import { runSkillTagging, tagSingle, type StructuredCaller } from "./run";

async function seedReel(externalId: string, summary = "Ein Text über einen Skill.") {
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
      summary,
      category: "tooling",
      maturity: "established",
      experimental: false,
      relevanceScore: 70,
      qualityScore: 70,
      metadata: { skillHint: "prompt caching" },
    })
    .returning();
  return reel;
}

describe("runSkillTagging (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE skill_nodes, experience_reports, reels, raw_items, sources RESTART IDENTITY CASCADE`,
    );
  });

  it("match: sets reels.skill to the matched slug", async () => {
    await db()
      .insert(skillNodes)
      .values({ slug: "prompt-caching", title: "Prompt-Caching", theme: "prompting", description: "…", status: "active" });
    const reel = await seedReel("match-1");
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_slug: "prompt-caching",
      propose_slug: null,
      propose_title: null,
      propose_theme: null,
      propose_description: null,
    });

    const result = await runSkillTagging(db(), caller);
    expect(result).toEqual({ processed: 1, matched: 1, proposed: 0, failed: 0 });

    const [updated] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(updated.skill).toBe("prompt-caching");
  });

  it("propose: creates a pending node and leaves the item untagged", async () => {
    const reel = await seedReel("propose-1");
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "propose",
      match_slug: null,
      propose_slug: "agentic-parallelization",
      propose_title: "Agenten parallelisieren",
      propose_theme: "parallelization",
      propose_description: "Mehrere Sub-Agenten gleichzeitig einsetzen.",
    });

    const result = await runSkillTagging(db(), caller);
    expect(result).toEqual({ processed: 1, matched: 0, proposed: 1, failed: 0 });

    const [updated] = await db().select().from(reels).where(eq(reels.id, reel.id));
    expect(updated.skill).toBeNull();

    const [node] = await db().select().from(skillNodes).where(eq(skillNodes.slug, "agentic-parallelization"));
    expect(node.status).toBe("pending");
    expect(node.theme).toBe("parallelization");
  });

  it("is idempotent: a rerun with nothing new to tag processes 0", async () => {
    await db()
      .insert(skillNodes)
      .values({ slug: "prompt-caching", title: "Prompt-Caching", theme: "prompting", description: "…", status: "active" });
    await seedReel("idem-1");
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_slug: "prompt-caching",
      propose_slug: null,
      propose_title: null,
      propose_theme: null,
      propose_description: null,
    });

    await runSkillTagging(db(), caller);
    const rerun = await runSkillTagging(db(), caller);
    expect(rerun).toEqual({ processed: 0, matched: 0, proposed: 0, failed: 0 });
    expect(caller).toHaveBeenCalledTimes(1);
  });

  it("a second propose of the same slug does not downgrade an already-active node", async () => {
    await db()
      .insert(skillNodes)
      .values({ slug: "prompt-caching", title: "Prompt-Caching", theme: "prompting", description: "…", status: "active" });
    await seedReel("noflip-1");
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "propose",
      match_slug: null,
      propose_slug: "prompt-caching", // collides with an already-active node
      propose_title: "Prompt-Caching",
      propose_theme: "prompting",
      propose_description: "…",
    });

    await runSkillTagging(db(), caller);

    const [node] = await db().select().from(skillNodes).where(eq(skillNodes.slug, "prompt-caching"));
    expect(node.status).toBe("active"); // never flipped back to pending
  });

  it("tags both reels and experience_reports in one sweep", async () => {
    await seedReel("both-reel");
    const report = await createReport({
      title: "Erfahrung mit Sub-Agenten",
      body: "Ich habe parallele Sub-Agenten für Tests genutzt.",
      authorType: "own",
      authorLabel: "Ich",
    });
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "propose",
      match_slug: null,
      propose_slug: "agentic-parallelization",
      propose_title: "Agenten parallelisieren",
      propose_theme: "parallelization",
      propose_description: "…",
    });

    const result = await runSkillTagging(db(), caller);
    expect(result.processed).toBe(2);
    expect(caller).toHaveBeenCalledTimes(2);

    const [updatedReport] = await db().select().from(experienceReports).where(eq(experienceReports.id, report.id));
    expect(updatedReport.skill).toBeNull(); // propose — waits for confirmation
  });
});

describe("tagSingle (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE skill_nodes, experience_reports, reels, raw_items, sources RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("tags one report immediately after creation (on-save path, T12.5)", async () => {
    await db()
      .insert(skillNodes)
      .values({ slug: "prompt-caching", title: "Prompt-Caching", theme: "prompting", description: "…", status: "active" });
    const report = await createReport({
      title: "Notiz zu Prompt-Caching",
      body: "Ich habe cache_control ausprobiert.",
      authorType: "own",
      authorLabel: "Ich",
    });
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_slug: "prompt-caching",
      propose_slug: null,
      propose_title: null,
      propose_theme: null,
      propose_description: null,
    });

    const result = await tagSingle(db(), { type: "report", id: report.id }, caller);
    expect(result).toEqual({ match: "prompt-caching" });

    const [updated] = await db().select().from(experienceReports).where(eq(experienceReports.id, report.id));
    expect(updated.skill).toBe("prompt-caching");
  });

  it("is a no-op when the item is already tagged (idempotent)", async () => {
    const report = await createReport({
      title: "Schon getaggt",
      body: "…",
      authorType: "own",
      authorLabel: "Ich",
      skill: "prompt-caching",
    });
    const caller: StructuredCaller = vi.fn();

    const result = await tagSingle(db(), { type: "report", id: report.id }, caller);
    expect(result).toBeNull();
    expect(caller).not.toHaveBeenCalled();
  });

  it("returns null and never throws when the caller fails", async () => {
    const report = await createReport({
      title: "Fehlerfall",
      body: "…",
      authorType: "own",
      authorLabel: "Ich",
    });
    const caller: StructuredCaller = vi.fn().mockRejectedValue(new Error("boom"));

    const result = await tagSingle(db(), { type: "report", id: report.id }, caller);
    expect(result).toBeNull();

    const [updated] = await db().select().from(experienceReports).where(eq(experienceReports.id, report.id));
    expect(updated.skill).toBeNull(); // left for the daily backstop to retry
  });
});
