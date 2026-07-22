import { getReels } from "@/lib/feed";
import { isSota } from "@/lib/labels";
import { groupSota, SotaSection } from "@/components/SotaSection";

// SOTA is a derived view recomputed per request from current DB state (T5.2,
// ADR 0004) — this page must never be frozen as a single static build-time
// snapshot (same reasoning as /today, see src/app/today/page.tsx).
export const dynamic = "force-dynamic";

/**
 * Fetch ceiling for the SOTA candidate set. Generous for MVP data volumes.
 */
const FETCH_LIMIT = 1000;

export default async function OverviewPage() {
  // SOTA (T5.2): age-independent by construction — no publishedAfter/onlyNew
  // filter applied here. showWeak:true because isSota's own quality>=70 floor
  // already supersedes (and is stricter than) the feed's default
  // QUALITY_THRESHOLD, so nothing that could qualify is excluded upstream.
  const sotaCandidates = await getReels({ showWeak: true, limit: FETCH_LIMIT });
  const sotaGroups = groupSota(sotaCandidates.filter(isSota));

  return (
    <div className="pb-16">
      <SotaSection groups={sotaGroups} />

      <div className="mx-auto mt-8 max-w-xl border-t border-zinc-800/60 px-4 pt-4">
        <h2 className="text-sm font-semibold text-zinc-100">🕓 Verlauf</h2>
        <p className="mt-2 text-sm text-zinc-400">Verlauf mit Filtern folgt in T5.3.</p>
      </div>
    </div>
  );
}
