import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { actionableCompletions, rawItems, reels, skillNodes, topicClusters } from "@/db/schema";
import type { ActionableCompletion } from "@/db/schema";

/**
 * Epic 20 (ADR 0019): Actionables (To-Try) — `reels.action` promoted to a
 * checkable item, with completions rolling up to the Reel's skill node as a
 * second, parallel progress track (`user_progress.status` stays the
 * self-declared track, untouched by anything here).
 *
 * `toggleActionable` is the ONE shared mutation (design doc §8.4, the same
 * rule that already governs `setProgress`): both the Reel Detail Skill tab
 * and the node page write through this single function, never a second
 * implementation. Route handlers are thin wrappers around it.
 */

export type EffortTag = "5-min-test" | "afternoon" | "know-only";

export type ToggleActionableResult =
  | { ok: true; state: "completed"; completion: ActionableCompletion }
  | { ok: true; state: "incomplete" }
  | { ok: false; reason: "not-found" | "no-action" | "no-skill" };

/**
 * Toggles a Reel's Actionable: if a completion already exists for
 * `reelId`, deletes it (untoggle) and returns `{ state: "incomplete" }`.
 * Otherwise inserts one, **snapshotting** `action`/`effortTag` from the Reel
 * as they are right now (ADR 0019 decision 5 — `reels.action` is mutable; a
 * later re-enrichment must not silently rewrite this completion's history)
 * and resolving `skillNodeId` from `reels.skill` at this moment (so the
 * roll-up survives a later re-tag of the Reel itself).
 *
 * Refuses (typed failure, never throws) when:
 * - the Reel doesn't exist ("not-found"),
 * - the Reel has no `action` ("no-action") — nothing to snapshot,
 * - the Reel has no `skill`, or the tagged slug doesn't resolve to an
 *   `active` skill node ("no-skill") — nowhere to roll up.
 *
 * The last two cases are the same "sourced-only, null over hallucination"
 * discipline as ADR 0003/0005: an Actionable with no action or no node to
 * belong to is not invented into existence just because someone clicked.
 */
export async function toggleActionable(reelId: number, note?: string): Promise<ToggleActionableResult> {
  return db().transaction(async (tx) => {
    const [reel] = await tx
      .select({ action: reels.action, effortTag: reels.effortTag, skill: reels.skill })
      .from(reels)
      .where(eq(reels.id, reelId));
    if (!reel) return { ok: false, reason: "not-found" };

    const [existing] = await tx
      .select({ id: actionableCompletions.id })
      .from(actionableCompletions)
      .where(eq(actionableCompletions.reelId, reelId));

    if (existing) {
      await tx.delete(actionableCompletions).where(eq(actionableCompletions.id, existing.id));
      return { ok: true, state: "incomplete" };
    }

    if (!reel.action) return { ok: false, reason: "no-action" };
    if (!reel.skill) return { ok: false, reason: "no-skill" };

    const [node] = await tx
      .select({ id: skillNodes.id })
      .from(skillNodes)
      .where(and(eq(skillNodes.slug, reel.skill), eq(skillNodes.status, "active")));
    if (!node) return { ok: false, reason: "no-skill" };

    const trimmedNote = note?.trim();
    const [completion] = await tx
      .insert(actionableCompletions)
      .values({
        reelId,
        skillNodeId: node.id,
        actionText: reel.action,
        effortTag: reel.effortTag,
        note: trimmedNote || null,
      })
      .returning();

    return { ok: true, state: "completed", completion };
  });
}

export interface ActionableListItem {
  reelId: number;
  title: string;
  url: string;
  publishedAt: Date;
  /** Live view of the Reel's current action — NOT the snapshot. Uncompleted
   *  Actionables are a pure view over `reels.action` (ADR 0019 Consequences);
   *  the snapshot only exists once `completion` below is non-null. */
  action: string;
  effortTag: EffortTag | null;
  completion: {
    actionText: string;
    effortTag: EffortTag | null;
    note: string | null;
    doneAt: Date;
  } | null;
  /**
   * Epic 11 (ADR 0012) freshness/supersession, surfaced per ADR 0019's
   * resolved open question: an Actionable is NEVER hidden or expired for
   * this — its parent Reel's supersession state is labelled on it instead.
   * Non-null only while the cluster's `lifecycleState` is still "active"
   * (same gate `ReelCardBody.tsx` uses) — once a human confirms the
   * supersession via the Epic-11 route, the cluster flips to "deprecated"
   * and this reverts to null (the Reel-level UI treats that the same way).
   */
  supersession: { reason: string | null; supersededByClusterId: number } | null;
}

export interface ListActionablesOpts {
  /** Restrict to one effort tag (ADR 0019 decision 6). */
  effortTag?: EffortTag;
  /** Sort key — defaults to newest Reel first. "effort" orders by the fixed
   *  ADR 0019 effort scale (5-min-test, then afternoon, then know-only, then
   *  untagged last) so "give me a 5-minute win" reads as ascending effort. */
  sort?: "recent" | "effort";
}

const EFFORT_SORT_RANK: Record<EffortTag, number> = {
  "5-min-test": 0,
  afternoon: 1,
  "know-only": 2,
};

/**
 * The To-Try list for one skill node: every Reel tagged to it (by slug) that
 * has a non-null `action`, each annotated with its completion state (null =
 * not yet done). Reels without an `action` never appear here — sourced-only,
 * nothing invented for a Reel that has no recommended action (ADR 0005).
 */
export async function listActionablesForNode(
  skillNodeId: number,
  opts: ListActionablesOpts = {},
): Promise<ActionableListItem[]> {
  const [node] = await db().select({ slug: skillNodes.slug }).from(skillNodes).where(eq(skillNodes.id, skillNodeId));
  if (!node) return [];

  const rows = await db()
    .select({
      reelId: reels.id,
      title: rawItems.title,
      url: rawItems.url,
      publishedAt: rawItems.publishedAt,
      action: reels.action,
      effortTag: reels.effortTag,
      completionActionText: actionableCompletions.actionText,
      completionEffortTag: actionableCompletions.effortTag,
      completionNote: actionableCompletions.note,
      completionDoneAt: actionableCompletions.doneAt,
      clusterLifecycleState: topicClusters.lifecycleState,
      supersededByClusterId: topicClusters.supersededByClusterId,
      supersedeReason: topicClusters.supersedeReason,
    })
    .from(reels)
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .leftJoin(actionableCompletions, eq(actionableCompletions.reelId, reels.id))
    .leftJoin(topicClusters, eq(reels.topicClusterId, topicClusters.id))
    .where(
      opts.effortTag
        ? and(eq(reels.skill, node.slug), eq(reels.effortTag, opts.effortTag))
        : eq(reels.skill, node.slug),
    );

  const items: ActionableListItem[] = rows
    .filter((r) => r.action !== null)
    .map((r) => ({
      reelId: r.reelId,
      title: r.title,
      url: r.url,
      publishedAt: r.publishedAt,
      action: r.action as string,
      effortTag: r.effortTag,
      completion:
        r.completionActionText !== null
          ? {
              actionText: r.completionActionText,
              effortTag: r.completionEffortTag,
              note: r.completionNote,
              doneAt: r.completionDoneAt as Date,
            }
          : null,
      // Same gate as ReelCardBody.tsx: only "active" — once a human confirms
      // supersession, lifecycleState flips to "deprecated" and the label
      // (having done its job) stops showing, same as the Reel's own card.
      supersession:
        r.supersededByClusterId !== null && r.clusterLifecycleState === "active"
          ? { reason: r.supersedeReason, supersededByClusterId: r.supersededByClusterId }
          : null,
    }));

  if (opts.sort === "effort") {
    items.sort((a, b) => {
      const rankA = a.effortTag ? EFFORT_SORT_RANK[a.effortTag] : Number.MAX_SAFE_INTEGER;
      const rankB = b.effortTag ? EFFORT_SORT_RANK[b.effortTag] : Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return b.publishedAt.getTime() - a.publishedAt.getTime();
    });
  } else {
    items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  return items;
}

/**
 * Batch count of completed Actionables per skill node (evidence count).
 * Follows the existing batching convention (`getInteractionFlags`,
 * `getSkillTabInfoForSlugs`) — one query keyed by node id, not a query per
 * node inside a render loop.
 */
export async function countEvidenceForNodes(nodeIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (nodeIds.length === 0) return map;

  const rows = await db()
    .select({ skillNodeId: actionableCompletions.skillNodeId, count: sql<number>`count(*)::int` })
    .from(actionableCompletions)
    .where(inArray(actionableCompletions.skillNodeId, nodeIds))
    .groupBy(actionableCompletions.skillNodeId);

  for (const row of rows) map.set(row.skillNodeId, row.count);
  return map;
}

/**
 * Batch lookup of completion state for a set of reel ids — for hydrating the
 * Reel Detail Skill tab's tick control (T20.4), same batching convention as
 * `getInteractionFlags`. Reels with no completion are simply absent from the
 * map; callers treat that as "not completed".
 */
export async function getActionableCompletionFlags(
  reelIds: number[],
): Promise<Map<number, ActionableCompletion>> {
  const map = new Map<number, ActionableCompletion>();
  if (reelIds.length === 0) return map;

  const rows = await db()
    .select()
    .from(actionableCompletions)
    .where(inArray(actionableCompletions.reelId, reelIds));

  for (const row of rows) map.set(row.reelId, row);
  return map;
}

/** Every completion with a non-empty note, newest first — the source
 *  `listAdoptionLog` (T20.5) merges in alongside `user_progress_notes`. */
export async function listCompletionsWithNotes(limit = 200) {
  return db()
    .select({
      id: actionableCompletions.id,
      skillNodeId: actionableCompletions.skillNodeId,
      actionText: actionableCompletions.actionText,
      note: actionableCompletions.note,
      doneAt: actionableCompletions.doneAt,
      nodeSlug: skillNodes.slug,
      nodeTitle: skillNodes.title,
    })
    .from(actionableCompletions)
    .innerJoin(skillNodes, eq(actionableCompletions.skillNodeId, skillNodes.id))
    .where(sql`${actionableCompletions.note} is not null`)
    .orderBy(desc(actionableCompletions.doneAt))
    .limit(limit);
}
