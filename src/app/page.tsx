import Link from "next/link";
import { DEFAULT_FEED_LIMIT, getReels } from "@/lib/feed";
import { getInteractionFlags } from "@/lib/interactions";
import { ReelCard } from "@/components/ReelCard";
import { buildLoadMoreHref, FilterBar, type FilterState } from "@/components/FilterBar";

export type FeedSearchParams = FilterState;

interface FeedPageProps {
  searchParams: Promise<FeedSearchParams>;
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-lg font-medium">Noch keine Reels</p>
      {hasFilters ? (
        <p className="text-sm text-zinc-400">
          Keine Reels für diese Filterkombination.{" "}
          <a href="/" className="underline decoration-zinc-700 hover:text-zinc-300">
            Filter zurücksetzen
          </a>
          .
        </p>
      ) : (
        <p className="text-sm text-zinc-400">
          Die Pipeline läuft ab Epic 1/2 — Quellen einsammeln mit{" "}
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
  const hasFilters = Boolean(params.category || params.new || params.weak);

  const reels = await getReels({
    category: params.category,
    onlyNew: params.new === "1",
    showWeak: params.weak === "1",
    before: params.before ? new Date(params.before) : undefined,
  });
  const interactionFlags = await getInteractionFlags(reels.map((r) => r.id));

  return (
    <>
      <FilterBar current={params} />
      {reels.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <div className="feed -mt-12 h-dvh snap-y snap-mandatory overflow-y-auto overflow-x-hidden">
          {reels.map((reel) => (
            <ReelCard key={reel.id} reel={reel} interactions={interactionFlags.get(reel.id)} />
          ))}
          {reels.length === DEFAULT_FEED_LIMIT && (
            <div className="flex min-h-24 items-center justify-center px-6 py-10">
              <Link
                href={buildLoadMoreHref(params, reels[reels.length - 1].publishedAt.toISOString())}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Ältere laden
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
