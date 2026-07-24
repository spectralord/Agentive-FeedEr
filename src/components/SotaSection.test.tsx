import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FeedReel } from "@/lib/feed";
import { groupSota, SotaSection } from "./SotaSection";

function reel(overrides: Partial<FeedReel> & Pick<FeedReel, "id">): FeedReel {
  return {
    rawItemId: overrides.id,
    title: `Reel ${overrides.id}`,
    url: `https://example.com/${overrides.id}`,
    publishedAt: new Date("2026-01-01T00:00:00Z"), // > 30 days before NOW (2026-07-22)
    sourceName: "some-source",
    summary: "Erster Satz. Zweiter Satz.",
    category: "tooling",
    maturity: "established",
    experimental: false,
    relevanceScore: 90,
    qualityScore: 90,
    example: null,
    action: null,
    effortTag: null,
    skill: null,
    ...overrides,
  };
}

describe("groupSota", () => {
  it("sorts within a category by relevanceScore * qualityScore, not by date", () => {
    // "weakest" is the newest but has the lowest R*Q score — it must sort last.
    const strongest = reel({ id: 1, relevanceScore: 99, qualityScore: 99, publishedAt: new Date("2026-01-01") });
    const middle = reel({ id: 2, relevanceScore: 80, qualityScore: 80, publishedAt: new Date("2026-06-01") });
    const weakest = reel({ id: 3, relevanceScore: 70, qualityScore: 70, publishedAt: new Date("2026-07-20") });

    const groups = groupSota([weakest, middle, strongest]);

    expect(groups).toHaveLength(1);
    expect(groups[0].reels.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("caps each category group at 5 reels", () => {
    const reels = Array.from({ length: 8 }, (_, i) =>
      reel({ id: i + 1, relevanceScore: 100 - i, qualityScore: 100 }),
    );

    const groups = groupSota(reels);

    expect(groups[0].reels).toHaveLength(5);
    expect(groups[0].reels.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("groups by category and orders groups by the fixed CATEGORIES list", () => {
    const research = reel({ id: 1, category: "research" });
    const tooling = reel({ id: 2, category: "tooling" });

    const groups = groupSota([research, tooling]);

    // CATEGORIES order: claude-feature, tooling, technique, industry-news, research, opinion
    expect(groups.map((g) => g.category)).toEqual(["tooling", "research"]);
  });

  it("omits categories with no SOTA reels", () => {
    const groups = groupSota([]);
    expect(groups).toEqual([]);
  });
});

describe("SotaSection", () => {
  it("renders an old (>30 days) high-score reel, age-independent", () => {
    const oldReel = reel({
      id: 1,
      publishedAt: new Date("2025-01-01T00:00:00Z"), // long past NEW_DAYS/30 days
      relevanceScore: 95,
      qualityScore: 95,
      title: "Uraltes SOTA-Reel",
    });

    const html = renderToStaticMarkup(<SotaSection groups={groupSota([oldReel])} />);

    expect(html).toContain("Uraltes SOTA-Reel");
    expect(html).toContain("⭐ Current State of the Art");
    expect(html).toContain("Erster Satz."); // first-sentence summary excerpt
    expect(html).not.toContain("Zweiter Satz.");
    expect(html).toContain('href="/?category=tooling"');
  });

  it("shows an empty-state message when there are no SOTA groups", () => {
    const html = renderToStaticMarkup(<SotaSection groups={[]} />);
    expect(html).toContain("No SOTA Reels yet.");
  });
});
