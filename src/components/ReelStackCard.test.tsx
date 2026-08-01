import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FeedReel } from "@/lib/feed";
import { buildReelDetailData } from "./reelDetailData";
import { ReelStackCard } from "./ReelStackCard";

const baseReel: FeedReel = {
  id: 1,
  rawItemId: 1,
  title: "Primary title",
  url: "https://example.com/primary",
  publishedAt: new Date(Date.now() - 2 * 86_400_000),
  sourceName: "primary-source",
  summary: "Primary summary.",
  category: "tooling",
  maturity: "established",
  experimental: false,
  relevanceScore: 80,
  qualityScore: 70,
  example: null,
  action: null,
  effortTag: null,
  skill: null,
  topicClusterId: 42,
  isPrimary: true,
  clusterTitle: "Some Topic",
  confidence: "some",
  independentCount: 2,
  lifecycleState: "active",
  supersededByClusterId: null,
  supersedeReason: null,
  caveat: null,
  writeup: null,
};

const otherReel: FeedReel = {
  ...baseReel,
  id: 2,
  title: "Other member title",
  url: "https://example.com/other",
  sourceName: "other-source",
  isPrimary: false,
};

describe("ReelStackCard (T18.6: Context tab = cluster members beyond the primary)", () => {
  it("marks the 'show sources' banner data-no-open so it doesn't also open Detail", () => {
    const detail = buildReelDetailData(baseReel, [otherReel]);
    const html = renderToStaticMarkup(
      <ReelStackCard newDays={7} clusterTitle="Some Topic" primary={baseReel} others={[otherReel]} detail={detail} />,
    );
    expect(html).toContain("data-no-open");
    expect(html).toContain("Show sources");
  });

  it("Context tab lists the other cluster member(s), and the tab is shown (not hidden)", () => {
    const detail = buildReelDetailData(baseReel, [otherReel]);
    const html = renderToStaticMarkup(
      <ReelStackCard newDays={7} clusterTitle="Some Topic" primary={baseReel} others={[otherReel]} detail={detail} />,
    );
    expect(html).toContain("Context");
    expect(html).toContain("other-source");
    expect(html).toContain("Other member title");
    expect(html).not.toContain("Single-sourced.");
  });
});
