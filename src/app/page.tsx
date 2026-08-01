import Link from "next/link";
import { env } from "@/lib/env";
import { DEFAULT_FEED_LIMIT, getReels, groupReelsForFeed } from "@/lib/feed";
import { getInteractionFlags } from "@/lib/interactions";
import { getSkillTabInfoForSlugs } from "@/lib/skills/reelSkillTab";
import { EmptyState } from "@/components/EmptyState";
import { ReelCard } from "@/components/ReelCard";
import { ReelStackCard } from "@/components/ReelStackCard";
import { buildReelDetailData } from "@/components/reelDetailData";
import { buildLoadMoreHref, FilterBar, type FilterState } from "@/components/FilterBar";

export type FeedSearchParams = FilterState;

interface FeedPageProps {
  searchParams: Promise<FeedSearchParams>;
}

/**
 * T18.12 (§10.7): routed through the shared `EmptyState` component. The
 * previous no-filters copy told the reader to run `npm run job:daily` — a
 * CLI instruction in a user-facing surface. Dropped; replaced with copy that
 * is true and meaningful to someone who has never seen this repo.
 */
function FeedEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return hasFilters ? (
    <EmptyState
      title="No Reels for this filter"
      message="Nothing matches this combination of filters."
      action={{ href: "/", label: "Reset filters" }}
    />
  ) : (
    <EmptyState
      title="The feed is empty"
      message="Nothing has come in yet — new Reels appear automatically as sources are processed. Check back soon."
    />
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
  // Resolved here (Server Component) and passed down: `ReelStackCard` is a
  // Client Component, so nothing beneath it may call `env()` in the browser.
  const newDays = env().NEW_DAYS;

  return (
    <>
      <FilterBar current={params} />
      {reels.length === 0 ? (
        <FeedEmptyState hasFilters={hasFilters} />
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
                newDays={newDays}
              />
            ) : (
              <ReelCard
                key={item.reel.id}
                reel={item.reel}
                interactions={interactionFlags.get(item.reel.id)}
                skillTabInfo={item.reel.skill ? skillTabMap.get(item.reel.skill) : undefined}
                newDays={newDays}
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
