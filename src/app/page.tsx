import Link from "next/link";
import { DEFAULT_FEED_LIMIT, getReels, groupReelsForFeed } from "@/lib/feed";
import { getInteractionFlags } from "@/lib/interactions";
import { getSkillTabInfoForSlugs } from "@/lib/skills/reelSkillTab";
import { ReelCard } from "@/components/ReelCard";
import { ReelStackCard } from "@/components/ReelStackCard";
import { buildReelDetailData } from "@/components/reelDetailData";
import { buildLoadMoreHref, FilterBar, type FilterState } from "@/components/FilterBar";

export type FeedSearchParams = FilterState;

interface FeedPageProps {
  searchParams: Promise<FeedSearchParams>;
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--tabbar-h))] max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-lg font-medium">No Reels yet</p>
      {hasFilters ? (
        <p className="text-sm text-zinc-400">
          No Reels for this filter combination.{" "}
          <a href="/" className="underline decoration-zinc-700 hover:text-zinc-300">
            Reset filters
          </a>
          .
        </p>
      ) : (
        <p className="text-sm text-zinc-400">
          The pipeline runs from Epic 1/2 — collect sources with{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">
            npm run job:daily
          </code>
        </p>
      )}
    </div>
  );
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const hasFilters = Boolean(params.category || params.new || params.weak || params.caveat);

  const reels = await getReels({
    category: params.category,
    onlyNew: params.new === "1",
    showWeak: params.weak === "1",
    hideCaveats: params.caveat === "0",
    before: params.before ? new Date(params.before) : undefined,
  });
  const interactionFlags = await getInteractionFlags(reels.map((r) => r.id));
  // T18.7: one batch lookup for every distinct skill slug present in this
  // page's reels, instead of a per-card query — same batching pattern as
  // getInteractionFlags above.
  const skillTabMap = await getSkillTabInfoForSlugs(
    reels.map((r) => r.skill).filter((s): s is string => s !== null),
  );
  // Epic 15 (T15.4): topic clusters with >= 2 displayed members bundle into
  // one stack card; everything else renders as a plain solo card, unchanged.
  const feedItems = groupReelsForFeed(reels);

  return (
    <>
      <FilterBar current={params} />
      {reels.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <div className="feed -mt-[var(--header-h)] h-[calc(100dvh-var(--tabbar-h))] snap-y snap-mandatory overflow-y-auto overflow-x-hidden">
          {feedItems.map((item) =>
            item.type === "stack" ? (
              <ReelStackCard
                key={`cluster-${item.clusterId}`}
                clusterTitle={item.clusterTitle}
                primary={item.primary}
                others={item.others}
                interactions={interactionFlags.get(item.primary.id)}
                detail={buildReelDetailData(
                  item.primary,
                  item.others,
                  item.primary.skill ? skillTabMap.get(item.primary.skill) : undefined,
                )}
              />
            ) : (
              <ReelCard
                key={item.reel.id}
                reel={item.reel}
                interactions={interactionFlags.get(item.reel.id)}
                skillTabInfo={item.reel.skill ? skillTabMap.get(item.reel.skill) : undefined}
              />
            ),
          )}
          {reels.length === DEFAULT_FEED_LIMIT && (
            <div className="flex min-h-24 items-center justify-center px-6 py-10">
              <Link
                href={buildLoadMoreHref(params, reels[reels.length - 1].publishedAt.toISOString())}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Load older
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
