import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SkillMapTheme } from "@/lib/skills/map";
import { SkillMap } from "./SkillMap";

const themes: SkillMapTheme[] = [
  {
    theme: "Agentic Development",
    nodes: [
      { id: 1, slug: "sub-agents", title: "Sub-Agents", theme: "Agentic Development", description: "…", contentCount: 3, status: "tried" },
    ],
  },
];

describe("SkillMap", () => {
  it("renders theme headings and node tiles with title, content count, and status", () => {
    const html = renderToStaticMarkup(<SkillMap themes={themes} />);
    expect(html).toContain("Agentic Development");
    expect(html).toContain("Sub-Agents");
    expect(html).toContain("3 items");
    expect(html).toContain("tried");
    expect(html).toContain('href="/skills/sub-agents"');
  });

  it("singularizes the item count for exactly one item", () => {
    const html = renderToStaticMarkup(
      <SkillMap
        themes={[
          {
            theme: "Tooling & Workflow",
            nodes: [{ id: 2, slug: "mcp", title: "MCP", theme: "Tooling & Workflow", description: "…", contentCount: 1, status: "seen" }],
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
});
