import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { skillNodes, userProgress, userProgressNotes } from "@/db/schema";
import type { UserProgress, UserProgressNote } from "@/db/schema";
import { listCompletionsWithNotes } from "@/lib/actionables";

/**
 * Self-confirmed progress per skill node (Epic 7, T7.1/T7.3). No gates or
 * prerequisites anywhere — `seen -> tried -> mastered` is purely descriptive,
 * and downgrades are allowed (e.g. re-declaring a node "seen" after
 * forgetting it). Progress lives ONLY here: it is never mirrored into
 * `interactions` (Epic 6's save/hide/up/down), which stays reel-scoped.
 */

// T18.14: the pure status vocabulary lives in ./progressStatus (no DB
// imports) so Client Components can use it without dragging `pg` into the
// browser bundle. Imported here for local use and re-exported so every
// existing server-side importer keeps working — one source of truth, two
// entry points.
import {
  PROGRESS_STATUSES,
  DEFAULT_PROGRESS_STATUS,
  isProgressStatus,
  UNTOUCHED_STATUS,
  isDisplayStatus,
} from "./progressStatus";
import type { ProgressStatus, DisplayStatus } from "./progressStatus";

export {
  PROGRESS_STATUSES,
  DEFAULT_PROGRESS_STATUS,
  isProgressStatus,
  UNTOUCHED_STATUS,
  isDisplayStatus,
};
export type { ProgressStatus, DisplayStatus };

/** All `user_progress` rows for a set of node ids, keyed by node id. Nodes
 *  with no row yet are simply absent from the map — callers surface that as
 *  `UNTOUCHED_STATUS`, never written to the DB until the user actually
 *  acts. */
export async function getProgressMap(skillNodeIds: number[]): Promise<Map<number, UserProgress>> {
  const map = new Map<number, UserProgress>();
  if (skillNodeIds.length === 0) return map;

  const rows = await db().select().from(userProgress).where(inArray(userProgress.skillNodeId, skillNodeIds));
  for (const row of rows) map.set(row.skillNodeId, row);
  return map;
}

export async function getProgress(skillNodeId: number): Promise<UserProgress | undefined> {
  const [row] = await db().select().from(userProgress).where(eq(userProgress.skillNodeId, skillNodeId));
  return row;
}

/** Note history for one node, oldest first (a readable "diary" of the
 *  node), used by the node detail panel. */
export async function listNotesForNode(skillNodeId: number): Promise<UserProgressNote[]> {
  return db()
    .select()
    .from(userProgressNotes)
    .where(eq(userProgressNotes.skillNodeId, skillNodeId))
    .orderBy(asc(userProgressNotes.createdAt));
}

/** The original (and, until Epic 20, only) Adoption Log source: a note
 *  attached to a declared-status change. */
export interface ProgressAdoptionLogEntry extends UserProgressNote {
  source: "progress";
  nodeSlug: string;
  nodeTitle: string;
}

/**
 * Epic 20 (ADR 0019 decision 4): the Log's second source — a completed
 * Actionable with a note. The completion belongs to the NODE, not the Reel
 * (Epic 6's removal of a reel-level `tried` interaction stands; this does
 * not reinstate it) — `actionText` is the decision-5 snapshot, exactly what
 * was ticked, not a live re-read of `reels.action`.
 */
export interface ActionableAdoptionLogEntry {
  source: "actionable";
  id: number;
  skillNodeId: number;
  actionText: string;
  note: string;
  createdAt: Date;
  nodeSlug: string;
  nodeTitle: string;
}

export type AdoptionLogEntry = ProgressAdoptionLogEntry | ActionableAdoptionLogEntry;

/**
 * T7.4, extended T20.5: every note across every node, newest first —
 * "what I actually adopted through the tool". Two sources merged by
 * timestamp: `user_progress_notes` (a note on a declared-status change) and
 * completed Actionables that carry a note (Epic 20). Epic 6 dropped the
 * reel `tried` interaction (see docs/plan/epic-6-interactions.md); this
 * restores a genuine second source WITHOUT reinstating that — the
 * completion is attributed to the node, never rendered as a reel check-off.
 */
export async function listAdoptionLog(limit = 200): Promise<AdoptionLogEntry[]> {
  const [progressRows, actionableRows] = await Promise.all([
    db()
      .select({
        id: userProgressNotes.id,
        skillNodeId: userProgressNotes.skillNodeId,
        status: userProgressNotes.status,
        note: userProgressNotes.note,
        createdAt: userProgressNotes.createdAt,
        nodeSlug: skillNodes.slug,
        nodeTitle: skillNodes.title,
      })
      .from(userProgressNotes)
      .innerJoin(skillNodes, eq(userProgressNotes.skillNodeId, skillNodes.id))
      .orderBy(desc(userProgressNotes.createdAt))
      .limit(limit),
    listCompletionsWithNotes(limit),
  ]);

  const merged: AdoptionLogEntry[] = [
    ...progressRows.map((r): ProgressAdoptionLogEntry => ({ ...r, source: "progress" })),
    ...actionableRows.map(
      (r): ActionableAdoptionLogEntry => ({
        source: "actionable",
        id: r.id,
        skillNodeId: r.skillNodeId,
        actionText: r.actionText,
        note: r.note as string, // listCompletionsWithNotes already filters note IS NOT NULL
        createdAt: r.doneAt,
        nodeSlug: r.nodeSlug,
        nodeTitle: r.nodeTitle,
      }),
    ),
  ];
  merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return merged.slice(0, limit);
}

/**
 * Upserts a node's status (downgrades allowed — this is a map, not a gated
 * tree) and, when a non-empty note is given, appends it to the note history
 * (T7.4's Adoption-Log source). A status change with no note updates
 * `user_progress` but leaves no log entry — a silent status flip isn't
 * "adopted", it's just bookkeeping.
 */
export async function setProgress(
  skillNodeId: number,
  status: ProgressStatus,
  note?: string,
): Promise<UserProgress> {
  const trimmedNote = note?.trim();

  return db().transaction(async (tx) => {
    const [existing] = await tx.select().from(userProgress).where(eq(userProgress.skillNodeId, skillNodeId));
    const nextNote = trimmedNote || (existing?.note ?? null);

    let row: UserProgress;
    if (existing) {
      [row] = await tx
        .update(userProgress)
        .set({ status, note: nextNote, updatedAt: new Date() })
        .where(eq(userProgress.skillNodeId, skillNodeId))
        .returning();
    } else {
      [row] = await tx.insert(userProgress).values({ skillNodeId, status, note: nextNote }).returning();
    }

    if (trimmedNote) {
      await tx.insert(userProgressNotes).values({ skillNodeId, status, note: trimmedNote });
    }

    return row;
  });
}
