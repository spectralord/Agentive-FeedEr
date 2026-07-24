import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SavedReel } from "@/lib/interactions";
import { SavedList } from "./SavedList";

const baseSavedReel: SavedReel = {
  id: 1,
  rawItemId: 1,
  title: "Ein gespeichertes Item",
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
  savedAt: new Date(Date.now() - 2 * 86_400_000),
};

describe("SavedList", () => {
  it("renders a saved reel with save-age, source, badges, scores and a remove form", () => {
    const html = renderToStaticMarkup(<SavedList reels={[baseSavedReel]} />);

    expect(html).toContain("Ein gespeichertes Item");
    expect(html).toContain("Saved 2 days ago");
    expect(html).toContain("some-source");
    expect(html).toContain("Tooling");
    expect(html).toContain("Established");
    expect(html).toContain("R 90");
    expect(html).toContain("Q 90");
    expect(html).toContain('action="/saved/1/remove"');
    expect(html).toContain("Remove");
  });

  it("has no 'tried/erledigt' checkbox (revised scope, epic-6)", () => {
    const html = renderToStaticMarkup(<SavedList reels={[baseSavedReel]} />);
    expect(html).not.toContain("erledigt");
    expect(html).not.toContain("checkbox");
  });

  it("renders an empty-state message when nothing is saved", () => {
    const html = renderToStaticMarkup(<SavedList reels={[]} />);
    expect(html).toContain("Nothing saved yet");
  });
});
