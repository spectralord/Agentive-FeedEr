import type { SavedReel } from "@/lib/interactions";
import { CATEGORY_LABELS } from "./labels";

function daysAgo(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

/**
 * "🔁 Keep at it" (T6.5): a full-height card below the Top-N on /today
 * listing up to RESURFACE_LIMIT saved reels whose save is 7-21 days old
 * (see src/lib/interactions.ts getResurfacingCandidates). Deliberately no
 * "done" checkbox — items age out of the window naturally at 21 days, or
 * the user retracts the save via /saved (see docs/plan/epic-6-interactions.md
 * "Revidiert 2026-07-23").
 *
 * T18.3 (§4): restyled onto the token system; each entry now gets the same
 * compact meta row treatment as a Reel (source + category badge) instead of
 * plain text, so it reads as "a Reel you already cared about," not a generic
 * list item. Still no checkbox — that absence is deliberate, not a gap.
 */
export function ResurfaceCard({ reels, now }: { reels: SavedReel[]; now: Date }) {
  if (reels.length === 0) return null;

  return (
    <div className="reel flex min-h-dvh snap-start items-center justify-center [scroll-snap-stop:always]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6">
        <h2 className="text-center text-lg font-semibold text-ink">🔁 Keep at it</h2>
        <ol className="flex flex-col gap-3">
          {reels.map((reel) => (
            <li key={reel.id} className="rounded-lg border border-hairline bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-muted">{reel.sourceName}</span>
                <span className="rounded-full border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                  {CATEGORY_LABELS[reel.category]}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-ink-faint">
                Saved {daysAgo(reel.savedAt, now)} days ago — take another look?
              </p>
              <a
                href={reel.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-sm font-medium text-ink hover:underline"
              >
                {reel.title}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
