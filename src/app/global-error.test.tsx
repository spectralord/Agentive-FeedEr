import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

describe("root global-error.tsx (T18.8, §10.2)", () => {
  it("renders its own html/body with a retry affordance wired to reset()", () => {
    const reset = vi.fn();
    const html = renderToStaticMarkup(<GlobalError error={new Error("boom")} reset={reset} />);
    expect(html).toContain("<html");
    expect(html).toContain("<body");
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Try again");
  });

  it("uses inline styles rather than Tailwind classes (globals.css is not guaranteed loaded here)", () => {
    const html = renderToStaticMarkup(<GlobalError error={new Error("boom")} reset={() => {}} />);
    // A root-layout failure means layout.tsx (which imports globals.css) never
    // rendered — Tailwind utility classes like "text-ink"/"bg-ground" would be
    // unstyled here, so this file must not rely on them.
    expect(html).not.toMatch(/class="[^"]*\btext-ink\b/);
    expect(html).not.toMatch(/class="[^"]*\bbg-ground\b/);
  });
});
