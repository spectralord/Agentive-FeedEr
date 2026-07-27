import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BackLink } from "./BackLink";

describe("BackLink", () => {
  it("renders an arrow, the label, and links to the given href", () => {
    const html = renderToStaticMarkup(<BackLink href="/skills" label="Skill Map" />);
    expect(html).toContain('href="/skills"');
    expect(html).toContain("Back to Skill Map");
    expect(html).toContain("←");
  });
});
