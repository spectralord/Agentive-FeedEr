import { getReels, type FeedReel } from "@/lib/feed";
import { env } from "@/lib/env";
import { topScore } from "@/lib/ranking";

const HOUR_MS = 3_600_000;

/** Upper bound on candidates fetched per window before ranking (T4.2). */
const CANDIDATE_LIMIT = 1000;

export interface TodayTopResult {
  /** Top env().TOP_N reels by topScore among the candidate window. */
  reels: FeedReel[];
  /**
   * True when the 24h window had fewer than TOP_N candidates and the window
   * was widened to 48h (T4.2) — drives the "inkl. gestern" hint.
   */
  usedFallback: boolean;
}

/**
 * Today's Top-N (Epic 4): candidates are reels ingested within the last 24h
 * (low-quality reels already excluded by getReels' default QUALITY_THRESHOLD
 * floor); if fewer than TOP_N qualify, the window widens to 48h. Ranked by
 * `topScore` (src/lib/ranking.ts), highest first. Pure derived view over the
 * same reels data — no new table/column (ADR 0004).
 */
export async function getTodayTopReels(now: Date = new Date()): Promise<TodayTopResult> {
  const topN = env().TOP_N;

  const since24h = new Date(now.getTime() - 24 * HOUR_MS);
  let candidates = await getReels({ sinceIngested: since24h, limit: CANDIDATE_LIMIT });
  let usedFallback = false;

  if (candidates.length < topN) {
    const since48h = new Date(now.getTime() - 48 * HOUR_MS);
    candidates = await getReels({ sinceIngested: since48h, limit: CANDIDATE_LIMIT });
    usedFallback = true;
  }

  const ranked = [...candidates]
    .sort((a, b) => topScore(b, now) - topScore(a, now))
    .slice(0, topN);

  return { reels: ranked, usedFallback };
}
