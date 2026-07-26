import type { FeedReel } from "@/lib/feed";
import { formatRelativeTime } from "@/lib/relativeTime";

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
 * T18.7 adds the Skill tab's data (a `skill` field) on top of this — see
 * that task's changes to this file. T18.6 only wires Write-up + Context.
 */

export interface ContextMemberView {
  id: number;
  sourceName: string;
  title: string;
  url: string;
  timeLabel: string;
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
}

/** Builds the Detail data package for one reel. `clusterMembers` is the
 *  Epic 15 "other members of this reel's topic cluster" list — pass `[]`
 *  for a solo `ReelCard` (there is nothing beyond the primary by
 *  definition), or `ReelStackCard`'s `others` for the cluster's primary. */
export function buildReelDetailData(reel: FeedReel, clusterMembers: FeedReel[]): ReelDetailData {
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
  };
}
