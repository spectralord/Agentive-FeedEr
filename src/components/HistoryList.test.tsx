import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FeedReel } from "@/lib/feed";
import { HistoryList } from "./HistoryList";

const baseReel: FeedReel = {
  id: 1,
  rawItemId: 1,
  title: "Ein Verlaufs-Item",
  url: "https://example.com/item",
  publishedAt: new Date("2026-01-01T00:00:00Z"),
  sourceName: "some-source",
  summary: "Zusammenfassung.",
  category: "tooling",
  maturity: "established",
  experimental: false,
  relevanceScore: 90,
  qualityScore: 90,
  example: null,
  action: "Probier es aus.",
  effortTag: null,
  skill: null,
};

describe("HistoryList", () => {
  it("renders derived badges (Neu/SOTA/Best Practice) using the shared labels.ts functions", () => {
    const reel: FeedReel = {
      ...baseReel,
      publishedAt: new Date(Date.now() - 1 * 86_400_000), // within NEW_DAYS
    };

    const html = renderToStaticMarkup(<HistoryList reels={[reel]} />);

    expect(html).toContain("Ein Verlaufs-Item");
    expect(html).toContain("🆕 Neu");
    expect(html).toContain("⭐ SOTA"); // established + R90/Q90
    expect(html).toContain("🛠️ Best Practice"); // not experimental + action set + Q90
    expect(html).toContain("R 90");
    expect(html).toContain("Q 90");
  });

  it("omits derived badges for an old, low-scoring, experimental-maturity reel", () => {
    const reel: FeedReel = {
      ...baseReel,
      publishedAt: new Date("2020-01-01T00:00:00Z"),
      maturity: "experimental",
      relevanceScore: 40,
      qualityScore: 40,
      action: null,
    };

    const html = renderToStaticMarkup(<HistoryList reels={[reel]} />);

    expect(html).not.toContain("🆕 Neu");
    expect(html).not.toContain("⭐ SOTA");
    expect(html).not.toContain("🛠️ Best Practice");
  });

  it("shows the stored experimental flag badge independently of maturity", () => {
    const reel: FeedReel = { ...baseReel, experimental: true };
    const html = renderToStaticMarkup(<HistoryList reels={[reel]} />);
    expect(html).toContain("🧪 experimentell");
  });

  it("renders an empty-state message for no reels", () => {
    const html = renderToStaticMarkup(<HistoryList reels={[]} />);
    expect(html).toContain("Keine Reels für diese Filterkombination.");
  });
});
