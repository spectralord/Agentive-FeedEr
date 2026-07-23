import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SavedReel } from "@/lib/interactions";
import { ResurfaceCard } from "./ResurfaceCard";

const NOW = new Date("2026-07-23T12:00:00Z");

const baseSavedReel: SavedReel = {
  id: 1,
  rawItemId: 1,
  title: "Ein Reel zum Dranbleiben",
  url: "https://example.com/item",
  publishedAt: new Date("2026-07-01T00:00:00Z"),
  sourceName: "some-source",
  summary: "Zusammenfassung.",
  category: "tooling",
  maturity: "established",
  experimental: false,
  relevanceScore: 90,
  qualityScore: 90,
  example: null,
  action: null,
  effortTag: null,
  skill: null,
  savedAt: new Date(NOW.getTime() - 10 * 86_400_000), // 10 days ago
};

describe("ResurfaceCard", () => {
  it("renders the days-ago prompt and a link to the source for each candidate", () => {
    const html = renderToStaticMarkup(<ResurfaceCard reels={[baseSavedReel]} now={NOW} />);

    expect(html).toContain("🔁 Dranbleiben");
    expect(html).toContain("Vor 10 Tagen gespeichert");
    expect(html).toContain("nochmal ansehen?");
    expect(html).toContain("Ein Reel zum Dranbleiben");
    expect(html).toContain('href="https://example.com/item"');
    expect(html).toContain("some-source");
  });

  it("has no 'erledigt' checkbox — items just age out (revised scope, epic-6)", () => {
    const html = renderToStaticMarkup(<ResurfaceCard reels={[baseSavedReel]} now={NOW} />);
    expect(html).not.toContain("erledigt");
    expect(html).not.toContain("checkbox");
  });

  it("renders nothing when there are no candidates", () => {
    const html = renderToStaticMarkup(<ResurfaceCard reels={[]} now={NOW} />);
    expect(html).toBe("");
  });
});
