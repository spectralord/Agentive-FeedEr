import { describe, expect, it } from "vitest";
import { activeTabId } from "./TabBar";

/**
 * T18.10: `activeTabId` is exported as a plain function (not read via
 * `usePathname()` internally by the test) specifically so it's testable
 * without an app-router context — rendering `TabBar`/`AppBarTitle` via
 * `renderToStaticMarkup` would throw the same "invariant expected app
 * router to be mounted" error T18.5's notes describe for `useRouter`,
 * since `usePathname` has the same app-router-context requirement.
 */
describe("activeTabId", () => {
  it("Feed is active only at the exact root", () => {
    expect(activeTabId("/")).toBe("feed");
  });

  it("Today is active for /today and its sub-paths", () => {
    expect(activeTabId("/today")).toBe("today");
  });

  it("Skills is active for /skills and nested slugs", () => {
    expect(activeTabId("/skills")).toBe("skills");
    expect(activeTabId("/skills/some-slug")).toBe("skills");
  });

  it("Library is active for all three of its hub members", () => {
    expect(activeTabId("/saved")).toBe("library");
    expect(activeTabId("/overview")).toBe("library");
    expect(activeTabId("/experience")).toBe("library");
    expect(activeTabId("/experience/42/edit")).toBe("library");
  });

  it("returns null for pages that are not a tab-bar destination", () => {
    expect(activeTabId("/admin")).toBeNull();
    expect(activeTabId("/clusters/7")).toBeNull();
  });
});
