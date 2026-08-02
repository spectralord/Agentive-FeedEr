import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionableTick } from "./ActionableTick";

/**
 * T20.4 (§8.4): the ONE tick component both call sites (Reel Detail Skill
 * tab, node page To-Try list) render. Static-render smoke tests only, same
 * convention as `GenerateWriteupButton` (ReelDetail.tsx) elsewhere in this
 * codebase — the project doesn't use a DOM test harness (jsdom/RTL aren't
 * dependencies here), so click/optimistic-revert behaviour is exercised
 * through the real app (screenshots + manual check) rather than a simulated
 * click. `toggleActionable`'s actual mutation semantics are covered
 * thoroughly by src/lib/actionables/index.integration.test.ts, and the route
 * wrapper by the route's own route.test.ts — this file only pins that the
 * two variants render the right initial markup and touch-target shape.
 */
describe("ActionableTick", () => {
  it("compact variant (Reel Detail action box) renders 'Mark as done' when not completed", () => {
    const html = renderToStaticMarkup(<ActionableTick reelId={1} initialDone={false} />);
    expect(html).toContain("Mark as done");
    expect(html).toContain('aria-pressed="false"');
  });

  it("compact variant renders 'Done' when already completed", () => {
    const html = renderToStaticMarkup(<ActionableTick reelId={1} initialDone />);
    expect(html).toContain(">Done<");
    expect(html).toContain('aria-pressed="true"');
  });

  it("row variant (node page list) renders an icon-only button at the >=40px touch floor", () => {
    const html = renderToStaticMarkup(<ActionableTick reelId={1} initialDone={false} variant="row" />);
    expect(html).toContain("min-h-10");
    expect(html).toContain("min-w-10");
    expect(html).toContain('aria-label="Mark as done"');
  });

  it("row variant's aria-label flips once done", () => {
    const html = renderToStaticMarkup(<ActionableTick reelId={1} initialDone variant="row" />);
    expect(html).toContain('aria-label="Mark as not done"');
  });
});
