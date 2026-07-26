import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FeedReel } from "@/lib/feed";
import { ReelCard, ReelCardBody } from "./ReelCard";

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
  writeup: null,
};

describe("ReelCardBody (Compact — T18.6: exactly compactHtml())", () => {
  it("renders meta row, badges, title, summary, and the new tap-hint", () => {
    const html = renderToStaticMarkup(<ReelCardBody reel={baseReel} />);

    expect(html).toContain("simon-willison");
    expect(html).toContain("Ein Titel");
    expect(html).toContain("Eine Zusammenfassung.");
    expect(html).toContain("tap for details");
    // ReelActions (🔖/👍/👎/🙈) is rendered by ReelCardShell, not
    // ReelCardBody — covered by the ReelCard-level tests below instead.
  });

  it("never renders example, the source link, or the Action block — moved to the Write-up/Skill tabs (T18.6/T18.7)", () => {
    const reel: FeedReel = {
      ...baseReel,
      experimental: true,
      example: "const x = 42;",
      action: "Probiere das Feature in deinem nächsten Projekt aus.",
      effortTag: "5-min-test",
    };

    const html = renderToStaticMarkup(<ReelCardBody reel={reel} />);

    expect(html).toContain("🧪 experimental");
    expect(html).toContain("🆕 New");
    expect(html).not.toContain("Example (from the source)");
    expect(html).not.toContain("const x = 42;");
    expect(html).not.toContain("View source");
    expect(html).not.toContain(`href="https://example.com/item"`);
    expect(html).not.toContain("➜ For you:");
    expect(html).not.toContain("Probiere das Feature");
    expect(html).not.toContain("5-min test");
  });

  it("moves R/Q scores to the header as a bar-only score-mini (T18.2, §7 #3)", () => {
    const html = renderToStaticMarkup(<ReelCardBody reel={baseReel} />);

    expect(html).not.toContain("R 82");
    expect(html).not.toContain("Q 74");
    expect(html).toContain("Relevance 82/100");
    expect(html).toContain("Quality 74/100");
    expect(html).toContain("width:82%");
    expect(html).toContain("width:74%");
  });

  it("renders reel.skill as the badge row's one colored skill badge (T18.2, §7 #4)", () => {
    const reel: FeedReel = { ...baseReel, skill: "agent-skills" };
    const html = renderToStaticMarkup(<ReelCardBody reel={reel} />);
    expect(html).toContain("agent-skills");
  });

  it("gives the confidence badge a distinct dot-tick treatment from plain chips (T18.2)", () => {
    const reel: FeedReel = { ...baseReel, confidence: "strong" };
    const html = renderToStaticMarkup(<ReelCardBody reel={reel} />);
    expect(html).toContain("Strong corroboration");
  });

  it("renders a minimal reel (all nullable fields null) without crashing or showing empty sections", () => {
    const reel: FeedReel = {
      ...baseReel,
      publishedAt: new Date(Date.now() - 30 * 86_400_000), // outside NEW_DAYS
    };

    const html = renderToStaticMarkup(<ReelCardBody reel={reel} />);

    expect(html).toContain("Ein Titel");
    expect(html).not.toContain("🧪 experimental");
    expect(html).not.toContain("🆕 New");
    expect(html).toContain("Relevance 82/100");
    expect(html).toContain("Quality 74/100");
  });

  it("shows a minimal --caution marker only for caveat — never the full text (T18.2 judgment call 1)", () => {
    const reel: FeedReel = { ...baseReel, caveat: "Summary overclaims: source says X, not Y." };

    const html = renderToStaticMarkup(<ReelCardBody reel={reel} />);

    expect(html).toContain("Caveat noted");
    expect(html).not.toContain("Summary overclaims: source says X, not Y.");
  });

  it("shows no caveat marker when caveat is null", () => {
    const html = renderToStaticMarkup(<ReelCardBody reel={baseReel} />);
    expect(html).not.toContain("Caveat noted");
  });

  it("marks the freshness/supersession block data-no-open so the Detail tap-handler doesn't swallow its link/form (T18.6 §2.3)", () => {
    const reel: FeedReel = {
      ...baseReel,
      topicClusterId: 5,
      supersededByClusterId: 9,
      lifecycleState: "active",
    };
    const html = renderToStaticMarkup(<ReelCardBody reel={reel} />);
    expect(html).toContain("data-no-open");
    expect(html).toContain("Confirm superseded");
    expect(html).toContain('href="/clusters/9"');
  });
});

describe("ReelCard (Compact + Detail assembly)", () => {
  it("hydrates the action bar from the interactions prop (T6.2)", () => {
    const html = renderToStaticMarkup(
      <ReelCard reel={baseReel} interactions={{ save: true, up: false, down: false }} />,
    );
    expect(html).toContain('aria-pressed="true"');
  });

  it("Detail is always mounted (Write-up is never hidden, T18.6 judgment call 2) with Write-up as the first tab, and ReelActions still renders", () => {
    const html = renderToStaticMarkup(<ReelCard reel={baseReel} />);
    expect(html).toContain("Write-up");
    expect(html).toContain("‹");
    expect(html).toContain("Back");
    expect(html).toContain("🔖");
    expect(html).toContain("👍");
    expect(html).toContain("👎");
    expect(html).toContain("🙈");
  });

  it("moves example + the source reference into the Write-up tab, out of Compact (T18.2 deviation discharged)", () => {
    const reel: FeedReel = { ...baseReel, example: "const x = 42;" };
    const html = renderToStaticMarkup(<ReelCard reel={reel} />);

    expect(html).toContain("Example (from the source)");
    expect(html).toContain("const x = 42;");
    expect(html).toContain("From <b");
  });

  it("Write-up tab renders reels.writeup when present", () => {
    const reel: FeedReel = { ...baseReel, writeup: "Paragraph one.\n\nParagraph two." };
    const html = renderToStaticMarkup(<ReelCard reel={reel} />);
    expect(html).toContain("Paragraph one.");
    expect(html).toContain("Paragraph two.");
    expect(html).not.toContain("Long-form write-up not generated yet");
  });

  it("Write-up tab shows an explicit, unmistakable placeholder when writeup is null — never invented prose, never a silent re-show of summary (ADR 0016 point 3, ADR 0017)", () => {
    const html = renderToStaticMarkup(<ReelCard reel={baseReel} />);

    expect(html).toContain("Long-form write-up not generated yet");
    expect(html).toContain("Placeholder paragraph");
    expect(html).toContain("not derived from the source");

    // "never silently re-showing summary as if it were new content": the
    // Compact summary text appears exactly once in the whole render (in
    // Compact itself), not duplicated into the Write-up placeholder.
    const occurrences = html.split(baseReel.summary).length - 1;
    expect(occurrences).toBe(1);
  });

  it("Context tab renders the full caveat text (moved out of Compact) and an explicit empty state for cluster members", () => {
    const reel: FeedReel = { ...baseReel, caveat: "Summary overclaims: source says X, not Y." };
    const html = renderToStaticMarkup(<ReelCard reel={reel} />);

    expect(html).toContain("Context");
    expect(html).toContain("Summary overclaims: source says X, not Y.");
    expect(html).toContain("Single-sourced.");
    expect(html).toContain("No related coverage found");
  });

  it("hides the Context tab entirely when it would render only its empty state (§2.2 hiding rule)", () => {
    const html = renderToStaticMarkup(<ReelCard reel={baseReel} />);
    expect(html).not.toContain("Context");
  });

  it("shows the Context tab when a caveat is present, even with no cluster members", () => {
    const reel: FeedReel = { ...baseReel, caveat: "Something to flag." };
    const html = renderToStaticMarkup(<ReelCard reel={reel} />);
    expect(html).toContain("Context");
  });
});
