import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SkillRing } from "./SkillRing";

describe("SkillRing", () => {
  it("untouched: bare outline track only — no progress arc, no glyph", () => {
    const html = renderToStaticMarkup(<SkillRing status="untouched" />);
    expect(html).toContain("var(--color-hairline-strong)");
    expect(html).not.toContain("var(--color-ink-muted)");
    expect(html).not.toContain("var(--color-accent)");
    expect(html).not.toContain("var(--color-gold)");
    expect(html).not.toContain("★");
    // The only frac-0 state: no progress arc is rendered at all.
    expect(html).not.toContain("stroke-dashoffset");
  });

  // Four-rung progression per skill-constellation.html (the binding prototype
  // for §5.1): untouched 0 · seen .33 · tried .66 · mastered 1.
  it("seen: a neutral partial arc — distinguishable from untouched, not yet --accent", () => {
    const html = renderToStaticMarkup(<SkillRing status="seen" />);
    expect(html).toContain("var(--color-ink-muted)");
    expect(html).not.toContain("var(--color-accent)");
    expect(html).not.toContain("var(--color-gold)");
    expect(html).not.toContain("★");
    const match = html.match(/stroke-dashoffset="([\d.]+)"/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThan(0);
  });

  it("seen fills less of the ring than tried (the rungs are ordered)", () => {
    const offset = (status: "seen" | "tried") =>
      Number(
        renderToStaticMarkup(<SkillRing status={status} />).match(
          /stroke-dashoffset="([\d.]+)"/,
        )![1],
      );
    // Less progress = more remaining dash offset.
    expect(offset("seen")).toBeGreaterThan(offset("tried"));
  });

  it("tried: a partial --accent progress arc, no glyph", () => {
    const html = renderToStaticMarkup(<SkillRing status="tried" />);
    expect(html).toContain("var(--color-accent)");
    expect(html).not.toContain("var(--color-gold)");
    expect(html).not.toContain("★");
    // Partial fill: dashoffset is > 0 and < full circumference.
    const match = html.match(/stroke-dashoffset="([\d.]+)"/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThan(0);
  });

  it("mastered: a full --gold progress arc plus the ★ glyph", () => {
    const html = renderToStaticMarkup(<SkillRing status="mastered" />);
    expect(html).toContain("var(--color-gold)");
    expect(html).toContain("★");
    const match = html.match(/stroke-dashoffset="([\d.]+)"/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeCloseTo(0, 1);
  });

  it("without previousStatus, renders the final state directly (no query-param dependency, no replay)", () => {
    const html = renderToStaticMarkup(<SkillRing status="mastered" />);
    expect(html).toContain("★");
  });

  it("with a differing previousStatus, the initial (pre-hydration) markup shows the OLD state — the animation is a client-side transition, not a server-rendered jump", () => {
    const html = renderToStaticMarkup(<SkillRing status="mastered" previousStatus="seen" />);
    expect(html).not.toContain("★");
    expect(html).not.toContain("var(--color-gold)");
    // The OLD rung (seen = neutral .33 arc), not the target gold one.
    expect(html).toContain("var(--color-ink-muted)");
  });

  it("when previousStatus equals status, behaves as an ordinary unanimated render", () => {
    const html = renderToStaticMarkup(<SkillRing status="tried" previousStatus="tried" />);
    expect(html).toContain("var(--color-accent)");
  });

  it("size scales the SVG viewBox and radius proportionally", () => {
    const html = renderToStaticMarkup(<SkillRing status="mastered" size={40} />);
    expect(html).toContain('width="40"');
    expect(html).toContain('viewBox="0 0 40 40"');
  });
});
