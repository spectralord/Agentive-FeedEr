// Integration test against local Postgres (T18.7 verification): the Reel
// Detail Skill tab's batch data access — one query per distinct skill slug
// across a set of feed reels, not one query per card.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { experienceReports, rawItems, reels, skillNodes, sources } from "@/db/schema";
import { setProgress } from "./progress";
import { getSkillTabInfoForSlugs, pickSkillTabPreview } from "./reelSkillTab";

async function seedReel(externalId: string, skill: string | null, publishedAt: Date) {
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
      publishedAt,
    })
    .returning();
  const [reel] = await db()
    .insert(reels)
    .values({
      rawItemId: item.id,
      summary: "A reel.",
      category: "tooling",
      maturity: "established",
      relevanceScore: 70,
      qualityScore: 70,
      skill,
    })
    .returning();
  return reel;
}

describe("reelSkillTab (integration)", () => {
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE user_progress_notes, user_progress, experience_reports, reels, raw_items, sources, skill_nodes RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("resolves node title/theme/description/status and every tagged reel+report, newest first, for each distinct slug", async () => {
    const [node] = await db()
      .insert(skillNodes)
      .values({
        slug: "agent-skills",
        title: "Agent Skills",
        theme: "agents",
        description: "Building reusable Skills.",
        status: "active",
      })
      .returning();
    await setProgress(node.id, "tried");

    const older = await seedReel("older", "agent-skills", new Date("2026-07-01T00:00:00Z"));
    const newer = await seedReel("newer", "agent-skills", new Date("2026-07-20T00:00:00Z"));
    await seedReel("unrelated", null, new Date("2026-07-15T00:00:00Z"));

    const [report] = await db()
      .insert(experienceReports)
      .values({
        title: "My own Skills experiment",
        body: "…",
        authorType: "own",
        authorLabel: "me",
        skill: "agent-skills",
        createdAt: new Date("2026-07-10T00:00:00Z"),
      })
      .returning();

    const map = await getSkillTabInfoForSlugs(["agent-skills", "agent-skills", "no-such-slug"]);

    expect(map.has("no-such-slug")).toBe(false);
    const info = map.get("agent-skills");
    expect(info).toBeDefined();
    expect(info!.title).toBe("Agent Skills");
    expect(info!.theme).toBe("agents");
    expect(info!.description).toBe("Building reusable Skills.");
    expect(info!.status).toBe("tried");
    // Newest first: newer reel, then the report, then the older reel.
    expect(info!.items.map((it) => `${it.type}:${it.id}`)).toEqual([
      `reel:${newer.id}`,
      `report:${report.id}`,
      `reel:${older.id}`,
    ]);
  });

  it("excludes a lifecycleState !== active report from the preview items", async () => {
    await db().insert(skillNodes).values({
      slug: "mcp",
      title: "MCP",
      theme: "tooling",
      description: "…",
      status: "active",
    });
    await db().insert(experienceReports).values({
      title: "Archived report",
      body: "…",
      authorType: "own",
      authorLabel: "me",
      skill: "mcp",
      lifecycleState: "archived",
    });

    const map = await getSkillTabInfoForSlugs(["mcp"]);
    expect(map.get("mcp")!.items).toEqual([]);
  });

  it("returns an empty map for an empty slug list without querying (no crash)", async () => {
    const map = await getSkillTabInfoForSlugs([]);
    expect(map.size).toBe(0);
  });
});

describe("pickSkillTabPreview (pure)", () => {
  it("excludes the calling reel's own row and caps the rest at `max`", () => {
    const info = {
      slug: "agent-skills",
      title: "Agent Skills",
      theme: "agents",
      description: "…",
      status: "seen" as const,
      items: [
        { type: "reel" as const, id: 1, title: "self", date: new Date(2026, 0, 4) },
        { type: "reel" as const, id: 2, title: "a", date: new Date(2026, 0, 3) },
        { type: "report" as const, id: 3, title: "b", date: new Date(2026, 0, 2) },
        { type: "reel" as const, id: 4, title: "c", date: new Date(2026, 0, 1) },
      ],
    };

    const { otherItems, moreCount } = pickSkillTabPreview(info, 1);
    expect(otherItems.map((it) => it.title)).toEqual(["a", "b"]);
    expect(moreCount).toBe(1);
  });

  it("a report with the same numeric id as the excluded reel is NOT excluded (type-scoped exclusion)", () => {
    const info = {
      slug: "s",
      title: "S",
      theme: "T",
      description: "…",
      status: "seen" as const,
      items: [{ type: "report" as const, id: 1, title: "report with id 1", date: new Date() }],
    };
    const { otherItems } = pickSkillTabPreview(info, 1);
    expect(otherItems).toHaveLength(1);
  });
});
