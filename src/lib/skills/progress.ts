import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { skillNodes, userProgress, userProgressNotes } from "@/db/schema";
import type { UserProgress, UserProgressNote } from "@/db/schema";

/**
 * Self-confirmed progress per skill node (Epic 7, T7.1/T7.3). No gates or
 * prerequisites anywhere — `seen -> tried -> mastered` is purely descriptive,
 * and downgrades are allowed (e.g. re-declaring a node "seen" after
 * forgetting it). Progress lives ONLY here: it is never mirrored into
 * `interactions` (Epic 6's save/hide/up/down), which stays reel-scoped.
 */

export const PROGRESS_STATUSES = ["seen", "tried", "mastered"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const DEFAULT_PROGRESS_STATUS: ProgressStatus = "seen";

export function isProgressStatus(value: string): value is ProgressStatus {
  return (PROGRESS_STATUSES as readonly string[]).includes(value);
}

/** All `user_progress` rows for a set of node ids, keyed by node id. Nodes
 *  with no row yet are simply absent from the map — callers default them to
 *  `DEFAULT_PROGRESS_STATUS` ("seen"), never written to the DB until the
 *  user actually acts. */
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

export interface AdoptionLogEntry extends UserProgressNote {
  nodeSlug: string;
  nodeTitle: string;
}

/** T7.4: every note across every node, newest first — "what I actually
 *  adopted through the tool". Epic 6 dropped the reel `tried` interaction
 *  (see docs/plan/epic-6-interactions.md), so `user_progress_notes` is the
 *  only source left to merge (documented deviation in epic-7-skill-map.md). */
export async function listAdoptionLog(limit = 200): Promise<AdoptionLogEntry[]> {
  const rows = await db()
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
    .limit(limit);
  return rows;
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
