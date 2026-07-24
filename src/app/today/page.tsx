import Link from "next/link";
import { ReelCard } from "@/components/ReelCard";
import { ResurfaceCard } from "@/components/ResurfaceCard";
import { getInteractionFlags, getResurfacingCandidates } from "@/lib/interactions";
import { getTodayTopReels } from "@/lib/today";

// The 24h/48h ingestion window and the ranking both depend on "now" — this
// page must be computed per request, never statically prerendered at build
// time (unlike the stub before, Next.js would otherwise cache a single
// build-time snapshot indefinitely since the page has no dynamic API usage).
export const dynamic = "force-dynamic";

function formatToday(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
}

function EmptyState() {
  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-lg font-medium">Nothing important today</p>
      <p className="text-sm text-zinc-400">— enjoy the quiet.</p>
    </div>
  );
}

export default async function TodayPage() {
  const now = new Date();
  const { reels, usedFallback } = await getTodayTopReels(now);

  if (reels.length === 0) {
    return <EmptyState />;
  }

  const interactionFlags = await getInteractionFlags(reels.map((r) => r.id));
  const resurfacing = await getResurfacingCandidates(now);

  return (
    <>
      <nav
        aria-label="Important today"
        className="fixed inset-x-0 top-12 z-10 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur"
      >
        <div className="mx-auto flex max-w-xl flex-col gap-0.5 px-4 py-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-zinc-100">Important today ({reels.length})</span>
            <span className="text-xs text-zinc-400">{formatToday(now)}</span>
          </div>
          {usedFallback && <p className="text-xs text-amber-300">incl. yesterday</p>}
        </div>
      </nav>

      <div className="feed -mt-12 h-dvh snap-y snap-mandatory overflow-y-auto overflow-x-hidden">
        {reels.map((reel) => (
          <ReelCard key={reel.id} reel={reel} interactions={interactionFlags.get(reel.id)} />
        ))}

        <ResurfaceCard reels={resurfacing} now={now} />

        <div className="reel flex min-h-dvh snap-start items-center justify-center [scroll-snap-stop:always]">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 text-center">
            <p className="text-lg font-medium text-zinc-50">That&apos;s it for today ✅</p>
            <Link
              href="/"
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              To the full feed
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
