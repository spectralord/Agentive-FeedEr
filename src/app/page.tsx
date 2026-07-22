import { getReels } from "@/lib/feed";
import { ReelCard } from "@/components/ReelCard";

export interface FeedSearchParams {
  category?: string;
  new?: string;
  weak?: string;
  before?: string;
}

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

  if (reels.length === 0) {
    return <EmptyState hasFilters={hasFilters} />;
  }

  return (
    <div className="feed -mt-12 h-dvh snap-y snap-mandatory overflow-y-auto overflow-x-hidden">
      {reels.map((reel) => (
        <ReelCard key={reel.id} reel={reel} />
      ))}
    </div>
  );
}
