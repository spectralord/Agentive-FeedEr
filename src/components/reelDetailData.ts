import type { FeedReel } from "@/lib/feed";
import { formatRelativeTime } from "@/lib/relativeTime";
import { pickSkillTabPreview, type SkillTabInfo } from "@/lib/skills/reelSkillTab";

/**
 * T18.6 (§2.2): builds the plain-data package the Reel Detail overlay
 * (`ReelDetail.tsx`, rendered inside the client `ReelCardShell`) needs — kept
 * as a standalone function (not a component) so it can run in the server
 * components that already hold a `FeedReel` (`ReelCard`/`ReelStackCard`)
 * without pulling either of them into the client bundle. Every field here is
 * a plain string/number/boolean/null so the result crosses the server/client
 * boundary as an ordinary serializable prop — Dates are pre-formatted with
 * `formatRelativeTime` here rather than passed through as `Date` objects.
 *
 * T18.7 adds the Skill tab's data (the `skill` field below) on top of
 * T18.6's Write-up + Context wiring.
 */

export interface ContextMemberView {
  id: number;
  sourceName: string;
  title: string;
  url: string;
  timeLabel: string;
}

export interface SkillTabPreviewItemView {
  key: string;
  title: string;
  timeLabel: string;
}

export interface SkillTabView {
  slug: string;
  title: string;
  theme: string;
  status: SkillTabInfo["status"];
  description: string;
  /** Sourced-only (ADR 0005): both null when the reel itself has no
   *  `action`/`effortTag` — never invented. This Reel's own fields, not the
   *  skill node's — the Skill tab is where §2.1 relocated them (T18.2). */
  action: string | null;
  effortTag: "5-min-test" | "afternoon" | "know-only" | null;
  /** Up to 2 other items tagged with this skill (T18.7), this reel's own
   *  row already excluded — see `pickSkillTabPreview`. */
  otherItems: SkillTabPreviewItemView[];
  moreCount: number;
}

export interface ReelDetailData {
  title: string;
  sourceName: string;
  /** ADR 0017 (T18.6): null everywhere until the write-up enrichment pass
   *  ships. The Write-up tab shows an explicit placeholder when this is
   *  null — never hidden either way. */
  writeup: string | null;
  example: string | null;
  /** Full caveat text (Compact keeps only the minimal marker, T18.2 judgment
   *  call 1) — rendered in the Context tab. */
  caveat: string | null;
  /** Epic 15 cluster members beyond the primary reel — empty for a solo
   *  reel (the common case) or the primary of a cluster reduced to one
   *  visible member. Sourced directly from the same `getReels()` batch that
   *  built the feed (see `ReelStackCard`'s `others` prop) — no second query. */
  clusterMembers: ContextMemberView[];
  /** T18.7: undefined when the reel has no `skill` (or, defensively, the
   *  matched skill node can no longer be resolved) — the Skill tab hides in
   *  either case, same as any other "would render only its empty state"
   *  tab. */
  skill?: SkillTabView;
}

/** Builds the Detail data package for one reel. `clusterMembers` is the
 *  Epic 15 "other members of this reel's topic cluster" list — pass `[]`
 *  for a solo `ReelCard` (there is nothing beyond the primary by
 *  definition), or `ReelStackCard`'s `others` for the cluster's primary.
 *  `skillTabInfo` is this reel's `reel.skill` slug looked up in the batch
 *  map `getSkillTabInfoForSlugs` returns (T18.7) — omit/pass `undefined`
 *  when the reel has no skill, or the slug wasn't found in that map. */
export function buildReelDetailData(
  reel: FeedReel,
  clusterMembers: FeedReel[],
  skillTabInfo?: SkillTabInfo,
): ReelDetailData {
  const skill: SkillTabView | undefined =
    reel.skill && skillTabInfo
      ? (() => {
          const { otherItems, moreCount } = pickSkillTabPreview(skillTabInfo, reel.id);
          return {
            slug: skillTabInfo.slug,
            title: skillTabInfo.title,
            theme: skillTabInfo.theme,
            status: skillTabInfo.status,
            description: skillTabInfo.description,
            action: reel.action,
            effortTag: reel.effortTag,
            otherItems: otherItems.map((it) => ({
              key: `${it.type}-${it.id}`,
              title: it.title,
              timeLabel: formatRelativeTime(it.date),
            })),
            moreCount,
          };
        })()
      : undefined;

  return {
    title: reel.title,
    sourceName: reel.sourceName,
    writeup: reel.writeup,
    example: reel.example,
    caveat: reel.caveat,
    clusterMembers: clusterMembers.map((m) => ({
      id: m.id,
      sourceName: m.sourceName,
      title: m.title,
      url: m.url,
      timeLabel: formatRelativeTime(m.publishedAt),
    })),
    skill,
  };
}
