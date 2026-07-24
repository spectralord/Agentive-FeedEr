// Integration test against local Postgres (T7.1/T7.3 verification): status
// upserts, downgrades, and note-history bookkeeping for setProgress/listAdoptionLog.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { skillNodes } from "@/db/schema";
import {
  DEFAULT_PROGRESS_STATUS,
  getProgress,
  getProgressMap,
  isProgressStatus,
  listAdoptionLog,
  listNotesForNode,
  setProgress,
} from "./progress";

async function seedNode(slug: string, theme = "Tooling & Workflow") {
  const [node] = await db()
    .insert(skillNodes)
    .values({ slug, title: slug, theme, description: "…", status: "active" })
    .returning();
  return node;
}

describe("skill progress (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE user_progress_notes, user_progress, skill_nodes RESTART IDENTITY CASCADE`,
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
  });
});
