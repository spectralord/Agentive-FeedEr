/**
 * Derived label logic (Epic 5, T5.1). Pure functions over reel facts already
 * stored in the DB (`published_at`, `maturity`, `relevance_score`,
 * `quality_score`, `action`) — see ADR 0004 ("Labels aus Fakten ableiten statt
 * fest stempeln"): display labels are views/queries over stored attributes,
 * never a stamped/stored value themselves. The sole stored exception is the
 * `experimental` boolean flag on the reel itself (not derived here).
 *
 * This module is the SINGLE source of label logic — no component or query
 * (ReelCard, /overview, ...) may reimplement these rules; import from here.
 */
import { env } from "@/lib/env";

export type Maturity = "experimental" | "emerging" | "established";

export interface NewableReel {
  publishedAt: Date;
}

/** "🆕 Neu": published within env().NEW_DAYS of `now`. */
export function isNew(r: NewableReel, now: Date = new Date()): boolean {
  return r.publishedAt.getTime() > now.getTime() - env().NEW_DAYS * 86_400_000;
}

export interface SotaReel {
  maturity: Maturity;
  relevanceScore: number;
  qualityScore: number;
}

/**
 * "⭐ State of the Art": established maturity + high relevance and quality.
 * Deliberately age-independent — explicit requirement (epic-5-overview.md T5.1).
 */
export function isSota(r: SotaReel): boolean {
  return r.maturity === "established" && r.relevanceScore >= 70 && r.qualityScore >= 70;
}

export interface BestPracticeReel {
  maturity: Maturity;
  action: string | null;
  qualityScore: number;
}

/** "🛠️ Best Practice": not experimental, has a concrete action, high quality. */
export function isBestPractice(r: BestPracticeReel): boolean {
  return r.maturity !== "experimental" && r.action !== null && r.qualityScore >= 70;
}
