import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/skills";
import { LAYOUT_SPACE_SIZE, resolveNodePosition, THEME_LAYOUT, type PositionableNode } from "./layout";

// Epic 21, T21.2 (ADR 0020 decisions 1 & 6): THEME_LAYOUT is a hand-placed
// code constant, not derived/DB state, but it still needs to stay a valid
// layout as THEMES or radii change — exhaustiveness (every theme has a
// region) and non-overlap (no two circles intersect) are the two ways this
// constant can silently rot.
describe("THEME_LAYOUT", () => {
  it("has an entry for every THEMES value (exhaustiveness)", () => {
    for (const theme of THEMES) {
      expect(THEME_LAYOUT[theme]).toBeDefined();
      expect(THEME_LAYOUT[theme].r).toBeGreaterThan(0);
    }
    expect(Object.keys(THEME_LAYOUT).sort()).toEqual([...THEMES].sort());
  });

  it("keeps every region fully inside the abstract coordinate space", () => {
    for (const [theme, { cx, cy, r }] of Object.entries(THEME_LAYOUT)) {
      expect(cx - r, `${theme}: left edge`).toBeGreaterThanOrEqual(0);
      expect(cx + r, `${theme}: right edge`).toBeLessThanOrEqual(LAYOUT_SPACE_SIZE);
      expect(cy - r, `${theme}: top edge`).toBeGreaterThanOrEqual(0);
      expect(cy + r, `${theme}: bottom edge`).toBeLessThanOrEqual(LAYOUT_SPACE_SIZE);
    }
  });

  it("has no two overlapping regions (distance between centres >= sum of radii)", () => {
    const entries = Object.entries(THEME_LAYOUT);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [nameA, a] = entries[i];
        const [nameB, b] = entries[j];
        const distance = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        expect(distance, `${nameA} vs ${nameB} must not overlap`).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });
});

function node(overrides: Partial<PositionableNode> = {}): PositionableNode {
  return {
    slug: "some-skill",
    theme: "agents",
    positionX: null,
    positionY: null,
    positionLocked: false,
    ...overrides,
  };
}

// Epic 21, T21.3 (ADR 0020 decision 2): the three-tier resolution — locked
// override, then stored computed layout, then the deterministic hash
// fallback — is the mechanism that guarantees every node has *some* stable
// position even before any layout pass exists.
describe("resolveNodePosition", () => {
  it("falls through to the hash tier when no position is stored", () => {
    const pos = resolveNodePosition(node({ slug: "prompt-caching", theme: "prompting" }));
    expect(pos.x).toBeTypeOf("number");
    expect(pos.y).toBeTypeOf("number");
  });

  it("the hash tier is pure and stable: the same slug yields the identical point on every call", () => {
    const a = resolveNodePosition(node({ slug: "mcp-servers", theme: "agents" }));
    const b = resolveNodePosition(node({ slug: "mcp-servers", theme: "agents" }));
    const c = resolveNodePosition(node({ slug: "mcp-servers", theme: "agents" }));
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("different slugs (even in the same theme) land on different points", () => {
    const a = resolveNodePosition(node({ slug: "agentic-tool-use", theme: "agents" }));
    const b = resolveNodePosition(node({ slug: "computer-use", theme: "agents" }));
    expect(a).not.toEqual(b);
  });

  it("every hash-tier point lands inside its theme's circle, for every theme", () => {
    for (const theme of THEMES) {
      const region = THEME_LAYOUT[theme];
      for (const slug of ["alpha", "beta", "gamma", "delta-skill", "z"]) {
        const pos = resolveNodePosition(node({ slug: `${slug}-${theme}`, theme }));
        const distanceFromCentre = Math.hypot(pos.x - region.cx, pos.y - region.cy);
        expect(distanceFromCentre, `${theme}/${slug} must land inside its circle`).toBeLessThanOrEqual(region.r);
      }
    }
  });

  it("prefers the stored position over the hash fallback when present but not locked", () => {
    const pos = resolveNodePosition(node({ positionX: 111, positionY: 222, positionLocked: false }));
    expect(pos).toEqual({ x: 111, y: 222 });
  });

  it("prefers the locked manual override over everything else", () => {
    const pos = resolveNodePosition(node({ positionX: 333, positionY: 444, positionLocked: true }));
    expect(pos).toEqual({ x: 333, y: 444 });
  });

  it("precedence: locked beats stored beats hash — verified by observing which value wins", () => {
    const hashOnly = resolveNodePosition(node({ slug: "prompt-caching", theme: "prompting" }));
    const stored = resolveNodePosition(
      node({ slug: "prompt-caching", theme: "prompting", positionX: 500, positionY: 500, positionLocked: false }),
    );
    const locked = resolveNodePosition(
      node({ slug: "prompt-caching", theme: "prompting", positionX: 999, positionY: 999, positionLocked: true }),
    );

    // Stored overrides the hash tier...
    expect(stored).not.toEqual(hashOnly);
    expect(stored).toEqual({ x: 500, y: 500 });
    // ...and a locked position overrides a merely-stored one.
    expect(locked).not.toEqual(stored);
    expect(locked).toEqual({ x: 999, y: 999 });
  });

  it("a node with x/y present but not locked still resolves from the stored tier (locked is not required to use stored data)", () => {
    const pos = resolveNodePosition(node({ positionX: 42, positionY: 84, positionLocked: false }));
    expect(pos).toEqual({ x: 42, y: 84 });
  });

  // Regression (T21.4 screenshot review): the first hash implementation
  // (independent continuous angle+radius per slug) placed
  // agentic-tool-use/mcp-servers/computer-use — this project's actual
  // seeded `agents`-theme nodes — within ~60 units of each other in a
  // 150-radius circle, close enough that their rendered SkillRings and
  // labels visibly overlapped. The sunflower-spiral slot approach exists
  // specifically to keep this from recurring.
  it("keeps this project's real seeded agents-theme slugs comfortably separated (regression)", () => {
    const slugs = ["agentic-tool-use", "mcp-servers", "computer-use"];
    const positions = slugs.map((slug) => resolveNodePosition(node({ slug, theme: "agents" })));
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const distance = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
        expect(distance, `${slugs[i]} vs ${slugs[j]}`).toBeGreaterThanOrEqual(45);
      }
    }
  });

  it("keeps a batch of arbitrary slugs within a small theme comfortably separated, for every theme", () => {
    const batch = Array.from({ length: 6 }, (_, i) => `skill-${i}`);
    for (const theme of THEMES) {
      const positions = batch.map((slug) => resolveNodePosition(node({ slug, theme })));
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const distance = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
          // Same-slot hash collisions are possible in principle (see
          // hashSlotCount's docstring) but shouldn't happen for 6 slugs
          // against a region sized to hold at least 6 well-spaced slots.
          expect(distance, `${theme}: ${batch[i]} vs ${batch[j]}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
