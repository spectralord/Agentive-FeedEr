import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildExperienceHref, ExperienceFilterBar } from "./ExperienceFilterBar";

describe("buildExperienceHref", () => {
  it("returns the bare path when no filters are set", () => {
    expect(buildExperienceHref({}, {})).toBe("/experience");
  });

  it("preserves existing fields and applies overrides", () => {
    const href = buildExperienceHref({ authorType: "own" }, { deprecated: "1" });
    expect(href).toContain("authorType=own");
    expect(href).toContain("deprecated=1");
  });

  it("drops a field when overridden to undefined", () => {
    const href = buildExperienceHref({ authorType: "own" }, { authorType: undefined });
    expect(href).toBe("/experience");
  });
});

describe("ExperienceFilterBar", () => {
  it("highlights the active author_type chip and default toggle labels", () => {
    const html = renderToStaticMarkup(<ExperienceFilterBar current={{}} />);
    expect(html).toContain("Alle");
    expect(html).toContain("Eigen");
    expect(html).toContain("Kuratiert");
    expect(html).toContain("veraltete zeigen");
    expect(html).toContain("archivierte zeigen");
  });

  it("flips toggle labels to 'ausblenden' when active", () => {
    const html = renderToStaticMarkup(
      <ExperienceFilterBar current={{ deprecated: "1", archived: "1" }} />,
    );
    expect(html).toContain("veraltete ausblenden");
    expect(html).toContain("archivierte ausblenden");
  });
});
