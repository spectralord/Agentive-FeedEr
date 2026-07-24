import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FeedReel } from "@/lib/feed";
import { ReelCard } from "./ReelCard";

const baseReel: FeedReel = {
  id: 1,
  rawItemId: 1,
  title: "Ein Titel",
  url: "https://example.com/item",
  publishedAt: new Date(Date.now() - 2 * 86_400_000), // within NEW_DAYS
  sourceName: "simon-willison",
  summary: "Eine Zusammenfassung.",
  category: "tooling",
  maturity: "established",
  experimental: false,
  relevanceScore: 82,
  qualityScore: 74,
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
};

describe("ReelCard", () => {
  it("renders a full reel with example, action, effort chip and derived new badge", () => {
    const reel: FeedReel = {
      ...baseReel,
      experimental: true,
      example: "const x = 42;",
      action: "Probiere das Feature in deinem nächsten Projekt aus.",
      effortTag: "5-min-test",
    };

    const html = renderToStaticMarkup(<ReelCard reel={reel} />);

    expect(html).toContain("simon-willison");
    expect(html).toContain("Ein Titel");
    expect(html).toContain("Eine Zusammenfassung.");
    expect(html).toContain("Example (from the source)");
    expect(html).toContain("const x = 42;");
    expect(html).toContain("➜ For you:");
    expect(html).toContain("Probiere das Feature");
    expect(html).toContain("5-min test");
    expect(html).toContain("🧪 experimental");
    expect(html).toContain("🆕 New");
    expect(html).toContain("R 82");
    expect(html).toContain("Q 74");
    expect(html).toContain('href="https://example.com/item"');
    expect(html).toContain("🔖");
    expect(html).toContain("👍");
    expect(html).toContain("👎");
    expect(html).toContain("🙈");
  });

  it("hydrates the action bar from the interactions prop (T6.2)", () => {
    const html = renderToStaticMarkup(
      <ReelCard reel={baseReel} interactions={{ save: true, up: false, down: false }} />,
    );
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders a minimal reel (all nullable fields null) without crashing or showing empty sections", () => {
    const reel: FeedReel = {
      ...baseReel,
      publishedAt: new Date(Date.now() - 30 * 86_400_000), // outside NEW_DAYS
    };

    const html = renderToStaticMarkup(<ReelCard reel={reel} />);

    expect(html).toContain("Ein Titel");
    expect(html).not.toContain("Example (from the source)");
    expect(html).not.toContain("➜ For you:");
    expect(html).not.toContain("🧪 experimental");
    expect(html).not.toContain("🆕 New");
    expect(html).toContain("R 82");
    expect(html).toContain("Q 74");
  });

  it("shows a subtle caveat notice when set, separate from the score footer (T10.4)", () => {
    const reel: FeedReel = { ...baseReel, caveat: "Summary overclaims: source says X, not Y." };

    const html = renderToStaticMarkup(<ReelCard reel={reel} />);

    expect(html).toContain("⚠️ Summary overclaims: source says X, not Y.");
    expect(html).toContain("R 82"); // scores unaffected by the caveat (ADR 0004)
    expect(html).toContain("Q 74");
  });

  it("shows no caveat notice when caveat is null", () => {
    const html = renderToStaticMarkup(<ReelCard reel={baseReel} />);
    expect(html).not.toContain("⚠️");
  });
});
