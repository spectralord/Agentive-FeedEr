// Integration test against local Postgres (T7.1/T7.3 verification): status
// upserts, downgrades, and note-history bookkeeping for setProgress/listAdoptionLog.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { rawItems, reels, skillNodes, sources } from "@/db/schema";
import { toggleActionable } from "@/lib/actionables";
import type { Theme } from "@/lib/skills";
import {
  DEFAULT_PROGRESS_STATUS,
  getProgress,
  getProgressMap,
  isProgressStatus,
  listAdoptionLog,
  listNotesForNode,
  setProgress,
} from "./progress";

async function seedNode(slug: string, theme: Theme = "tooling") {
  const [node] = await db()
    .insert(skillNodes)
    .values({ slug, title: slug, theme, description: "…", status: "active" })
    .returning();
  return node;
}

/** T20.5: a Reel with an action, tagged to `skill`, for exercising
 *  toggleActionable in these Adoption-Log tests. */
async function seedActionableReel(externalId: string, skill: string, action: string) {
  const [source] = await db()
    .insert(sources)
    .values({ name: `source-${externalId}`, type: "rss", url: "https://example.com/feed" })
    .returning();
  const [item] = await db()
    .insert(rawItems)
    .values({
      sourceId: source.id,
      externalId,
      title: `Reel ${externalId}`,
      url: `https://example.com/${externalId}`,
      rawContent: "content",
      publishedAt: new Date("2026-07-20T10:00:00Z"),
    })
    .returning();
  const [reel] = await db()
    .insert(reels)
    .values({
      rawItemId: item.id,
      summary: "A reel.",
      category: "tooling",
      maturity: "established",
      experimental: false,
      relevanceScore: 70,
      qualityScore: 70,
      action,
      skill,
    })
    .returning();
  return reel;
}

describe("skill progress (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE actionable_completions, reels, raw_items, sources, user_progress_notes, user_progress, skill_nodes RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("isProgressStatus recognizes only seen/tried/mastered", () => {
    expect(isProgressStatus("seen")).toBe(true);
    expect(isProgressStatus("tried")).toBe(true);
    expect(isProgressStatus("mastered")).toBe(true);
    expect(isProgressStatus("gates")).toBe(false);
  });

  it("getProgress/getProgressMap default to seen for a node with no row", async () => {
    const node = await seedNode("no-progress-yet");
    expect(await getProgress(node.id)).toBeUndefined();

    const map = await getProgressMap([node.id]);
    expect(map.has(node.id)).toBe(false); // caller defaults, not this module
    expect(DEFAULT_PROGRESS_STATUS).toBe("seen");
  });

  it("setProgress upserts status and, with a note, appends note history", async () => {
    const node = await seedNode("agentic-parallelization");

    const row1 = await setProgress(node.id, "tried", "Tried the parallel-subagent pattern today.");
    expect(row1.status).toBe("tried");
    expect(row1.note).toBe("Tried the parallel-subagent pattern today.");

    const notes = await listNotesForNode(node.id);
    expect(notes).toHaveLength(1);
    expect(notes[0].status).toBe("tried");
    expect(notes[0].note).toBe("Tried the parallel-subagent pattern today.");
  });

  it("downgrades are allowed (no gates) and preserve the last note when no new one is given", async () => {
    const node = await seedNode("prompt-caching");
    await setProgress(node.id, "mastered", "Rolled it out everywhere.");

    const downgraded = await setProgress(node.id, "seen");
    expect(downgraded.status).toBe("seen");
    expect(downgraded.note).toBe("Rolled it out everywhere."); // preserved, not wiped

    // no new note -> no new history entry
    expect(await listNotesForNode(node.id)).toHaveLength(1);
  });

  it("a status change with a blank/whitespace-only note leaves no history entry", async () => {
    const node = await seedNode("mcp-servers");
    await setProgress(node.id, "tried", "   ");
    expect(await listNotesForNode(node.id)).toHaveLength(0);
    expect((await getProgress(node.id))?.note).toBeNull();
  });

  it("listAdoptionLog merges notes across nodes, newest first", async () => {
    const nodeA = await seedNode("node-a");
    const nodeB = await seedNode("node-b");

    await setProgress(nodeA.id, "tried", "First note.");
    await setProgress(nodeB.id, "tried", "Second note.");
    await setProgress(nodeA.id, "mastered", "Third note.");

    const log = await listAdoptionLog();
    expect(log.map((e) => e.note)).toEqual(["Third note.", "Second note.", "First note."]);
    expect(log[0].nodeSlug).toBe("node-a");
    expect(log[0].nodeTitle).toBe("node-a");
    expect(log.every((e) => e.source === "progress")).toBe(true);
  });

  // Epic 20 (T20.5, ADR 0019 decision 4): the Log's second source.
  it("listAdoptionLog interleaves completed-Actionable notes with progress notes, newest first", async () => {
    const node = await seedNode("prompt-caching");
    const reel = await seedActionableReel("r1", "prompt-caching", "Add cache_control to your prompt.");

    await setProgress(node.id, "tried", "First: declared tried.");
    await toggleActionable(reel.id, "Second: completed the action.");
    await setProgress(node.id, "mastered", "Third: declared mastered.");

    const log = await listAdoptionLog();
    expect(log.map((e) => e.note)).toEqual([
      "Third: declared mastered.",
      "Second: completed the action.",
      "First: declared tried.",
    ]);
    expect(log.map((e) => e.source)).toEqual(["progress", "actionable", "progress"]);

    const actionableEntry = log[1];
    if (actionableEntry.source !== "actionable") throw new Error("expected actionable entry");
    expect(actionableEntry.actionText).toBe("Add cache_control to your prompt.");
    expect(actionableEntry.nodeSlug).toBe("prompt-caching");
  });

  it("listAdoptionLog excludes completions with no note (a bare tick isn't 'adopted' either)", async () => {
    await seedNode("prompt-caching");
    const reel = await seedActionableReel("r1", "prompt-caching", "Add cache_control to your prompt.");
    await toggleActionable(reel.id); // no note

    expect(await listAdoptionLog()).toEqual([]);
  });
});
