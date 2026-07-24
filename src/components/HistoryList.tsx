import type { FeedReel } from "@/lib/feed";
import { isBestPractice, isNew, isSota } from "@/lib/labels";
import { formatRelativeTime } from "@/lib/relativeTime";
import { CATEGORY_LABELS, MATURITY_LABELS } from "./labels";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{children}</span>
  );
}

/**
 * History (T5.3): a plain chronological scroll list (no scroll-snap, unlike
 * the Reel feed) of compact rows. Derived badges reuse the exact same
 * src/lib/labels.ts functions as ReelCard/SOTA — no duplicated logic.
 */
export function HistoryList({ reels }: { reels: FeedReel[] }) {
  if (reels.length === 0) {
    return (
      <p className="mx-auto max-w-xl px-4 py-10 text-center text-sm text-zinc-400">
        No Reels for this filter combination.
      </p>
    );
  }

  return (
    <ol className="mx-auto flex max-w-xl flex-col divide-y divide-zinc-800/60 px-4 pb-16">
      {reels.map((reel) => (
        <li key={reel.id} className="flex flex-col gap-1.5 py-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <time dateTime={reel.publishedAt.toISOString()}>
              {formatRelativeTime(reel.publishedAt)}
            </time>
            <span aria-hidden="true">·</span>
            <span>{reel.sourceName}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{CATEGORY_LABELS[reel.category]}</Badge>
            <Badge>{MATURITY_LABELS[reel.maturity]}</Badge>
            {reel.experimental && <Badge>🧪 experimental</Badge>}
            {isNew(reel) && <Badge>🆕 New</Badge>}
            {isSota(reel) && <Badge>⭐ SOTA</Badge>}
            {isBestPractice(reel) && <Badge>🛠️ Best Practice</Badge>}
          </div>

          <a
            href={reel.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-zinc-100 hover:underline"
          >
            {reel.title}
          </a>

          <p className="text-xs text-zinc-500">
            R {reel.relevanceScore} · Q {reel.qualityScore}
          </p>
        </li>
      ))}
    </ol>
  );
}
