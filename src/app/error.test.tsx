import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GlobalRouteError from "./error";

describe("root error.tsx (T18.8, §10.2)", () => {
  it("renders a retry affordance wired to reset()", () => {
    const reset = vi.fn();
    const html = renderToStaticMarkup(
      <GlobalRouteError error={new Error("boom")} reset={reset} />,
    );
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Try again");
    // renderToStaticMarkup never fires onClick — this just proves the
    // button element (with its handler attached at hydration time) exists,
    // matching the pattern this project's other client components use
    // (see SkillRing.test.tsx's notes on renderToStaticMarkup + client
    // components).
    expect(html).toContain("<button");
  });

  it("uses only neutral/ink tokens, never --gold or --caution (ADR 0016)", () => {
    const html = renderToStaticMarkup(
      <GlobalRouteError error={new Error("boom")} reset={() => {}} />,
    );
    expect(html).not.toMatch(/text-gold|bg-gold|text-caution|bg-caution/);
  });
});
