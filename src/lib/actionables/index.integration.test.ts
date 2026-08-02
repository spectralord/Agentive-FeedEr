// Integration test against local Postgres (T20.2 verification): the one
// shared mutation (toggleActionable), the To-Try list per node with
// effort filter/sort, and batch evidence counts.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { actionableCompletions, rawItems, reels, skillNodes, sources, topicClusters } from "@/db/schema";
import {
  countEvidenceForNodes,
  listActionablesForNode,
  listCompletionsWithNotes,
  toggleActionable,
} from "./index";

async function seedReel(opts: {
  externalId: string;
  action?: string | null;
  effortTag?: "5-min-test" | "afternoon" | "know-only" | null;
  skill?: string | null;
  publishedAt?: Date;
  topicClusterId?: number | null;
}) {
  const [source] = await db()
    .insert(sources)
    .values({ name: `source-${opts.externalId}`, type: "rss", url: "https://example.com/feed" })
    .returning();
  const [item] = await db()
    .insert(rawItems)
    .values({
      sourceId: source.id,
      externalId: opts.externalId,
      title: `Reel ${opts.externalId}`,
      url: `https://example.com/${opts.externalId}`,
      rawContent: "content",
      publishedAt: opts.publishedAt ?? new Date("2026-07-20T10:00:00Z"),
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
      action: opts.action ?? null,
      effortTag: opts.effortTag ?? null,
      skill: opts.skill ?? null,
      topicClusterId: opts.topicClusterId ?? null,
    })
    .returning();
  return reel;
}

async function seedNode(slug: string, status: "active" | "pending" = "active") {
  const [node] = await db()
    .insert(skillNodes)
    .values({ slug, title: slug, theme: "tooling", description: "…", status })
    .returning();
  return node;
}

describe("actionables (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE actionable_completions, reels, raw_items, sources, skill_nodes, topic_clusters RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  describe("toggleActionable — the one shared mutation", () => {
    it("toggles on: inserts a completion, snapshotting action text and effort tag", async () => {
      await seedNode("sub-agents");
      const reel = await seedReel({
        externalId: "r1",
        action: "Try splitting this into two sub-agents.",
        effortTag: "afternoon",
        skill: "sub-agents",
      });

      const result = await toggleActionable(reel.id, "Worked well.");
      expect(result.ok).toBe(true);
      if (!result.ok || result.state !== "completed") throw new Error("expected completed");
      expect(result.completion).toMatchObject({
        reelId: reel.id,
        actionText: "Try splitting this into two sub-agents.",
        effortTag: "afternoon",
        note: "Worked well.",
      });

      const [row] = await db().select().from(actionableCompletions).where(eq(actionableCompletions.reelId, reel.id));
      expect(row).toBeDefined();
      expect(row.actionText).toBe("Try splitting this into two sub-agents.");
    });

    it("toggles off: a second call on the same reel deletes the completion", async () => {
      await seedNode("sub-agents");
      const reel = await seedReel({ externalId: "r1", action: "Try it.", skill: "sub-agents" });

      const first = await toggleActionable(reel.id);
      expect(first).toMatchObject({ ok: true, state: "completed" });

      const second = await toggleActionable(reel.id);
      expect(second).toMatchObject({ ok: true, state: "incomplete" });

      const rows = await db().select().from(actionableCompletions).where(eq(actionableCompletions.reelId, reel.id));
      expect(rows).toHaveLength(0);
    });

    it(
      "decision 5 (ADR 0019): the snapshot survives a later mutation of reels.action — " +
        "this is the point of the design, do not remove the snapshot",
      async () => {
        await seedNode("sub-agents");
        const reel = await seedReel({
          externalId: "r1",
          action: "Try X.",
          effortTag: "5-min-test",
          skill: "sub-agents",
        });

        const result = await toggleActionable(reel.id);
        if (!result.ok || result.state !== "completed") throw new Error("expected completed");
        expect(result.completion.actionText).toBe("Try X.");

        // Simulate a re-enrichment pass rewriting the Reel's action after
        // the fact — the exact scenario decision 5 exists to guard against.
        await db().update(reels).set({ action: "Try Y instead." }).where(eq(reels.id, reel.id));

        const [completion] = await db()
          .select()
          .from(actionableCompletions)
          .where(eq(actionableCompletions.reelId, reel.id));
        expect(completion.actionText).toBe("Try X.");
        expect(completion.actionText).not.toBe("Try Y instead.");
      },
    );

    it("refuses a reel with no action (typed failure, does not throw)", async () => {
      await seedNode("sub-agents");
      const reel = await seedReel({ externalId: "r1", action: null, skill: "sub-agents" });

      const result = await toggleActionable(reel.id);
      expect(result).toEqual({ ok: false, reason: "no-action" });

      const rows = await db().select().from(actionableCompletions);
      expect(rows).toHaveLength(0);
    });

    it("refuses a reel with no skill", async () => {
      const reel = await seedReel({ externalId: "r1", action: "Try it.", skill: null });

      const result = await toggleActionable(reel.id);
      expect(result).toEqual({ ok: false, reason: "no-skill" });
    });

    it("refuses a reel whose skill slug doesn't resolve to an active node", async () => {
      await seedNode("sub-agents", "pending"); // proposed, not confirmed
      const reel = await seedReel({ externalId: "r1", action: "Try it.", skill: "sub-agents" });

      const result = await toggleActionable(reel.id);
      expect(result).toEqual({ ok: false, reason: "no-skill" });
    });

    it("refuses an unknown reel id", async () => {
      const result = await toggleActionable(999_999);
      expect(result).toEqual({ ok: false, reason: "not-found" });
    });
  });

  describe("listActionablesForNode", () => {
    it("lists every actioned reel tagged to the node, annotated with completion state", async () => {
      const node = await seedNode("sub-agents");
      const r1 = await seedReel({ externalId: "r1", action: "Do A.", skill: "sub-agents" });
      const r2 = await seedReel({ externalId: "r2", action: "Do B.", skill: "sub-agents" });
      await seedReel({ externalId: "r3", action: null, skill: "sub-agents" }); // no action -> excluded
      await seedReel({ externalId: "r4", action: "Do D.", skill: "other-skill" }); // wrong node -> excluded

      await toggleActionable(r1.id, "done!");

      const list = await listActionablesForNode(node.id);
      expect(list.map((i) => i.reelId).sort()).toEqual([r1.id, r2.id].sort());

      const done = list.find((i) => i.reelId === r1.id)!;
      expect(done.completion).toMatchObject({ actionText: "Do A.", note: "done!" });

      const notDone = list.find((i) => i.reelId === r2.id)!;
      expect(notDone.completion).toBeNull();
    });

    it("filters by effort tag (ADR 0019 decision 6)", async () => {
      const node = await seedNode("sub-agents");
      await seedReel({ externalId: "r1", action: "Quick win.", effortTag: "5-min-test", skill: "sub-agents" });
      await seedReel({ externalId: "r2", action: "Longer.", effortTag: "afternoon", skill: "sub-agents" });

      const quick = await listActionablesForNode(node.id, { effortTag: "5-min-test" });
      expect(quick.map((i) => i.action)).toEqual(["Quick win."]);
    });

    it("sorts by effort (5-min-test, afternoon, know-only, untagged last)", async () => {
      const node = await seedNode("sub-agents");
      await seedReel({ externalId: "r1", action: "Untagged.", effortTag: null, skill: "sub-agents" });
      await seedReel({ externalId: "r2", action: "Afternoon.", effortTag: "afternoon", skill: "sub-agents" });
      await seedReel({ externalId: "r3", action: "Quick.", effortTag: "5-min-test", skill: "sub-agents" });
      await seedReel({ externalId: "r4", action: "Know only.", effortTag: "know-only", skill: "sub-agents" });

      const list = await listActionablesForNode(node.id, { sort: "effort" });
      expect(list.map((i) => i.action)).toEqual(["Quick.", "Afternoon.", "Know only.", "Untagged."]);
    });

    it("returns [] for an unknown node id", async () => {
      expect(await listActionablesForNode(999_999)).toEqual([]);
    });

    it(
      "ADR 0019 resolved open question: labels a superseded Actionable with the reason, " +
        "never hides or expires it",
      async () => {
        const node = await seedNode("sub-agents");
        const [newerCluster] = await db().insert(topicClusters).values({ title: "Newer" }).returning();
        const [oldCluster] = await db()
          .insert(topicClusters)
          .values({
            title: "Old",
            lifecycleState: "active",
            supersededByClusterId: newerCluster.id,
            supersedeReason: "A newer approach replaces this.",
          })
          .returning();
        const superseded = await seedReel({
          externalId: "r1",
          action: "Try the old way.",
          skill: "sub-agents",
          topicClusterId: oldCluster.id,
        });
        await seedReel({ externalId: "r2", action: "Try the current way.", skill: "sub-agents" });

        const list = await listActionablesForNode(node.id);
        const supersededItem = list.find((i) => i.reelId === superseded.id)!;
        expect(supersededItem.supersession).toEqual({
          reason: "A newer approach replaces this.",
          supersededByClusterId: newerCluster.id,
        });
        const currentItem = list.find((i) => i.action === "Try the current way.")!;
        expect(currentItem.supersession).toBeNull();

        // Still present in the list — supersession labels, never removes.
        expect(list).toHaveLength(2);
      },
    );

    it("does not label supersession once a human has confirmed it (lifecycleState deprecated)", async () => {
      const node = await seedNode("sub-agents");
      const [newerCluster] = await db().insert(topicClusters).values({ title: "Newer" }).returning();
      const [oldCluster] = await db()
        .insert(topicClusters)
        .values({
          title: "Old",
          lifecycleState: "deprecated",
          supersededByClusterId: newerCluster.id,
          supersedeReason: "Confirmed superseded.",
        })
        .returning();
      const reel = await seedReel({
        externalId: "r1",
        action: "Try the old way.",
        skill: "sub-agents",
        topicClusterId: oldCluster.id,
      });

      const list = await listActionablesForNode(node.id);
      expect(list.find((i) => i.reelId === reel.id)!.supersession).toBeNull();
    });
  });

  describe("countEvidenceForNodes", () => {
    it("batch-counts completions per node, nodes with zero completions absent from the map", async () => {
      const nodeA = await seedNode("sub-agents");
      const nodeB = await seedNode("mcp");
      const r1 = await seedReel({ externalId: "r1", action: "A.", skill: "sub-agents" });
      const r2 = await seedReel({ externalId: "r2", action: "B.", skill: "sub-agents" });
      await seedReel({ externalId: "r3", action: "C.", skill: "mcp" }); // never completed

      await toggleActionable(r1.id);
      await toggleActionable(r2.id);

      const counts = await countEvidenceForNodes([nodeA.id, nodeB.id]);
      expect(counts.get(nodeA.id)).toBe(2);
      expect(counts.has(nodeB.id)).toBe(false);
    });

    it("returns an empty map for an empty input", async () => {
      expect(await countEvidenceForNodes([])).toEqual(new Map());
    });
  });

  describe("listCompletionsWithNotes", () => {
    it("returns only completions with a non-empty note, newest first", async () => {
      await seedNode("sub-agents");
      const r1 = await seedReel({ externalId: "r1", action: "A.", skill: "sub-agents" });
      const r2 = await seedReel({ externalId: "r2", action: "B.", skill: "sub-agents" });

      await toggleActionable(r1.id); // no note
      await toggleActionable(r2.id, "Noted.");

      const rows = await listCompletionsWithNotes();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ note: "Noted.", nodeSlug: "sub-agents" });
    });
  });
});
