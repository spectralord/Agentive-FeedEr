import type { SavedReel } from "@/lib/interactions";

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
 */
export function ResurfaceCard({ reels, now }: { reels: SavedReel[]; now: Date }) {
  if (reels.length === 0) return null;

  return (
    <div className="reel flex min-h-dvh snap-start items-center justify-center [scroll-snap-stop:always]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6">
        <h2 className="text-center text-lg font-semibold text-zinc-50">🔁 Keep at it</h2>
        <ol className="flex flex-col gap-3">
          {reels.map((reel) => (
            <li key={reel.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-xs text-zinc-400">
                Saved {daysAgo(reel.savedAt, now)} days ago — take another look?
              </p>
              <a
                href={reel.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-sm font-medium text-zinc-100 hover:underline"
              >
                {reel.title}
              </a>
              <p className="mt-1 text-xs text-zinc-500">{reel.sourceName}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
