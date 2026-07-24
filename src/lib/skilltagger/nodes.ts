import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { experienceReports, reels, skillNodes } from "@/db/schema";
import type { SkillNode } from "@/db/schema";

/**
 * Data access for confirming/merging/discarding SkillTagger proposals
 * (T12.6). Separate from src/lib/skilltagger/run.ts's internal queries,
 * which only ever read `active` nodes / insert `pending` ones — this module
 * is the human-in-the-loop side of Match-or-Propose (ADR 0009).
 */

export async function listPendingNodes(): Promise<SkillNode[]> {
  return db().select().from(skillNodes).where(eq(skillNodes.status, "pending")).orderBy(asc(skillNodes.createdAt));
}

export async function listActiveNodes(): Promise<SkillNode[]> {
  return db().select().from(skillNodes).where(eq(skillNodes.status, "active")).orderBy(asc(skillNodes.title));
}

/**
 * "Anlegen": confirms a pending proposal as a real, matchable node. Items
 * that caused the proposal are NOT retagged here — they were left
 * `skill IS NULL` (ADR 0009) and the next `runSkillTagging` sweep (daily
 * job, see src/lib/pipeline.ts) picks them up now that the node is active.
 */
export async function confirmNode(id: number): Promise<SkillNode | undefined> {
  const [row] = await db()
    .update(skillNodes)
    .set({ status: "active" })
    .where(eq(skillNodes.id, id))
    .returning();
  return row;
}

/**
 * "Mergen": folds a pending proposal into an existing node instead of
 * creating a new one. Any content already referencing the pending node's
 * slug (defensive — the tagger itself never assigns a pending slug, but this
 * keeps the operation correct regardless) is re-pointed at the target slug,
 * then the pending row is removed.
 */
export async function mergeNode(id: number, targetSlug: string): Promise<void> {
  const [pending] = await db().select().from(skillNodes).where(eq(skillNodes.id, id));
  if (!pending) return;

  await db().transaction(async (tx) => {
    await tx.update(reels).set({ skill: targetSlug }).where(eq(reels.skill, pending.slug));
    await tx
      .update(experienceReports)
      .set({ skill: targetSlug, updatedAt: new Date() })
      .where(eq(experienceReports.skill, pending.slug));
    await tx.delete(skillNodes).where(eq(skillNodes.id, id));
  });
}

/**
 * "Verwerfen": rejects a proposal outright. Hard delete — there is no
 * "discarded" lifecycle_state in this schema (only active/pending, T12.1);
 * if the same competency comes up again later, the tagger proposes it fresh.
 */
export async function discardNode(id: number): Promise<void> {
  await db().delete(skillNodes).where(eq(skillNodes.id, id));
}
