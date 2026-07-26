// Unit tests for groupReelsForFeed (T15.4) — pure function, no DB needed.
// getReels() itself (the SQL query, hide-filtering, etc.) is covered by
// feed.test.ts (integration, against local Postgres).
import { describe, expect, it } from "vitest";
import { groupReelsForFeed, type FeedReel } from "./feed";

function reel(overrides: Partial<FeedReel> & Pick<FeedReel, "id">): FeedReel {
  return {
    rawItemId: overrides.id,
    title: `Reel ${overrides.id}`,
    url: `https://example.com/${overrides.id}`,
    publishedAt: new Date("2026-07-20T00:00:00Z"),
    sourceName: "some-source",
    summary: "Summary.",
    category: "tooling",
    maturity: "established",
    experimental: false,
    relevanceScore: 90,
    qualityScore: 90,
    example: null,
    action: null,
    effortTag: null,
    skill: null,
    topicClusterId: null,
    isPrimary: null,
    clusterTitle: null,
    confidence: null,
    independentCount: null,
    lifecycleState: null,
    supersededByClusterId: null,
    supersedeReason: null,
    caveat: null,
    writeup: null,
    ...overrides,
  };
}

describe("groupReelsForFeed (T15.4)", () => {
  it("reels without a cluster render as unchanged solo items", () => {
    const reels = [reel({ id: 1 }), reel({ id: 2 })];
    const items = groupReelsForFeed(reels);
    expect(items).toEqual([
      { type: "solo", reel: reels[0] },
      { type: "solo", reel: reels[1] },
    ]);
  });

  it("a cluster with >= 2 displayed members bundles into one stack item, positioned at the newest member's slot", () => {
    const solo = reel({ id: 1, publishedAt: new Date("2026-07-22T00:00:00Z") });
    const newest = reel({
      id: 2,
      publishedAt: new Date("2026-07-21T00:00:00Z"),
      topicClusterId: 10,
      clusterTitle: "Batch command",
      isPrimary: null,
      sourceName: "source-a",
    });
    const older = reel({
      id: 3,
      publishedAt: new Date("2026-07-19T00:00:00Z"),
      topicClusterId: 10,
      clusterTitle: "Batch command",
      isPrimary: null,
      sourceName: "source-b",
    });
    // Input is already newest-first, as getReels returns it.
    const items = groupReelsForFeed([solo, newest, older]);

    expect(items).toHaveLength(2); // solo + one stack (not three separate items)
    expect(items[0]).toEqual({ type: "solo", reel: solo });
    expect(items[1].type).toBe("stack");
    if (items[1].type === "stack") {
      expect(items[1].clusterId).toBe(10);
      expect(items[1].clusterTitle).toBe("Batch command");
      // No is_primary=true member set — falls back to the newest.
      expect(items[1].primary.id).toBe(2);
      expect(items[1].others.map((o) => o.id)).toEqual([3]);
    }
  });

  it("shows the is_primary=true member on top even if it isn't the newest", () => {
    const newestButEcho = reel({
      id: 1,
      publishedAt: new Date("2026-07-22T00:00:00Z"),
      topicClusterId: 5,
      isPrimary: false,
      sourceName: "aggregator",
    });
    const olderButPrimary = reel({
      id: 2,
      publishedAt: new Date("2026-07-20T00:00:00Z"),
      topicClusterId: 5,
      isPrimary: true,
      sourceName: "official-blog",
    });

    const items = groupReelsForFeed([newestButEcho, olderButPrimary]);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("stack");
    if (items[0].type === "stack") {
      expect(items[0].primary.id).toBe(2);
      expect(items[0].others.map((o) => o.id)).toEqual([1]);
    }
  });

  it("a cluster reduced to a single visible member (others hidden) reverts to a solo card", () => {
    const onlyMemberLeft = reel({ id: 1, topicClusterId: 7, clusterTitle: "Some topic" });
    const items = groupReelsForFeed([onlyMemberLeft]);
    expect(items).toEqual([{ type: "solo", reel: onlyMemberLeft }]);
  });

  it("mixes solo reels and stacks while preserving overall feed order", () => {
    const a = reel({ id: 1, publishedAt: new Date("2026-07-22T00:00:00Z") }); // solo, newest
    const b = reel({ id: 2, publishedAt: new Date("2026-07-21T00:00:00Z"), topicClusterId: 1, clusterTitle: "T1" });
    const c = reel({ id: 3, publishedAt: new Date("2026-07-20T00:00:00Z") }); // solo
    const d = reel({ id: 4, publishedAt: new Date("2026-07-19T00:00:00Z"), topicClusterId: 1, clusterTitle: "T1" });

    const items = groupReelsForFeed([a, b, c, d]);
    expect(items).toHaveLength(3); // a (solo), stack(b+d) at b's slot, c (solo)
    expect(items[0]).toEqual({ type: "solo", reel: a });
    expect(items[1].type).toBe("stack");
    if (items[1].type === "stack") {
      expect(items[1].primary.id).toBe(2);
      expect(items[1].others.map((o) => o.id)).toEqual([4]);
    }
    expect(items[2]).toEqual({ type: "solo", reel: c });
  });
});
