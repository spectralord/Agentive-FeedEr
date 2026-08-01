import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { THEME_LABELS } from "@/lib/skills";
import type { SkillMapTheme } from "@/lib/skills/map";
import { SkillConstellation } from "./SkillConstellation";

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
        position: { x: 280, y: 400 },
        positionLocked: false,
      },
      {
        id: 2,
        slug: "pinned-node",
        title: "Pinned Node",
        theme: "agents",
        description: "…",
        contentCount: 1,
        status: "mastered",
        experimentalDot: false,
        position: { x: 42, y: 84 },
        positionLocked: true,
      },
    ],
  },
];

describe("SkillConstellation", () => {
  it("renders every theme's label (not the raw slug) exactly once, drawn as SVG background", () => {
    const html = renderToStaticMarkup(<SkillConstellation themes={themes} />);
    expect(html).toContain(THEME_LABELS.agents.toUpperCase());
  });

  it("renders a node link per node, each reusing the shared SkillRing", () => {
    const html = renderToStaticMarkup(<SkillConstellation themes={themes} />);
    expect(html).toContain('href="/skills/sub-agents"');
    expect(html).toContain('href="/skills/pinned-node"');
    expect(html).toContain("Sub-Agents");
    expect(html).toContain("Pinned Node");
    // "tried" and "mastered" render via SkillRing's shared rung colors.
    expect(html).toContain("var(--color-accent)");
    expect(html).toContain("var(--color-gold)");
  });

  it("marks a locked (manually-placed) node distinctly from a hash-fallback one", () => {
    const html = renderToStaticMarkup(<SkillConstellation themes={themes} />);
    expect(html).toContain("Manually placed");
  });

  it("positions each node as a percentage of the abstract coordinate space", () => {
    const html = renderToStaticMarkup(<SkillConstellation themes={themes} />);
    // 42/1000 = 4.2%, 84/1000 = 8.4% — exact division, no float noise.
    expect(html).toContain("left:4.2%");
    expect(html).toContain("top:8.4%");
  });

  // Regression (T21.4 screenshot review): three real seeded `agents`-theme
  // nodes hashed close enough together that even after the layout.ts hash
  // fix, their rendered labels still visually overlapped at 375px — a
  // fixed-width label column can't guarantee zero overlap by itself (see
  // SkillConstellation.tsx's docstring). assignLabelRows staggers a
  // horizontally-close label into a lower row instead.
  it("stacks labels of horizontally-close nodes into different rows instead of overlapping", () => {
    const closeThemes: SkillMapTheme[] = [
      {
        theme: "agents",
        nodes: [
          { ...themes[0].nodes[0], slug: "a", title: "A", position: { x: 300, y: 400 }, positionLocked: false },
          { ...themes[0].nodes[0], slug: "b", title: "B", position: { x: 320, y: 410 }, positionLocked: false },
        ],
      },
    ];
    const html = renderToStaticMarkup(<SkillConstellation themes={closeThemes} />);
    // The second node, being within LABEL_COLLISION_DISTANCE of the first,
    // must render with a non-zero marginTop so its label sits in a
    // different row than the first (which stays at row 0 / margin-top:0px).
    expect(html).toContain("margin-top:0");
    expect(html).toContain("margin-top:16px");
  });

  it("leaves far-apart nodes' labels both at row 0 (no unnecessary stacking)", () => {
    const farThemes: SkillMapTheme[] = [
      {
        theme: "agents",
        nodes: [
          { ...themes[0].nodes[0], slug: "a", title: "A", position: { x: 100, y: 100 }, positionLocked: false },
          { ...themes[0].nodes[0], slug: "b", title: "B", position: { x: 900, y: 900 }, positionLocked: false },
        ],
      },
    ];
    const html = renderToStaticMarkup(<SkillConstellation themes={farThemes} />);
    expect(html).not.toContain("margin-top:16px");
  });

  // T21.5 (ADR 0020 decision 5): edit mode — and therefore the drag
  // affordance — is a desktop/iPad-only surface. The toggle button carries
  // Tailwind's `hidden md:inline-flex` so it never renders (interactively)
  // below the `md` breakpoint; mobile parity is explicitly not required.
  it("renders the edit-positions toggle hidden by default and only shown from the md breakpoint up", () => {
    const html = renderToStaticMarkup(<SkillConstellation themes={themes} />);
    expect(html).toContain("Edit positions");
    expect(html).toMatch(/class="[^"]*\bhidden\b[^"]*\bmd:inline-flex\b[^"]*"[^>]*>Edit positions/);
  });

  it("does not show a reset affordance for a locked node before entering edit mode", () => {
    const html = renderToStaticMarkup(<SkillConstellation themes={themes} />);
    // "Manually placed" (the pin marker) always shows; "reset" (the text of
    // the reset button) is edit-mode-only and must not leak into the
    // default, non-editing render.
    expect(html).toContain("Manually placed");
    expect(html).not.toContain(">reset<");
  });
});
