import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildOverviewHref, OverviewFilterBar, type OverviewFilterState } from "./OverviewFilterBar";

describe("buildOverviewHref", () => {
  it("returns /overview when no filters are set", () => {
    expect(buildOverviewHref({}, {})).toBe("/overview");
  });

  it("sets a period filter", () => {
    expect(buildOverviewHref({}, { period: "30" })).toBe("/overview?period=30");
  });

  it("toggling period to undefined (alles) removes it", () => {
    expect(buildOverviewHref({ period: "30" }, { period: undefined })).toBe("/overview");
  });

  it("preserves other filters when changing one", () => {
    const current: OverviewFilterState = { category: "tooling", period: "90" };
    expect(buildOverviewHref(current, { bestPractice: "1" })).toBe(
      "/overview?period=90&category=tooling&bestPractice=1",
    );
  });

  it("round-trips a full filter combination", () => {
    const href = buildOverviewHref(
      {},
      {
        period: "90",
        category: "research",
        maturity: "established",
        minRelevance: "70",
        bestPractice: "1",
        experimental: "0",
      },
    );
    expect(href).toBe(
      "/overview?period=90&category=research&maturity=established&minRelevance=70&bestPractice=1&experimental=0",
    );
  });
});

describe("OverviewFilterBar", () => {
  it("renders period, category, maturity, relevance and toggle chips, marking active ones", () => {
    const html = renderToStaticMarkup(
      <OverviewFilterBar current={{ period: "30", category: "tooling", maturity: "established" }} />,
    );

    expect(html).toContain("30 days");
    expect(html).toContain("Tooling");
    expect(html).toContain("Established");
    expect(html).toContain("Relevance ≥ 70");
    expect(html).toContain("🛠️ Best Practice only");
    expect(html).toContain("experimental hide"); // default: shown, click hides
  });

  it("shows 'experimental show' when experimental=0 (currently hidden)", () => {
    const html = renderToStaticMarkup(<OverviewFilterBar current={{ experimental: "0" }} />);
    expect(html).toContain("experimental show");
    expect(html).toContain('href="/overview"'); // clicking removes the param, back to default (shown)
  });

  it("every rendered chip href is a bookmarkable /overview URL", () => {
    const html = renderToStaticMarkup(<OverviewFilterBar current={{ minRelevance: "50" }} />);
    expect(html).toMatch(/href="\/overview/);
  });
});
