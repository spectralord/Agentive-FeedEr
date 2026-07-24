import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ExperienceReport } from "@/db/schema";
import { ExperienceList } from "./ExperienceList";

const baseReport: ExperienceReport = {
  id: 1,
  title: "Ein Erfahrungsbericht",
  body: "Normaler Text.",
  authorType: "own",
  authorLabel: "Ich",
  important: false,
  relevanceScore: null,
  skill: null,
  lifecycleState: "active",
  lifecycleReason: null,
  supersededByReportId: null,
  sourceUrl: null,
  createdAt: new Date("2026-07-20T00:00:00Z"),
  updatedAt: new Date("2026-07-20T00:00:00Z"),
};

describe("ExperienceList", () => {
  it("renders title, author label, author_type badge and body", () => {
    const html = renderToStaticMarkup(<ExperienceList reports={[baseReport]} />);
    expect(html).toContain("Ein Erfahrungsbericht");
    expect(html).toContain("Ich");
    expect(html).toContain("Own");
    expect(html).toContain("Normaler Text.");
  });

  it("shows the ⭐ important marker only when set", () => {
    const withStar = renderToStaticMarkup(
      <ExperienceList reports={[{ ...baseReport, important: true }]} />,
    );
    expect(withStar).toContain("⭐ important");

    const without = renderToStaticMarkup(<ExperienceList reports={[baseReport]} />);
    expect(without).not.toContain("⭐ important");
  });

  it("shows a deprecated badge with reason and superseded-by link", () => {
    const html = renderToStaticMarkup(
      <ExperienceList
        reports={[
          {
            ...baseReport,
            lifecycleState: "deprecated",
            lifecycleReason: "durch neueren Bericht ersetzt",
            supersededByReportId: 42,
          },
        ]}
      />,
    );
    expect(html).toContain("⚠️ deprecated");
    expect(html).toContain("durch neueren Bericht ersetzt");
    expect(html).toContain("/experience/42/edit");
    expect(html).toContain("superseded by #42");
  });

  it("shows an archived badge", () => {
    const html = renderToStaticMarkup(
      <ExperienceList reports={[{ ...baseReport, lifecycleState: "archived" }]} />,
    );
    expect(html).toContain("🗄️ archived");
  });

  it("shows deprecate/archive actions for an active report (T9.6)", () => {
    const html = renderToStaticMarkup(<ExperienceList reports={[baseReport]} />);
    expect(html).toContain("Mark as deprecated");
    expect(html).toContain("Archive");
    expect(html).not.toContain("Reactivate");
    expect(html).toContain(`action="/experience/${baseReport.id}/lifecycle"`);
  });

  it("shows reactivate/archive actions for a deprecated report", () => {
    const html = renderToStaticMarkup(
      <ExperienceList reports={[{ ...baseReport, lifecycleState: "deprecated" }]} />,
    );
    expect(html).toContain("Reactivate");
    expect(html).toContain("Archive");
    expect(html).not.toContain("Mark as deprecated");
  });

  it("shows only reactivate for an archived report", () => {
    const html = renderToStaticMarkup(
      <ExperienceList reports={[{ ...baseReport, lifecycleState: "archived" }]} />,
    );
    expect(html).toContain("Reactivate");
    expect(html).not.toContain("Archive");
    expect(html).not.toContain("Mark as deprecated");
  });

  it("renders an empty-state message for no reports", () => {
    const html = renderToStaticMarkup(<ExperienceList reports={[]} />);
    expect(html).toContain("No reports for this filter combination.");
  });

  it("XSS sanity: a <script> tag in the body is rendered as escaped text, never executed (T9.7)", () => {
    const html = renderToStaticMarkup(
      <ExperienceList
        reports={[{ ...baseReport, body: '<script>window.__pwned = true;</script>' }]}
      />,
    );
    // React escapes text content — the literal tag must never appear unescaped.
    expect(html).not.toContain("<script>window.__pwned = true;</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
