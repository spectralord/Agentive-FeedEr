import type { SavedReel } from "@/lib/interactions";
import { formatRelativeTime } from "@/lib/relativeTime";
import { EmptyState } from "./EmptyState";
import { CATEGORY_LABELS, MATURITY_LABELS } from "./labels";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{children}</span>
  );
}

/**
 * `/saved` (T6.3): compact rows like Overview-Verlauf (HistoryList), newest
 * save first, each with an "Entfernen" action that retracts the save. No
 * "tried/erledigt" checkbox — see the revised scope note in
 * docs/plan/epic-6-interactions.md.
 */
export function SavedList({ reels }: { reels: SavedReel[] }) {
  // T18.12 (§10.7): routed through the shared EmptyState component — same
  // copy as before, already a good model ("say what is true, and where
  // useful say what would change it").
  if (reels.length === 0) {
    return (
      <EmptyState variant="inline" title="Nothing saved yet" message="Tap 🔖 on a Reel to save it for later." />
    );
  }

  return (
    <ol className="mx-auto flex max-w-xl flex-col divide-y divide-zinc-800/60 px-4 pb-16">
      {reels.map((reel) => (
        <li key={reel.id} className="flex flex-col gap-1.5 py-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Saved {formatRelativeTime(reel.savedAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{reel.sourceName}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{CATEGORY_LABELS[reel.category]}</Badge>
            <Badge>{MATURITY_LABELS[reel.maturity]}</Badge>
            {reel.experimental && <Badge>🧪 experimental</Badge>}
          </div>

          <a
            href={reel.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-zinc-100 hover:underline"
          >
            {reel.title}
          </a>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              R {reel.relevanceScore} · Q {reel.qualityScore}
            </p>
            <form action={`/saved/${reel.id}/remove`} method="POST">
              <button
                type="submit"
                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Remove
              </button>
            </form>
          </div>
        </li>
      ))}
    </ol>
  );
}
