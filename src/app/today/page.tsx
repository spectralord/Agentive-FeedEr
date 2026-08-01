import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { ReelCard } from "@/components/ReelCard";
import { ResurfaceCard } from "@/components/ResurfaceCard";
import { env } from "@/lib/env";
import { getInteractionFlags, getResurfacingCandidates } from "@/lib/interactions";
import { getSkillTabInfoForSlugs } from "@/lib/skills/reelSkillTab";
import { getTodayTopReels } from "@/lib/today";
import { writeupGenerationAvailable } from "@/lib/writeup/run";

// The 24h/48h ingestion window and the ranking both depend on "now" — this
// page must be computed per request, never statically prerendered at build
// time (unlike the stub before, Next.js would otherwise cache a single
// build-time snapshot indefinitely since the page has no dynamic API usage).
export const dynamic = "force-dynamic";

function formatToday(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
}

export default async function TodayPage() {
  const now = new Date();
  const { reels, usedFallback } = await getTodayTopReels(now);

  // T18.12 (§10.7): routed through the shared EmptyState component — this
  // copy was already good ("say what is true"), kept verbatim.
  if (reels.length === 0) {
    return <EmptyState title="Nothing important today" message="— enjoy the quiet." />;
  }

  const interactionFlags = await getInteractionFlags(reels.map((r) => r.id));
  const resurfacing = await getResurfacingCandidates(now);
  // T18.7: same batch skill-tab lookup as the main feed (src/app/page.tsx).
  const skillTabMap = await getSkillTabInfoForSlugs(
    reels.map((r) => r.skill).filter((s): s is string => s !== null),
  );
  // T19.4 (ADR 0024 decision 3): same resolve-once-per-page rule as
  // src/app/page.tsx.
  const canGenerateWriteup = writeupGenerationAvailable();

  return (
    <>
      <nav
        aria-label="Important today"
        className="fixed inset-x-0 top-[var(--header-h)] z-10 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur"
      >
        <div className="mx-auto flex max-w-xl flex-col gap-0.5 px-4 py-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-zinc-100">Important today ({reels.length})</span>
            <span className="text-xs text-zinc-400">{formatToday(now)}</span>
          </div>
          {/* ADR 0016 pt 1: this is a neutral scope note, not a warning. It used
              to render in amber — the exact "non-warning text wearing the caution
              colour" bug the reserved-colour rule was written to prevent, and
              visually the loudest element on the page. --ink-muted, not caution. */}
          {usedFallback && <p className="text-xs text-ink-muted">incl. yesterday</p>}
        </div>
      </nav>

      <div className="feed -mt-[var(--header-h)] h-[calc(100dvh-var(--tabbar-h))] snap-y snap-mandatory overflow-y-auto overflow-x-hidden">
        {reels.map((reel) => (
          <ReelCard
            key={reel.id}
            reel={reel}
            interactions={interactionFlags.get(reel.id)}
            skillTabInfo={reel.skill ? skillTabMap.get(reel.skill) : undefined}
            newDays={env().NEW_DAYS}
            canGenerateWriteup={canGenerateWriteup}
          />
        ))}

        <ResurfaceCard reels={resurfacing} now={now} />

        <div className="reel flex min-h-[calc(100dvh-var(--tabbar-h))] snap-start items-center justify-center [scroll-snap-stop:always]">
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
