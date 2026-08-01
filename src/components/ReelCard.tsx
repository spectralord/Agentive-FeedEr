import type { FeedReel } from "@/lib/feed";
import type { ReelActionFlags } from "@/lib/interactions";
import type { SkillTabInfo } from "@/lib/skills/reelSkillTab";
import { buildReelDetailData } from "./reelDetailData";
import { ReelCardBody } from "./ReelCardBody";
import { ReelCardShell } from "./ReelCardShell";

// Re-exported so existing call sites/tests importing `ReelCardBody` from
// "./ReelCard" keep working — the implementation itself now lives in
// ReelCardBody.tsx (T18.7), split out so `ReelStackCard.tsx` (a Client
// Component) can use it without also pulling in `buildReelDetailData`'s
// DB-touching import chain. See ReelCardBody.tsx's doc comment.
export { ReelCardBody };

const NO_INTERACTIONS: ReelActionFlags = { save: false, up: false, down: false };

export interface ReelCardProps {
  reel: FeedReel;
  /** Current save/up/down state, to hydrate the action bar (T6.2). Defaults
   *  to "none active" when omitted. */
  interactions?: ReelActionFlags;
  /** T18.7: this reel's `skill` slug looked up in the page-level batch map
   *  from `getSkillTabInfoForSlugs` — undefined when the reel has no skill,
   *  which also means the Skill tab hides. */
  skillTabInfo?: SkillTabInfo;
  /** env().NEW_DAYS, resolved by the page (a Server Component) and passed
   *  down to `ReelCardBody`, which must not read `env()` itself. */
  newDays: number;
  /** T19.4 (ADR 0024 decision 3): `writeupGenerationAvailable()`, resolved
   *  by the page. Same server/client boundary rule as `newDays` above. */
  canGenerateWriteup?: boolean;
}

/** One reel card, sized to fill the viewport (see .reel/.feed scroll-snap in page.tsx). */
export function ReelCard({ reel, interactions, skillTabInfo, newDays, canGenerateWriteup }: ReelCardProps) {
  // T18.6: a solo card has nothing beyond the primary by definition (no
  // cluster, or a cluster reduced to one visible member) — the Context
  // tab's cluster-members list is always empty here.
  const detail = buildReelDetailData(reel, [], skillTabInfo, canGenerateWriteup);
  return (
    <ReelCardShell reelId={reel.id} initial={interactions ?? NO_INTERACTIONS} detail={detail}>
      <ReelCardBody reel={reel} newDays={newDays} />
    </ReelCardShell>
  );
}
