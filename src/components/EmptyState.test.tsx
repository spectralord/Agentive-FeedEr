import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState (T18.12, §10.7)", () => {
  it("renders title and message for the default (page) variant", () => {
    const html = renderToStaticMarkup(<EmptyState title="Nothing here" message="Come back later." />);
    expect(html).toContain("Nothing here");
    expect(html).toContain("Come back later.");
    expect(html).toContain("h-[calc(100dvh-var(--tabbar-h))]");
  });

  it("renders an action link when given one", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No matches" action={{ href: "/", label: "Reset filters" }} />,
    );
    expect(html).toContain('href="/"');
    expect(html).toContain("Reset filters");
  });

  it("omits the action link when none is given", () => {
    const html = renderToStaticMarkup(<EmptyState title="No matches" />);
    expect(html).not.toContain("<a ");
  });

  it("inline variant centers within a max-w-xl column, no full-height flex", () => {
    const html = renderToStaticMarkup(<EmptyState variant="inline" title="Nothing saved yet" />);
    expect(html).toContain("max-w-xl");
    expect(html).not.toContain("h-[calc(100dvh-var(--tabbar-h))]");
  });

  it("compact variant is left-aligned and does not center text", () => {
    const html = renderToStaticMarkup(<EmptyState variant="compact" title="No adopted notes yet." />);
    expect(html).toContain("items-start");
    expect(html).not.toContain("text-center");
  });

  it("never mentions npm or a CLI command (the developer-facing copy this replaces)", () => {
    const html = renderToStaticMarkup(<EmptyState title="The feed is empty" message="Check back soon." />);
    expect(html.toLowerCase()).not.toMatch(/npm|job:daily|shell|command line/);
  });

  it("uses only neutral/ink tokens, never --gold or --caution (ADR 0016)", () => {
    const html = renderToStaticMarkup(<EmptyState title="x" />);
    expect(html).not.toMatch(/text-gold|bg-gold|text-caution|bg-caution/);
  });
});
