/**
 * Today's Top-N ranking (Epic 4, T4.1). Pure function over facts already
 * stored on a reel — no new data, see ADR 0004 ("Labels aus Fakten ableiten").
 */

export interface RankableReel {
  relevanceScore: number;
  qualityScore: number;
  publishedAt: Date;
}

const RECENCY_HALF_LIFE_DAYS = 7;
const MS_PER_DAY = 86_400_000;

/**
 * score ∈ [0,1] = relevance × quality × recency.
 * Recency decays exponentially with a ~7-day half-life: `exp(-ageDays / 7)`.
 * See docs/plan/epic-4-top-n.md for the exact expected values.
 */
export function topScore(r: RankableReel, now: Date = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - r.publishedAt.getTime()) / MS_PER_DAY);
  const recency = Math.exp(-ageDays / RECENCY_HALF_LIFE_DAYS);
  return (r.relevanceScore / 100) * (r.qualityScore / 100) * recency;
}
