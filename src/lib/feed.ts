import { and, desc, eq, gt, gte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { rawItems, reels, sources } from "@/db/schema";
import { CATEGORIES, MATURITIES } from "@/lib/enrichment/schema";
import { env } from "@/lib/env";

export type FeedCategory = (typeof CATEGORIES)[number];
export type FeedMaturity = (typeof MATURITIES)[number];

export const DEFAULT_FEED_LIMIT = 50;

export interface GetReelsOptions {
  /** Cursor for "load older": only items published strictly before this. */
  before?: Date;
  /** Exact category match. Unknown values are ignored (no filter applied). */
  category?: string;
  /** Only items published within env().NEW_DAYS. */
  onlyNew?: boolean;
  /** Only items ingested at or after this instant (Today's Top-N candidates, Epic 4). */
  sinceIngested?: Date;
  /** Lift the default quality_score >= env().QUALITY_THRESHOLD floor. */
  showWeak?: boolean;
  /** Exact maturity match. Unknown values are ignored (no filter applied). */
  maturity?: string;
  /** Only items with relevance_score >= this value (Übersicht "Min-Relevanz", T5.3). */
  minRelevance?: number;
  /** Only items published at or after this instant (Übersicht "Zeitraum", T5.3). */
  publishedAfter?: Date;
  /**
   * Exclude reels flagged `experimental` (the stored boolean, not the
   * `maturity` enum) — Übersicht "🧪 experimentell zeigen" toggle, T5.3.
   */
  excludeExperimental?: boolean;
  /** Max rows returned, default 50. */
  limit?: number;
}

export interface FeedReel {
  id: number;
  rawItemId: number;
  title: string;
  url: string;
  publishedAt: Date;
  sourceName: string;
  summary: string;
  category: FeedCategory;
  maturity: "experimental" | "emerging" | "established";
  experimental: boolean;
  relevanceScore: number;
  qualityScore: number;
  example: string | null;
  action: string | null;
  effortTag: "5-min-test" | "afternoon" | "know-only" | null;
  skill: string | null;
}

function isKnownCategory(value: string): value is FeedCategory {
  return (CATEGORIES as readonly string[]).includes(value);
}

function isKnownMaturity(value: string): value is FeedMaturity {
  return (MATURITIES as readonly string[]).includes(value);
}

/**
 * Reels joined with their raw item + source, newest first.
 * Low-quality reels are hidden by default (never deleted) — see ADR 0004.
 */
export async function getReels(opts: GetReelsOptions = {}): Promise<FeedReel[]> {
  const conditions = [];

  if (!opts.showWeak) {
    conditions.push(gte(reels.qualityScore, env().QUALITY_THRESHOLD));
  }
  if (opts.category && isKnownCategory(opts.category)) {
    conditions.push(eq(reels.category, opts.category));
  }
  if (opts.onlyNew) {
    const cutoff = new Date(Date.now() - env().NEW_DAYS * 86_400_000);
    conditions.push(gt(rawItems.publishedAt, cutoff));
  }
  if (opts.before) {
    conditions.push(lt(rawItems.publishedAt, opts.before));
  }
  if (opts.sinceIngested) {
    conditions.push(gte(rawItems.ingestedAt, opts.sinceIngested));
  }
  if (opts.maturity && isKnownMaturity(opts.maturity)) {
    conditions.push(eq(reels.maturity, opts.maturity));
  }
  if (opts.minRelevance !== undefined) {
    conditions.push(gte(reels.relevanceScore, opts.minRelevance));
  }
  if (opts.publishedAfter) {
    conditions.push(gte(rawItems.publishedAt, opts.publishedAfter));
  }
  if (opts.excludeExperimental) {
    conditions.push(eq(reels.experimental, false));
  }

  const rows = await db()
    .select({
      id: reels.id,
      rawItemId: reels.rawItemId,
      title: rawItems.title,
      url: rawItems.url,
      publishedAt: rawItems.publishedAt,
      sourceName: sources.name,
      summary: reels.summary,
      category: reels.category,
      maturity: reels.maturity,
      experimental: reels.experimental,
      relevanceScore: reels.relevanceScore,
      qualityScore: reels.qualityScore,
      example: reels.example,
      action: reels.action,
      effortTag: reels.effortTag,
      skill: reels.skill,
    })
    .from(reels)
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .innerJoin(sources, eq(rawItems.sourceId, sources.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(rawItems.publishedAt))
    .limit(opts.limit ?? DEFAULT_FEED_LIMIT);

  return rows;
}
