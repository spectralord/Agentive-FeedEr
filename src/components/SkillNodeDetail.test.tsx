import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SkillNode, UserProgressNote } from "@/db/schema";
import type { SkillNodeDetail as SkillNodeDetailData } from "@/lib/skills/map";
import { SkillNodeDetail } from "./SkillNodeDetail";

const node: SkillNode = {
  id: 1,
  slug: "sub-agents",
  title: "Sub-Agents",
  theme: "Agentic Development",
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
};

describe("SkillNodeDetail", () => {
  it("renders title, theme, description, and current status", () => {
    const html = renderToStaticMarkup(<SkillNodeDetail detail={baseDetail} />);
    expect(html).toContain("Sub-Agents");
    expect(html).toContain("Agentic Development");
    expect(html).toContain("Splitting work across parallel agents.");
    expect(html).toContain("Current status:");
    expect(html).toContain("tried");
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
});
