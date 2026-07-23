import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { interactions, rawItems, reels, sources } from "@/db/schema";
import type { FeedCategory, FeedMaturity } from "@/lib/feed";

/**
 * User reactions to a reel (Epic 6): save/hide/up/down, toggle semantics —
 * the same type on the same reel a second time deletes the row again (T6.2).
 * Deliberately no "tried"/done state — see docs/plan/epic-6-interactions.md
 * "Revidiert 2026-07-23".
 */

export const INTERACTION_TYPES = ["save", "hide", "up", "down"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

/** zod body schema for POST /api/interactions. */
export const interactionRequestSchema = z.object({
  reelId: z.number().int().positive(),
  type: z.enum(INTERACTION_TYPES),
  note: z.string().min(1).optional(),
});

export interface ToggleResult {
  active: boolean;
}

/**
 * Toggles one interaction: if reelId+type already has a row, deletes it
 * (untoggle) and returns `{ active: false }`; otherwise inserts one and
 * returns `{ active: true }`. Returns undefined if the reel doesn't exist.
 */
export async function toggleInteraction(
  reelId: number,
  type: InteractionType,
  note?: string,
): Promise<ToggleResult | undefined> {
  return db().transaction(async (tx) => {
    const [reel] = await tx.select({ id: reels.id }).from(reels).where(eq(reels.id, reelId));
    if (!reel) return undefined;

    const [existing] = await tx
      .select({ id: interactions.id })
      .from(interactions)
      .where(and(eq(interactions.reelId, reelId), eq(interactions.type, type)));

    if (existing) {
      await tx.delete(interactions).where(eq(interactions.id, existing.id));
      return { active: false };
    }

    await tx.insert(interactions).values({ reelId, type, note: note ?? null });
    return { active: true };
  });
}

/**
 * Deletes a reel's interaction of `type` if present (idempotent no-op
 * otherwise). Used by the /saved "Entfernen" action, which always means
 * "make inactive", unlike `toggleInteraction` which would re-add it if it
 * were already gone.
 */
export async function removeInteraction(reelId: number, type: InteractionType): Promise<void> {
  await db()
    .delete(interactions)
    .where(and(eq(interactions.reelId, reelId), eq(interactions.type, type)));
}

export interface ReelActionFlags {
  save: boolean;
  up: boolean;
  down: boolean;
}

/**
 * Active save/up/down flags per reel id, for hydrating ReelCard's action bar
 * with the current toggle state. `hide` is intentionally excluded — a hidden
 * reel never reaches the feed query in the first place (see getReels).
 */
export async function getInteractionFlags(
  reelIds: number[],
): Promise<Map<number, ReelActionFlags>> {
  const map = new Map<number, ReelActionFlags>();
  if (reelIds.length === 0) return map;

  const rows = await db()
    .select({ reelId: interactions.reelId, type: interactions.type })
    .from(interactions)
    .where(
      and(
        inArray(interactions.reelId, reelIds),
        inArray(interactions.type, ["save", "up", "down"]),
      ),
    );

  for (const row of rows) {
    const flags = map.get(row.reelId) ?? { save: false, up: false, down: false };
    if (row.type === "save") flags.save = true;
    if (row.type === "up") flags.up = true;
    if (row.type === "down") flags.down = true;
    map.set(row.reelId, flags);
  }
  return map;
}

export interface SavedReel {
  id: number;
  rawItemId: number;
  title: string;
  url: string;
  publishedAt: Date;
  sourceName: string;
  summary: string;
  category: FeedCategory;
  maturity: FeedMaturity;
  experimental: boolean;
  relevanceScore: number;
  qualityScore: number;
  example: string | null;
  action: string | null;
  effortTag: "5-min-test" | "afternoon" | "know-only" | null;
  skill: string | null;
  /** When the active save interaction was created. */
  savedAt: Date;
}

function savedReelsBaseQuery() {
  return db()
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
      savedAt: interactions.createdAt,
    })
    .from(interactions)
    .innerJoin(reels, eq(interactions.reelId, reels.id))
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .innerJoin(sources, eq(rawItems.sourceId, sources.id));
}

/**
 * Reels with an active `save` interaction, newest save first (T6.3). No
 * quality/experimental filtering — a save is an explicit user signal and is
 * never hidden regardless of the feed's default thresholds.
 */
export async function getSavedReels(): Promise<SavedReel[]> {
  return savedReelsBaseQuery()
    .where(eq(interactions.type, "save"))
    .orderBy(desc(interactions.createdAt));
}

/** Lower/upper bounds (in days) for the spaced-resurfacing window, T6.5. */
export const RESURFACE_MIN_AGE_DAYS = 7;
export const RESURFACE_MAX_AGE_DAYS = 21;
export const RESURFACE_LIMIT = 2;

/**
 * Saved reels whose save is between RESURFACE_MIN_AGE_DAYS and
 * RESURFACE_MAX_AGE_DAYS old (T6.5) — oldest save first (closest to rotating
 * out naturally at 21 days). No "done" checkbox: items simply age out, or the
 * user removes the save via /saved.
 */
export async function getResurfacingCandidates(
  now: Date = new Date(),
  limit: number = RESURFACE_LIMIT,
): Promise<SavedReel[]> {
  const oldestAllowed = new Date(now.getTime() - RESURFACE_MAX_AGE_DAYS * 86_400_000);
  const newestAllowed = new Date(now.getTime() - RESURFACE_MIN_AGE_DAYS * 86_400_000);

  return savedReelsBaseQuery()
    .where(
      and(
        eq(interactions.type, "save"),
        gte(interactions.createdAt, oldestAllowed),
        lte(interactions.createdAt, newestAllowed),
      ),
    )
    .orderBy(interactions.createdAt)
    .limit(limit);
}
