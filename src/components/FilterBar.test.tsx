import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildFilterHref, buildLoadMoreHref, FilterBar, type FilterState } from "./FilterBar";

describe("buildFilterHref", () => {
  it("returns / when no filters are set", () => {
    expect(buildFilterHref({}, {})).toBe("/");
  });

  it("sets a category filter", () => {
    expect(buildFilterHref({}, { category: "tooling" })).toBe("/?category=tooling");
  });

  it("toggling a category off (undefined override) removes it", () => {
    expect(buildFilterHref({ category: "tooling" }, { category: undefined })).toBe("/");
  });

  it("preserves other filters when changing one", () => {
    const current: FilterState = { category: "tooling", new: "1" };
    expect(buildFilterHref(current, { weak: "1" })).toBe("/?category=tooling&new=1&weak=1");
  });

  it("always drops the before cursor, even if present in current", () => {
    const current: FilterState = { category: "tooling", before: "2026-07-01T00:00:00.000Z" };
    expect(buildFilterHref(current, { new: "1" })).toBe("/?category=tooling&new=1");
  });

  it("is bookmarkable: every combination round-trips through the same params", () => {
    const current: FilterState = {};
    const href = buildFilterHref(current, { category: "research", new: "1", weak: "1" });
    expect(href).toBe("/?category=research&new=1&weak=1");
  });

  it("sets caveat=0 to hide reels with a caveat (T10.4)", () => {
    expect(buildFilterHref({}, { caveat: "0" })).toBe("/?caveat=0");
  });

  it("toggling caveat back off (undefined override) removes it, back to default (shown)", () => {
    expect(buildFilterHref({ caveat: "0" }, { caveat: undefined })).toBe("/");
  });
});

describe("buildLoadMoreHref", () => {
  it("sets before and keeps active filters", () => {
    const current: FilterState = { category: "tooling", weak: "1" };
    expect(buildLoadMoreHref(current, "2026-07-01T00:00:00.000Z")).toBe(
      "/?category=tooling&weak=1&before=2026-07-01T00%3A00%3A00.000Z",
    );
  });

  it("works with no other filters set", () => {
    expect(buildLoadMoreHref({}, "2026-07-01T00:00:00.000Z")).toBe(
      "/?before=2026-07-01T00%3A00%3A00.000Z",
    );
  });
});

describe("FilterBar", () => {
  it("renders a chip per category plus new/weak toggles, marking active ones", () => {
    const html = renderToStaticMarkup(<FilterBar current={{ category: "tooling", new: "1" }} />);

    expect(html).toContain("Tooling");
    expect(html).toContain("Technique");
    expect(html).toContain("🆕 New");
    expect(html).toContain("Weak signal show");
    expect(html).toContain('href="/?new=1"'); // toggling active category off keeps other filters
    expect(html).toContain('href="/?category=tooling&amp;new=1&amp;weak=1"'); // enabling weak keeps category+new
  });

  it("every rendered chip href is a bookmarkable, self-consistent feed URL", () => {
    const html = renderToStaticMarkup(<FilterBar current={{ weak: "1" }} />);
    expect(html).toContain("Weak signal hide");
    expect(html).toMatch(/href="\/\?/);
  });

  it("shows 'Caveats hide' by default and 'Caveats show' when caveat=0 (T10.4)", () => {
    const defaultHtml = renderToStaticMarkup(<FilterBar current={{}} />);
    expect(defaultHtml).toContain("⚠️ Caveats hide");

    const hiddenHtml = renderToStaticMarkup(<FilterBar current={{ caveat: "0" }} />);
    expect(hiddenHtml).toContain("⚠️ Caveats show");
    expect(hiddenHtml).toContain('href="/"'); // clicking removes the param, back to default (shown)
  });
});
