import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SkillRing } from "./SkillRing";

describe("SkillRing", () => {
  it("untouched: barely-visible track, no progress arc, no glyph", () => {
    const html = renderToStaticMarkup(<SkillRing status="untouched" />);
    expect(html).toContain("var(--color-hairline)");
    expect(html).not.toContain("var(--color-hairline-strong)");
    expect(html).not.toContain("var(--color-accent)");
    expect(html).not.toContain("var(--color-gold)");
    expect(html).not.toContain("★");
  });

  it("seen: a more visible gray track, still no progress arc or glyph", () => {
    const html = renderToStaticMarkup(<SkillRing status="seen" />);
    expect(html).toContain("var(--color-hairline-strong)");
    expect(html).not.toContain("var(--color-accent)");
    expect(html).not.toContain("var(--color-gold)");
    expect(html).not.toContain("★");
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
    expect(html).toContain("var(--color-hairline-strong)");
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
