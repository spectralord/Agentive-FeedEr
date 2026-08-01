import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { THEME_LABELS } from "@/lib/skills";
import type { SkillMapTheme } from "@/lib/skills/map";
import { SkillMap } from "./SkillMap";

const themes: SkillMapTheme[] = [
  {
    theme: "agents",
    nodes: [
      {
        id: 1,
        slug: "sub-agents",
        title: "Sub-Agents",
        theme: "agents",
        description: "…",
        contentCount: 3,
        status: "tried",
        experimentalDot: false,
        evidenceCount: 0,
      },
    ],
  },
];

describe("SkillMap", () => {
  it("renders theme headings (as THEME_LABELS, not the raw slug) and node tiles with title, content count, and a status ring", () => {
    const html = renderToStaticMarkup(<SkillMap themes={themes} />);
    expect(html).toContain(THEME_LABELS.agents);
    expect(html).toContain("Sub-Agents");
    expect(html).toContain("3 items");
    expect(html).toContain('href="/skills/sub-agents"');
    // "tried" renders as SkillRing's partial --accent arc, not plain text.
    expect(html).toContain("var(--color-accent)");
  });

  it("singularizes the item count for exactly one item", () => {
    const html = renderToStaticMarkup(
      <SkillMap
        themes={[
          {
            theme: "tooling",
            nodes: [
              {
                id: 2,
                slug: "mcp",
                title: "MCP",
                theme: "tooling",
                description: "…",
                contentCount: 1,
                status: "seen",
                experimentalDot: false,
                evidenceCount: 0,
              },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain("1 item");
    expect(html).not.toContain("1 items");
  });

  it("shows an empty state when there are no active nodes", () => {
    const html = renderToStaticMarkup(<SkillMap themes={[]} />);
    expect(html).toContain("No active skill nodes yet");
  });

  it("T18.4/T18.5: renders untouched (barely-visible track) distinctly from seen (gray track) via the ring, not plain text", () => {
    const html = renderToStaticMarkup(
      <SkillMap
        themes={[
          {
            theme: "tooling",
            nodes: [
              {
                id: 3,
                slug: "never-opened",
                title: "Never Opened",
                theme: "tooling",
                description: "…",
                contentCount: 0,
                status: "untouched",
                experimentalDot: false,
                evidenceCount: 0,
              },
            ],
          },
        ]}
      />,
    );
    // untouched is the only frac-0 rung: outline track, no progress arc at all.
    expect(html).toContain("var(--color-hairline-strong)");
    expect(html).not.toContain("stroke-dashoffset");
  });

  it("T18.5: shows the experimental-dot marker only when the node's flag is set", () => {
    const withDot = renderToStaticMarkup(
      <SkillMap
        themes={[
          {
            theme: "tooling",
            nodes: [
              {
                id: 4,
                slug: "mostly-experimental",
                title: "Mostly Experimental",
                theme: "tooling",
                description: "…",
                contentCount: 5,
                status: "seen",
                experimentalDot: true,
                evidenceCount: 0,
              },
            ],
          },
        ]}
      />,
    );
    expect(withDot).toContain("Majority experimental");

    const withoutDot = renderToStaticMarkup(<SkillMap themes={themes} />);
    expect(withoutDot).not.toContain("Majority experimental");
  });
});
