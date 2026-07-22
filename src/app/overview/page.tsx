import { getReels } from "@/lib/feed";
import { isBestPractice, isSota } from "@/lib/labels";
import { HistoryList } from "@/components/HistoryList";
import { OverviewFilterBar, type OverviewFilterState } from "@/components/OverviewFilterBar";
import { groupSota, SotaSection } from "@/components/SotaSection";

// SOTA and Verlauf are both derived views recomputed per request from
// searchParams + current DB state (T5.2/T5.3, ADR 0004) — this page must
// never be frozen as a single static build-time snapshot (same reasoning as
// /today, see src/app/today/page.tsx).
export const dynamic = "force-dynamic";

export type OverviewSearchParams = OverviewFilterState;

/**
 * Fetch ceiling for both sections. Generous for MVP data volumes; Verlauf has
 * no infinite-scroll pagination yet (documented as a simplification in
 * docs/plan/epic-5-overview.md — Abweichungen).
 */
const FETCH_LIMIT = 1000;

interface OverviewPageProps {
  searchParams: Promise<OverviewSearchParams>;
}

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const params = await searchParams;

  // SOTA (T5.2): age-independent by construction — no publishedAfter/onlyNew
  // filter applied here. showWeak:true because isSota's own quality>=70 floor
  // already supersedes (and is stricter than) the feed's default
  // QUALITY_THRESHOLD, so nothing that could qualify is excluded upstream.
  const sotaCandidates = await getReels({ showWeak: true, limit: FETCH_LIMIT });
  const sotaGroups = groupSota(sotaCandidates.filter(isSota));

  // Verlauf (T5.3): explicit filters only, no hidden quality floor — this
  // view is deliberately "show everything, filter explicitly" rather than
  // inheriting the main feed's default weak-signal hiding.
  const periodDays = params.period ? Number(params.period) : undefined;
  const publishedAfter =
    periodDays !== undefined && Number.isFinite(periodDays)
      ? new Date(Date.now() - periodDays * 86_400_000)
      : undefined;
  const minRelevance = params.minRelevance ? Number(params.minRelevance) : undefined;

  let historyReels = await getReels({
    showWeak: true,
    category: params.category,
    maturity: params.maturity,
    minRelevance,
    publishedAfter,
    excludeExperimental: params.experimental === "0",
    limit: FETCH_LIMIT,
  });

  if (params.bestPractice === "1") {
    historyReels = historyReels.filter(isBestPractice);
  }

  return (
    <div className="pb-16">
      <SotaSection groups={sotaGroups} />

      <div className="mx-auto mt-8 max-w-xl border-t border-zinc-800/60 px-4 pt-4">
        <h2 className="text-sm font-semibold text-zinc-100">🕓 Verlauf</h2>
      </div>
      <OverviewFilterBar current={params} />
      <HistoryList reels={historyReels} />
    </div>
  );
}
