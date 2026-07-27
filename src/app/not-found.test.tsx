import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("root not-found.tsx (T18.8, §10.2)", () => {
  it("renders a designed page, not an empty shell, with a way back to the Feed", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).toContain("Page not found");
    expect(html).toContain('href="/"');
    expect(html).toContain("Back to Feed");
  });

  it("uses only neutral/ink tokens, never --gold or --caution (ADR 0016)", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).not.toMatch(/text-gold|bg-gold|text-caution|bg-caution/);
  });
});
