import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FeedReel } from "@/lib/feed";
import type { SkillTabInfo } from "@/lib/skills/reelSkillTab";
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
    const html = renderToStaticMarkup(<ReelCardBody reel={baseReel} newDays={7} />);

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

    const html = renderToStaticMarkup(<ReelCardBody reel={reel} newDays={7} />);

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
    const html = renderToStaticMarkup(<ReelCardBody reel={baseReel} newDays={7} />);

    expect(html).not.toContain("R 82");
    expect(html).not.toContain("Q 74");
    expect(html).toContain("Relevance 82/100");
    expect(html).toContain("Quality 74/100");
    expect(html).toContain("width:82%");
    expect(html).toContain("width:74%");
  });

  it("renders reel.skill as the badge row's one colored skill badge (T18.2, §7 #4)", () => {
    const reel: FeedReel = { ...baseReel, skill: "agent-skills" };
    const html = renderToStaticMarkup(<ReelCardBody reel={reel} newDays={7} />);
    expect(html).toContain("agent-skills");
  });

  it("gives the confidence badge a distinct dot-tick treatment from plain chips (T18.2)", () => {
    const reel: FeedReel = { ...baseReel, confidence: "strong" };
    const html = renderToStaticMarkup(<ReelCardBody reel={reel} newDays={7} />);
    expect(html).toContain("Strong corroboration");
  });

  it("renders a minimal reel (all nullable fields null) without crashing or showing empty sections", () => {
    const reel: FeedReel = {
      ...baseReel,
      publishedAt: new Date(Date.now() - 30 * 86_400_000), // outside NEW_DAYS
    };

    const html = renderToStaticMarkup(<ReelCardBody reel={reel} newDays={7} />);

    expect(html).toContain("Ein Titel");
    expect(html).not.toContain("🧪 experimental");
    expect(html).not.toContain("🆕 New");
    expect(html).toContain("Relevance 82/100");
    expect(html).toContain("Quality 74/100");
  });

  it("shows a minimal --caution marker only for caveat — never the full text (T18.2 judgment call 1)", () => {
    const reel: FeedReel = { ...baseReel, caveat: "Summary overclaims: source says X, not Y." };

    const html = renderToStaticMarkup(<ReelCardBody reel={reel} newDays={7} />);

    expect(html).toContain("Caveat noted");
    expect(html).not.toContain("Summary overclaims: source says X, not Y.");
  });

  it("shows no caveat marker when caveat is null", () => {
    const html = renderToStaticMarkup(<ReelCardBody reel={baseReel} newDays={7} />);
    expect(html).not.toContain("Caveat noted");
  });

  it("marks the freshness/supersession block data-no-open so the Detail tap-handler doesn't swallow its link/form (T18.6 §2.3)", () => {
    const reel: FeedReel = {
      ...baseReel,
      topicClusterId: 5,
      supersededByClusterId: 9,
      lifecycleState: "active",
    };
    const html = renderToStaticMarkup(<ReelCardBody reel={reel} newDays={7} />);
    expect(html).toContain("data-no-open");
    expect(html).toContain("Confirm superseded");
    expect(html).toContain('href="/clusters/9"');
  });
});

describe("ReelCard (Compact + Detail assembly)", () => {
  it("hydrates the action bar from the interactions prop (T6.2)", () => {
    const html = renderToStaticMarkup(
      <ReelCard reel={baseReel} newDays={7} interactions={{ save: true, up: false, down: false }} />,
    );
    expect(html).toContain('aria-pressed="true"');
  });

  it("Detail is always mounted (Write-up is never hidden, T18.6 judgment call 2) with Write-up as the first tab, and ReelActions still renders", () => {
    const html = renderToStaticMarkup(<ReelCard reel={baseReel} newDays={7} />);
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
    const html = renderToStaticMarkup(<ReelCard reel={reel} newDays={7} />);

    expect(html).toContain("Example (from the source)");
    expect(html).toContain("const x = 42;");
    // The source reference is a link since 2026-08-03 (owner feedback: the
    // registry name alone had no way to reach the actual item) — assert the
    // anchor exists and carries the Reel's own url, not raw "From <b" markup.
    expect(html).toContain("From");
    expect(html).toContain(`href="${reel.url}"`);
  });

  it("Write-up tab renders reels.writeup when present", () => {
    const reel: FeedReel = { ...baseReel, writeup: "Paragraph one.\n\nParagraph two." };
    const html = renderToStaticMarkup(<ReelCard reel={reel} newDays={7} />);
    expect(html).toContain("Paragraph one.");
    expect(html).toContain("Paragraph two.");
    expect(html).not.toContain("Long-form write-up not generated yet");
  });

  it("Write-up tab shows an explicit, unmistakable placeholder when writeup is null — never invented prose, never a silent re-show of summary (ADR 0016 point 3, ADR 0017)", () => {
    const html = renderToStaticMarkup(<ReelCard reel={baseReel} newDays={7} />);

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
    const html = renderToStaticMarkup(<ReelCard reel={reel} newDays={7} />);

    expect(html).toContain("Context");
    expect(html).toContain("Summary overclaims: source says X, not Y.");
    expect(html).toContain("Single-sourced.");
    expect(html).toContain("No related coverage found");
  });

  it("Context tab is NEVER hidden, even with no cluster members and no caveat (owner feedback 2026-08-03, supersedes §2.2 for this tab)", () => {
    const html = renderToStaticMarkup(<ReelCard reel={baseReel} newDays={7} />);
    expect(html).toContain("Context");
  });

  it("shows the Context tab when a caveat is present, even with no cluster members", () => {
    const reel: FeedReel = { ...baseReel, caveat: "Something to flag." };
    const html = renderToStaticMarkup(<ReelCard reel={reel} newDays={7} />);
    expect(html).toContain("Context");
  });
});

describe("ReelCard Skill tab (T18.7, §5.2/§8.4)", () => {
  const skillInfo: SkillTabInfo = {
    slug: "agent-skills",
    title: "Agent Skills",
    theme: "agents",
    description: "Building and structuring reusable Skills for Claude Code.",
    status: "seen",
    items: [
      // Same id as baseReel.id (1) — must be excluded from its own preview.
      { type: "reel", id: 1, title: "This reel itself", date: new Date(2026, 0, 4) },
      { type: "reel", id: 10, title: "Other reel A", date: new Date(2026, 0, 3) },
      { type: "report", id: 20, title: "Other report B", date: new Date(2026, 0, 2) },
      { type: "reel", id: 30, title: "Other reel C", date: new Date(2026, 0, 1) },
    ],
  };

  it("hides the Skill tab when the reel has no skill at all", () => {
    const html = renderToStaticMarkup(<ReelCard reel={baseReel} newDays={7} skillTabInfo={skillInfo} />);
    expect(html).not.toContain("Skill");
    expect(html).not.toContain("data-open-skill");
  });

  it("hides the Skill tab when reel.skill is set but no matching skillTabInfo was resolved", () => {
    const reel: FeedReel = { ...baseReel, skill: "agent-skills" };
    const html = renderToStaticMarkup(<ReelCard reel={reel} newDays={7} />);
    // The badge itself still renders (it's a Compact-level concern), but
    // the Skill tab in Detail must not appear without resolvable node data.
    expect(html).toContain("data-open-skill");
    expect(html).not.toContain(">Skill<");
  });

  it("shows the Skill tab with ring/name/theme/status/description when resolved, and wires the Compact badge to jump to it", () => {
    const reel: FeedReel = { ...baseReel, skill: "agent-skills" };
    const html = renderToStaticMarkup(<ReelCard reel={reel} newDays={7} skillTabInfo={skillInfo} />);

    expect(html).toContain("data-open-skill");
    expect(html).toContain(">Skill<");
    expect(html).toContain("Agent Skills");
    expect(html).toContain("agents");
    expect(html).toContain("Building and structuring reusable Skills for Claude Code.");
    // SkillRing (T18.5's ONE ring component) is reused, not reinvented.
    expect(html).toContain("var(--color-ink-muted)"); // "seen" rung
  });

  it("Sourced-only (ADR 0005): reel.action/effortTag show only when the reel actually has them", () => {
    const withAction: FeedReel = {
      ...baseReel,
      skill: "agent-skills",
      action: "Try writing one Skill for your own repeated review checklist.",
      effortTag: "afternoon",
    };
    const withActionHtml = renderToStaticMarkup(<ReelCard reel={withAction} newDays={7} skillTabInfo={skillInfo} />);
    expect(withActionHtml).toContain("Try writing one Skill for your own repeated review checklist.");
    expect(withActionHtml).toContain("Afternoon");

    const withoutAction: FeedReel = { ...baseReel, skill: "agent-skills" };
    const withoutActionHtml = renderToStaticMarkup(<ReelCard reel={withoutAction} newDays={7} skillTabInfo={skillInfo} />);
    expect(withoutActionHtml).not.toContain("Afternoon");
  });

  it("'Mark as tried' is offered ONLY when status is seen, and posts through the exact same /skills/[slug]/progress route+status the node page uses (§8.4 hard constraint)", () => {
    const reel: FeedReel = { ...baseReel, skill: "agent-skills" };

    const seenHtml = renderToStaticMarkup(<ReelCard reel={reel} newDays={7} skillTabInfo={{ ...skillInfo, status: "seen" }} />);
    expect(seenHtml).toContain('action="/skills/agent-skills/progress"');
    expect(seenHtml).toContain('method="post"');
    expect(seenHtml).toContain('name="status" value="tried"');
    expect(seenHtml).toContain("Mark as tried");

    for (const status of ["untouched", "tried", "mastered"] as const) {
      const html = renderToStaticMarkup(<ReelCard reel={reel} newDays={7} skillTabInfo={{ ...skillInfo, status }} />);
      expect(html).not.toContain("Mark as tried");
    }
  });

  it("shows a mastered note instead of the quick action once mastered", () => {
    const reel: FeedReel = { ...baseReel, skill: "agent-skills" };
    const html = renderToStaticMarkup(
      <ReelCard reel={reel} newDays={7} skillTabInfo={{ ...skillInfo, status: "mastered" }} />,
    );
    expect(html).toContain("Mastered");
    expect(html).not.toContain("Mark as tried");
  });

  it("shows up to 2 other associated items (excluding the reel's own row) plus a +N more link, and an Open in Skill Map link", () => {
    const reel: FeedReel = { ...baseReel, skill: "agent-skills" };
    const html = renderToStaticMarkup(<ReelCard reel={reel} newDays={7} skillTabInfo={skillInfo} />);

    expect(html).not.toContain("This reel itself"); // excluded (own row)
    expect(html).toContain("Other reel A");
    expect(html).toContain("Other report B");
    expect(html).not.toContain("Other reel C"); // beyond the cap of 2
    expect(html).toContain("+ 1 more");
    expect(html).toContain('href="/skills/agent-skills"');
    expect(html).toContain("Open in Skill Map");
  });
});
