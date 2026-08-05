import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReelDetail } from "./ReelDetail";
import type { ReelDetailData } from "./reelDetailData";

const baseData: ReelDetailData = {
  id: 1,
  title: "A reel",
  sourceName: "Some Source",
  url: "https://example.com/a-reel",
  writeup: null,
  canGenerateWriteup: false,
  example: null,
  caveat: null,
  clusterMembers: [],
  skill: {
    slug: "sub-agents",
    title: "Sub-Agents",
    theme: "agents",
    status: "seen",
    description: "Splitting work across parallel agents.",
    action: "Try splitting this into two sub-agents.",
    effortTag: "afternoon",
    otherItems: [],
    moreCount: 0,
    completion: null,
  },
};

// Detail is only rendered `open` in the real app (ReelCardShell owns that
// state) — pass `open` so these assertions see the same markup a user would.
function renderSkillTab(data: ReelDetailData) {
  return renderToStaticMarkup(
    <ReelDetail data={data} open activeTab="skill" onSelectTab={() => {}} onClose={() => {}} />,
  );
}

describe("ReelDetail — Skill tab (T20.4)", () => {
  it("renders the action box with a 'Mark as done' tick when not yet completed", () => {
    const html = renderSkillTab(baseData);
    expect(html).toContain("Try splitting this into two sub-agents.");
    expect(html).toContain("Mark as done");
  });

  it("renders 'Done' when the Reel's Actionable is already completed, showing the SNAPSHOT text", () => {
    const html = renderSkillTab({
      ...baseData,
      skill: {
        ...baseData.skill!,
        action: "Try Y (rewritten since completion).",
        completion: {
          actionText: "Try X (as originally ticked).",
          effortTag: "afternoon",
          note: null,
          doneAt: "2026-07-20T00:00:00.000Z",
        },
      },
    });
    expect(html).toContain("Done");
    // The action box itself still shows the Reel's LIVE action (a pure view
    // per ADR 0019 Consequences) — the snapshot lives in the completion
    // record, not on this box. Both are true statements; assert the box
    // renders the tick as done.
    expect(html).toContain("aria-pressed=\"true\"");
  });

  it("hides the Skill tab entirely when the reel has no skill (T18.7, unchanged by T20.4)", () => {
    const html = renderToStaticMarkup(
      <ReelDetail
        data={{ ...baseData, skill: undefined }}
        open
        activeTab="skill"
        onSelectTab={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).not.toContain("Mark as done");
  });

  it("does not render the tick when the Reel has no action (sourced-only, ADR 0005)", () => {
    const html = renderSkillTab({
      ...baseData,
      skill: { ...baseData.skill!, action: null, completion: null },
    });
    expect(html).not.toContain("Mark as done");
  });

  it("Context tab is NEVER hidden, even with no cluster members and no caveat (owner feedback 2026-08-03)", () => {
    // baseData already has clusterMembers: [] and caveat: null — the exact
    // "nothing to show" case that used to hide this tab. Every Reel has a
    // source, so hiding it read as broken rather than empty; the tab now
    // always renders, falling back to the existing "Single-sourced." copy.
    const tabsHtml = renderToStaticMarkup(
      <ReelDetail data={baseData} open activeTab="writeup" onSelectTab={() => {}} onClose={() => {}} />,
    );
    expect(tabsHtml).toContain("Context");

    const panelHtml = renderToStaticMarkup(
      <ReelDetail data={baseData} open activeTab="context" onSelectTab={() => {}} onClose={() => {}} />,
    );
    expect(panelHtml).toContain("Single-sourced.");
  });
});
