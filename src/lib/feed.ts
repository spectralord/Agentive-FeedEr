import { and, desc, eq, gt, gte, isNull, lt, notExists } from "drizzle-orm";
import { db } from "@/db/client";
import { interactions, rawItems, reels, sources, topicClusters } from "@/db/schema";
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
  /**
   * Epic 10 (ADR 0011, T10.4): exclude reels with a non-null `caveat`. Default
   * is to show them (transparency, per the epic file) — this only applies
   * when the feed/overview toggle explicitly asks to hide caveats.
   */
  hideCaveats?: boolean;
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
  /** Epic 15 (ADR 0013): narrow topic cluster this reel was assigned to by the
   *  clustering pass, or null if not yet clustered. */
  topicClusterId: number | null;
  /** Epic 15: true = independent/first-hand account, false = recognizable
   *  reblog of another cluster member, null = not yet clustered. */
  isPrimary: boolean | null;
  /** Epic 15: the cluster's title, or null if topicClusterId is null. */
  clusterTitle: string | null;
  /** Epic 11 (ADR 0012): the cluster's corroboration scale (few/some/strong),
   *  or null if not yet computed or the reel has no cluster. */
  confidence: "few" | "some" | "strong" | null;
  /** Epic 11: the independent-source count backing `confidence`, or null. */
  independentCount: number | null;
  /** Epic 11: the cluster's lifecycle state (active/deprecated), or null if
   *  the reel has no cluster. */
  lifecycleState: "active" | "deprecated" | null;
  /** Epic 11: id of the cluster that supersedes this one — a *proposal* from
   *  the freshness pass, not yet confirmed (ADR 0008) — or null. */
  supersededByClusterId: number | null;
  /** Epic 11: the grounded reason behind supersededByClusterId, or null. */
  supersedeReason: string | null;
  /** Epic 10 (ADR 0011): the Stage-1 Reel-Verifier's caveat, or null if the
   *  critic pass found nothing to flag (the normal case) or hasn't run yet. */
  caveat: string | null;
}

/** One topic cluster with >= 2 displayed members, bundled for the "N sources
 *  on this topic" stack card (T15.4). Primary = the member with is_primary
 *  true, else the newest (see groupReelsForFeed). */
export interface FeedStackItem {
  type: "stack";
  clusterId: number;
  clusterTitle: string;
  primary: FeedReel;
  others: FeedReel[];
}

export interface FeedSoloItem {
  type: "solo";
  reel: FeedReel;
}

export type FeedItem = FeedStackItem | FeedSoloItem;

/**
 * Groups an already-fetched, already-ordered (newest first) reel list into
 * feed items: a topic cluster with >= 2 members becomes one FeedStackItem
 * positioned at its newest member's slot; everything else (no cluster, or a
 * cluster reduced to a single visible member — e.g. the other member(s) are
 * hidden, ADR 0013/T15.4 "leert sich ein Stapel auf 1, wird es wieder
 * Einzelkarte") renders as a plain FeedSoloItem, unchanged from before Epic 15.
 *
 * Additive to the existing hide mechanic: `reels` here is whatever getReels
 * already returned (hidden reels excluded), so a hidden member simply isn't
 * present to be grouped in the first place.
 */
export function groupReelsForFeed(reelsList: FeedReel[]): FeedItem[] {
  const items: FeedItem[] = [];
  const stackIndexByClusterId = new Map<number, number>();

  for (const reel of reelsList) {
    if (reel.topicClusterId === null) {
      items.push({ type: "solo", reel });
      continue;
    }

    const existingIndex = stackIndexByClusterId.get(reel.topicClusterId);
    if (existingIndex === undefined) {
      items.push({
        type: "stack",
        clusterId: reel.topicClusterId,
        clusterTitle: reel.clusterTitle ?? "",
        primary: reel, // provisional — reconciled below once all members are known
        others: [],
      });
      stackIndexByClusterId.set(reel.topicClusterId, items.length - 1);
    } else {
      const item = items[existingIndex];
      if (item.type === "stack") item.others.push(reel);
    }
  }

  return items.map((item) => {
    if (item.type !== "stack") return item;
    if (item.others.length === 0) {
      // Only one visible member left (e.g. the rest are hidden) — reverts to solo.
      return { type: "solo", reel: item.primary };
    }
    const allMembers = [item.primary, ...item.others];
    const explicitPrimary = allMembers.find((m) => m.isPrimary === true);
    const primary = explicitPrimary ?? allMembers[0]; // allMembers[0] is the newest (input order)
    return {
      type: "stack",
      clusterId: item.clusterId,
      clusterTitle: item.clusterTitle,
      primary,
      others: allMembers.filter((m) => m.id !== primary.id),
    };
  });
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

  // Epic 6 (T6.2): reels with an active `hide` interaction are excluded
  // everywhere getReels is used (feed, today, overview) — hide is never
  // deleted, just always filtered out, same "never delete" spirit as
  // low-quality reels (ADR 0004).
  conditions.push(
    notExists(
      db()
        .select({ id: interactions.id })
        .from(interactions)
        .where(and(eq(interactions.reelId, reels.id), eq(interactions.type, "hide"))),
    ),
  );

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
  if (opts.hideCaveats) {
    conditions.push(isNull(reels.caveat));
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
      topicClusterId: reels.topicClusterId,
      isPrimary: reels.isPrimary,
      clusterTitle: topicClusters.title,
      confidence: topicClusters.confidence,
      independentCount: topicClusters.independentCount,
      lifecycleState: topicClusters.lifecycleState,
      supersededByClusterId: topicClusters.supersededByClusterId,
      supersedeReason: topicClusters.supersedeReason,
      caveat: reels.caveat,
    })
    .from(reels)
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .innerJoin(sources, eq(rawItems.sourceId, sources.id))
    .leftJoin(topicClusters, eq(reels.topicClusterId, topicClusters.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(rawItems.publishedAt))
    .limit(opts.limit ?? DEFAULT_FEED_LIMIT);

  return rows;
}
