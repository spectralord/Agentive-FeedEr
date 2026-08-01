import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/skills";
import { LAYOUT_SPACE_SIZE, THEME_LAYOUT } from "./layout";

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
