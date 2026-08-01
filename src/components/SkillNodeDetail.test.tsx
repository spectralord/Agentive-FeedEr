import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SkillNode, UserProgressNote } from "@/db/schema";
import { THEME_LABELS } from "@/lib/skills";
import type { SkillNodeDetail as SkillNodeDetailData } from "@/lib/skills/map";
import { SkillNodeDetail } from "./SkillNodeDetail";

const node: SkillNode = {
  id: 1,
  slug: "sub-agents",
  title: "Sub-Agents",
  theme: "agents",
  description: "Splitting work across parallel agents.",
  status: "active",
  createdAt: new Date("2026-07-01T00:00:00Z"),
};

const note: UserProgressNote = {
  id: 1,
  skillNodeId: 1,
  status: "tried",
  note: "Tried the sub-agent pattern on a real task.",
  createdAt: new Date("2026-07-20T00:00:00Z"),
};

const baseDetail: SkillNodeDetailData = {
  node,
  content: [
    { type: "reel", id: 10, title: "A reel about sub-agents", url: "https://example.com/reel", publishedAt: new Date("2026-07-19T00:00:00Z") },
    { type: "report", id: 20, title: "My experience report", authorLabel: "Me", createdAt: new Date("2026-07-18T00:00:00Z") },
  ],
  status: "tried",
  notes: [note],
  actionables: [],
  evidenceCount: 0,
};

describe("SkillNodeDetail", () => {
  it("renders title, theme label (not the raw slug), description, the status ring, and the status label", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={baseDetail} />);
    expect(html).toContain("Sub-Agents");
    expect(html).toContain(THEME_LABELS.agents);
    expect(html).toContain("Splitting work across parallel agents.");
    expect(html).toContain("tried");
    // The shared SkillRing renders here (T18.5) — a partial --accent arc for "tried".
    expect(html).toContain("var(--color-accent)");
  });

  it("only offers forms for the two reachable (non-current) statuses", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={baseDetail} />);
    expect(html).toContain("Mark as seen");
    expect(html).toContain("Mark as mastered");
    expect(html).not.toContain("Mark as tried"); // current status, not offered as a target
    expect(html).toContain(`action="/skills/${node.slug}/progress"`);
  });

  it("labels and links Reels and Experience Reports separately", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={baseDetail} />);
    expect(html).toContain("A reel about sub-agents");
    expect(html).toContain('href="https://example.com/reel"');
    expect(html).toContain("My experience report");
    expect(html).toContain('href="/experience/20/edit"');
    expect(html).toContain(">Reel<");
    expect(html).toContain(">Report<");
  });

  it("shows an empty state when no content is tagged yet", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={{ ...baseDetail, content: [] }} />);
    expect(html).toContain("Nothing tagged with this skill yet.");
  });

  it("renders the note history chronologically with status and text", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={baseDetail} />);
    expect(html).toContain("Tried the sub-agent pattern on a real task.");
    expect(html).toContain("Note history (1)");
  });

  it("shows an empty state for no notes", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={{ ...baseDetail, notes: [] }} />);
    expect(html).toContain("No notes yet.");
  });

  it("T18.4: renders the untouched status (no user_progress row) and offers all three declarable statuses", () => {
    const html = renderToStaticMarkup(
      <SkillNodeDetail detail={{ ...baseDetail, status: "untouched", notes: [] }} />,
    );
    expect(html).toContain("untouched");
    expect(html).toContain("Mark as seen");
    expect(html).toContain("Mark as tried");
    expect(html).toContain("Mark as mastered");
  });

  it("T18.5: shows no confirmation line on an ordinary view (no previousStatus)", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={baseDetail} />);
    expect(html).not.toContain("Marked as");
  });

  it("T18.5: shows a plain confirmation line when previousStatus differs from the current status", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={baseDetail} previousStatus="seen" />);
    expect(html).toContain("Marked as tried.");
  });

  it("T18.5: shows no confirmation line when previousStatus equals the current status", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={baseDetail} previousStatus="tried" />);
    expect(html).not.toContain("Marked as");
  });

  // Epic 20 (ADR 0019 decision 2): the two tracks, side by side.
  it("T20.4: shows the evidenced count alongside the declared status, independently", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={{ ...baseDetail, evidenceCount: 3 }} />);
    expect(html).toContain("3 items");
    expect(html).toContain("Evidenced");
    expect(html).toContain("Declared");
  });

  it("T20.4: 'mastered with zero evidence' renders both honestly, not collapsed into one number", () => {
    const html = renderToStaticMarkup(
      <SkillNodeDetail detail={{ ...baseDetail, status: "mastered", evidenceCount: 0 }} />,
    );
    expect(html).toContain("mastered");
    expect(html).toContain("0 items");
  });

  it("T20.4: shows a 'No sourced actions' empty state when the node has no Actionables", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={{ ...baseDetail, actionables: [] }} />);
    expect(html).toContain("To-Try (0)");
    expect(html).toContain("No sourced actions for this skill yet.");
  });

  it("T20.4: lists Actionables with title, action text, effort label, and a tick control", () => {
    const html = renderToStaticMarkup(
      <SkillNodeDetail
        detail={{
          ...baseDetail,
          actionables: [
            {
              reelId: 10,
              title: "A reel about sub-agents",
              url: "https://example.com/reel",
              publishedAt: new Date("2026-07-19T00:00:00Z"),
              action: "Try splitting into two agents.",
              effortTag: "afternoon",
              completion: null,
              supersession: null,
            },
          ],
        }}
      />,
    );
    expect(html).toContain("To-Try (1)");
    expect(html).toContain("Try splitting into two agents.");
    expect(html).toContain("Afternoon");
    expect(html).toContain("Mark as done");
  });

  it("T20.4: an already-completed Actionable shows the snapshotted text and 'Done'", () => {
    const html = renderToStaticMarkup(
      <SkillNodeDetail
        detail={{
          ...baseDetail,
          actionables: [
            {
              reelId: 10,
              title: "A reel about sub-agents",
              url: "https://example.com/reel",
              publishedAt: new Date("2026-07-19T00:00:00Z"),
              action: "Try Y (rewritten since).",
              effortTag: "afternoon",
              completion: {
                actionText: "Try X (as originally ticked).",
                effortTag: "afternoon",
                note: null,
                doneAt: new Date("2026-07-20T00:00:00Z"),
              },
              supersession: null,
            },
          ],
        }}
      />,
    );
    // Decision 5: the row shows the SNAPSHOT, not the live (possibly
    // rewritten) reels.action.
    expect(html).toContain("Try X (as originally ticked).");
    expect(html).not.toContain("Try Y (rewritten since).");
  });

  it("T20.4 (ADR 0019 resolved open question): labels supersession with --caution, never hides the row", () => {
    const html = renderToStaticMarkup(
      <SkillNodeDetail
        detail={{
          ...baseDetail,
          actionables: [
            {
              reelId: 10,
              title: "A reel about sub-agents",
              url: "https://example.com/reel",
              publishedAt: new Date("2026-07-19T00:00:00Z"),
              action: "Try the old way.",
              effortTag: null,
              completion: null,
              supersession: { reason: "A newer approach replaces this.", supersededByClusterId: 5 },
            },
          ],
        }}
      />,
    );
    expect(html).toContain("Newer available: A newer approach replaces this.");
    expect(html).toContain("text-caution");
    // Still listed, not hidden.
    expect(html).toContain("Try the old way.");
  });

  it("T20.4: filter buttons render one per effort tag plus All, and a sort toggle", () => {
    const html = renderToStaticMarkup(
      <SkillNodeDetail
        detail={{
          ...baseDetail,
          actionables: [
            {
              reelId: 10,
              title: "R",
              url: "https://example.com/reel",
              publishedAt: new Date("2026-07-19T00:00:00Z"),
              action: "Do it.",
              effortTag: "5-min-test",
              completion: null,
              supersession: null,
            },
          ],
        }}
      />,
    );
    expect(html).toContain("All");
    expect(html).toContain("5-min test");
    expect(html).toContain("Afternoon");
    expect(html).toContain("Know only");
    expect(html).toContain("Sort:");
  });
});
