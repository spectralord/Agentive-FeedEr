/**
 * T18.14 (§10.8): the pure status types/constants split out of `progress.ts`
 * so a Client Component can import them without dragging in that file's
 * DB-touching functions (`getProgress`, `setProgress`, ... → `@/db/client` →
 * `pg`). `SkillNodeDetail.tsx` became a `"use client"` component in this
 * task (for optimistic status updates) and needs `PROGRESS_STATUSES` at
 * runtime (not just as a type) — importing it from `progress.ts` directly
 * pulled `pg` into the browser bundle and broke `next build` with
 * `Module not found: Can't resolve 'tls'` (same class of break T18.7's own
 * notes already recorded for `reelDetailData.ts`/`ReelCardBody.tsx` — the
 * fix here is the same shape: extract the DB-free part into its own file).
 *
 * `progress.ts` re-exports everything below for existing importers — no
 * other module needs to change its import path.
 */

export const PROGRESS_STATUSES = ["seen", "tried", "mastered"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

/** Kept for the write path only (e.g. a future "declare a status" default) —
 *  the read path no longer uses this to paper over a missing row. See
 *  `UNTOUCHED_STATUS` below (T18.4/§9.4). */
export const DEFAULT_PROGRESS_STATUS: ProgressStatus = "seen";

export function isProgressStatus(value: string): value is ProgressStatus {
  return (PROGRESS_STATUSES as readonly string[]).includes(value);
}

/**
 * T18.4 (§9.4): the fourth, purely-read-layer state. A `skill_nodes` row can
 * exist with *no* `user_progress` row at all — e.g. SkillTagger created it
 * off a Reel nobody has ever opened. That is genuinely different from a user
 * explicitly declaring "seen", and the DB already distinguishes the two;
 * this constant/type is what lets the read layer stop discarding the
 * distinction (previously: `?? DEFAULT_PROGRESS_STATUS` collapsed both into
 * "seen"). Never written to `user_progress` — it exists only in read-layer
 * return values (`SkillMapNode.status`, `SkillNodeDetail.status`) and the
 * `SkillRing` component's status prop.
 */
export const UNTOUCHED_STATUS = "untouched" as const;

/** The four honest states a UI can show, vs. the three a user can actually
 *  declare (`ProgressStatus`). */
export type DisplayStatus = typeof UNTOUCHED_STATUS | ProgressStatus;

export function isDisplayStatus(value: string): value is DisplayStatus {
  return value === UNTOUCHED_STATUS || isProgressStatus(value);
}
