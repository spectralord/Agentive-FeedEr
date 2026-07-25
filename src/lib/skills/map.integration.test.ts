// Integration test against local Postgres (T7.3 verification): active nodes
// grouped by theme with correct content counts + status, and node detail
// resolution (Reels + active Experience Reports, labeled).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { experienceReports, rawItems, reels, skillNodes, sources } from "@/db/schema";
import { setProgress } from "./progress";
import { getNodeDetail, getSkillMap, setProgressBySlug } from "./map";

async function seedReel(slug: string, skill: string | null, experimental = false) {
  const [source] = await db()
    .insert(sources)
    .values({ name: `source-${slug}`, type: "rss", url: "https://example.com/feed" })
    .returning();
  const [item] = await db()
    .insert(rawItems)
    .values({
      sourceId: source.id,
      externalId: slug,
      title: `Reel about ${slug}`,
      url: `https://example.com/${slug}`,
      rawContent: "content",
      publishedAt: new Date("2026-07-20T10:00:00Z"),
    })
    .returning();
  return db()
    .insert(reels)
    .values({
      rawItemId: item.id,
      summary: "A reel.",
      category: "tooling",
      maturity: experimental ? "experimental" : "established",
      experimental,
      relevanceScore: 70,
      qualityScore: 70,
      skill,
    })
    .returning()
    .then(([r]) => r);
}

describe("skill map (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE user_progress_notes, user_progress, experience_reports, reels, raw_items, sources, skill_nodes RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("groups active nodes by theme, counts content, defaults status to untouched (T18.4), and excludes pending nodes", async () => {
    await db()
      .insert(skillNodes)
      .values([
        { slug: "sub-agents", title: "Sub-Agents", theme: "Agentic Development", description: "…", status: "active" },
        { slug: "mcp", title: "MCP", theme: "Tooling & Workflow", description: "…", status: "active" },
        { slug: "not-yet", title: "Not Yet", theme: "Tooling & Workflow", description: "…", status: "pending" },
      ]);
    await seedReel("r1", "sub-agents");
    await seedReel("r2", "sub-agents");
    await seedReel("r3", "mcp");

    const map = await getSkillMap();
    expect(map.map((t) => t.theme).sort()).toEqual(["Agentic Development", "Tooling & Workflow"]);

    const agentic = map.find((t) => t.theme === "Agentic Development")!;
    expect(agentic.nodes).toHaveLength(1);
    expect(agentic.nodes[0]).toMatchObject({ slug: "sub-agents", contentCount: 2, status: "untouched" });

    const tooling = map.find((t) => t.theme === "Tooling & Workflow")!;
    expect(tooling.nodes.map((n) => n.slug)).toEqual(["mcp"]); // "not-yet" (pending) excluded
    expect(tooling.nodes[0].contentCount).toBe(1);
  });

  it("reflects the current self-declared status per node", async () => {
    const [node] = await db()
      .insert(skillNodes)
      .values({ slug: "prompt-caching", title: "Prompt Caching", theme: "Claude & Models", description: "…", status: "active" })
      .returning();
    await setProgress(node.id, "mastered", "Using it in production.");

    const map = await getSkillMap();
    expect(map[0].nodes[0].status).toBe("mastered");
  });

  it("T18.4: distinguishes a node with no user_progress row (untouched) from one explicitly declared seen", async () => {
    const [untouchedNode, seenNode] = await db()
      .insert(skillNodes)
      .values([
        { slug: "never-opened", title: "Never Opened", theme: "Agentic Development", description: "…", status: "active" },
        { slug: "explicitly-seen", title: "Explicitly Seen", theme: "Agentic Development", description: "…", status: "active" },
      ])
      .returning();
    // untouchedNode: no user_progress row at all — never call setProgress for it.
    await setProgress(seenNode.id, "seen");

    const map = await getSkillMap();
    const nodes = map.flatMap((t) => t.nodes);
    expect(nodes.find((n) => n.slug === "never-opened")).toMatchObject({ status: "untouched" });
    expect(nodes.find((n) => n.slug === "explicitly-seen")).toMatchObject({ status: "seen" });

    // Same distinction on the node-detail read path.
    expect((await getNodeDetail(untouchedNode.slug))?.status).toBe("untouched");
    expect((await getNodeDetail(seenNode.slug))?.status).toBe("seen");
  });

  it("getNodeDetail returns the node, labeled Reels + active Experience Reports, status, and note history", async () => {
    const [node] = await db()
      .insert(skillNodes)
      .values({ slug: "sub-agents", title: "Sub-Agents", theme: "Agentic Development", description: "Splitting work across agents.", status: "active" })
      .returning();
    await seedReel("r1", "sub-agents");
    await db().insert(experienceReports).values({
      title: "My sub-agent experiment",
      body: "It went well.",
      authorType: "own",
      authorLabel: "Me",
      skill: "sub-agents",
    });
    await db().insert(experienceReports).values({
      title: "An archived one",
      body: "Old.",
      authorType: "own",
      authorLabel: "Me",
      skill: "sub-agents",
      lifecycleState: "archived",
    });
    await setProgress(node.id, "tried", "Gave it a shot.");

    const detail = await getNodeDetail("sub-agents");
    expect(detail).toBeDefined();
    expect(detail!.node.description).toBe("Splitting work across agents.");
    expect(detail!.status).toBe("tried");
    expect(detail!.notes).toHaveLength(1);
    expect(detail!.notes[0].note).toBe("Gave it a shot.");

    const types = detail!.content.map((c) => c.type).sort();
    expect(types).toEqual(["reel", "report"]);
    const report = detail!.content.find((c) => c.type === "report");
    expect(report).toMatchObject({ title: "My sub-agent experiment" });
    // archived report excluded
    expect(detail!.content.some((c) => c.type === "report" && c.title === "An archived one")).toBe(false);
  });

  it("getNodeDetail returns undefined for a pending node or unknown slug", async () => {
    await db()
      .insert(skillNodes)
      .values({ slug: "pending-one", title: "Pending", theme: "Tooling & Workflow", description: "…", status: "pending" });

    expect(await getNodeDetail("pending-one")).toBeUndefined();
    expect(await getNodeDetail("does-not-exist")).toBeUndefined();
  });

  it("T18.5: sets experimentalDot only when a majority (>50%) of a node's Reels are experimental", async () => {
    await db()
      .insert(skillNodes)
      .values([
        { slug: "mostly-experimental", title: "Mostly Experimental", theme: "Tooling & Workflow", description: "…", status: "active" },
        { slug: "half-experimental", title: "Half Experimental", theme: "Tooling & Workflow", description: "…", status: "active" },
        { slug: "no-experimental", title: "No Experimental", theme: "Tooling & Workflow", description: "…", status: "active" },
      ]);
    // 2/3 experimental — above threshold.
    await seedReel("me1", "mostly-experimental", true);
    await seedReel("me2", "mostly-experimental", true);
    await seedReel("me3", "mostly-experimental", false);
    // exactly 1/2 experimental — NOT above threshold (>50%, not >=50%).
    await seedReel("he1", "half-experimental", true);
    await seedReel("he2", "half-experimental", false);
    // 0/2 experimental.
    await seedReel("ne1", "no-experimental", false);
    await seedReel("ne2", "no-experimental", false);

    const map = await getSkillMap();
    const nodes = map.flatMap((t) => t.nodes);
    expect(nodes.find((n) => n.slug === "mostly-experimental")).toMatchObject({ experimentalDot: true });
    expect(nodes.find((n) => n.slug === "half-experimental")).toMatchObject({ experimentalDot: false });
    expect(nodes.find((n) => n.slug === "no-experimental")).toMatchObject({ experimentalDot: false });
  });

  it("T18.5: setProgressBySlug reports the previous status (untouched when no row existed) alongside the new row", async () => {
    await db()
      .insert(skillNodes)
      .values({ slug: "sub-agents", title: "Sub-Agents", theme: "Agentic Development", description: "…", status: "active" });

    const first = await setProgressBySlug("sub-agents", "tried");
    expect(first).toMatchObject({ previousStatus: "untouched", row: { status: "tried" } });

    const second = await setProgressBySlug("sub-agents", "mastered");
    expect(second).toMatchObject({ previousStatus: "tried", row: { status: "mastered" } });

    // Re-declaring the same status: previousStatus equals the new status —
    // callers use this to decide not to animate/confirm.
    const third = await setProgressBySlug("sub-agents", "mastered");
    expect(third).toMatchObject({ previousStatus: "mastered", row: { status: "mastered" } });

    expect(await setProgressBySlug("does-not-exist", "tried")).toBeUndefined();
    expect(await setProgressBySlug("sub-agents", "not-a-status")).toBeUndefined();
  });
});
