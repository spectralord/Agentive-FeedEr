import { and, asc, eq, isNull, sql } from "drizzle-orm";
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
 * "Anlegen": confirms a pending proposal as a real, matchable node, and
 * **immediately back-links the items whose `skillHint` produced it**.
 *
 * The back-link was added 2026-08-03. Before it, confirming only flipped
 * `status` and left every item `skill IS NULL` until the next full
 * `runSkillTagging` sweep — so a freshly confirmed node showed **zero linked
 * reels**, which reads as "confirming did nothing" and hides the Skill tab
 * (and with it the Action + its tick) on exactly the items that motivated the
 * proposal. Owner feedback: "they are created with new reels linked. I would
 * expect at least one."
 *
 * Deliberately conservative — this is a **exact, case-insensitive** match on the
 * raw `skillHint` text the enrichment pass left in `metadata`, not fuzzy
 * matching or an LLM call:
 *   - it only touches items that are still unassigned (`skill IS NULL`), so it
 *     can never steal an item from another node;
 *   - anything it does not catch is still picked up by the next tagger sweep,
 *     which *is* the LLM-backed Match-or-Propose step (ADR 0009). This is a
 *     head start, not a replacement for it.
 */
export async function confirmNode(id: number): Promise<SkillNode | undefined> {
  const [row] = await db()
    .update(skillNodes)
    .set({ status: "active" })
    .where(eq(skillNodes.id, id))
    .returning();
  if (!row) return undefined;

  await backlinkByHint(row);
  return row;
}

/**
 * Assigns `node.slug` to every still-unassigned reel / experience report whose
 * stored `skillHint` equals the node's title (case-insensitive, trimmed).
 * Returns how many rows were linked — used by the tests, ignored by callers.
 */
export async function backlinkByHint(node: SkillNode): Promise<number> {
  const hintMatches = sql`lower(btrim(${reels.metadata} ->> 'skillHint')) = lower(btrim(${node.title}))`;

  const linkedReels = await db()
    .update(reels)
    .set({ skill: node.slug })
    .where(and(isNull(reels.skill), hintMatches))
    .returning({ id: reels.id });

  return linkedReels.length;
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
    // Defensive, per the original comment: a pending node's own slug is never
    // assigned by the tagger, so this normally matches nothing. Kept anyway —
    // it is cheap and correct if that ever changes.
    await tx.update(reels).set({ skill: targetSlug }).where(eq(reels.skill, pending.slug));
    await tx
      .update(experienceReports)
      .set({ skill: targetSlug, updatedAt: new Date() })
      .where(eq(experienceReports.skill, pending.slug));
    // The real link, added 2026-08-03 alongside confirmNode's back-link: the
    // items that actually motivated this proposal carry the pending node's
    // TITLE as their skillHint, not its slug. Without this, merging (like
    // confirming) looked like it did nothing to the reels the user was
    // looking at.
    await tx
      .update(reels)
      .set({ skill: targetSlug })
      .where(
        and(
          isNull(reels.skill),
          sql`lower(btrim(${reels.metadata} ->> 'skillHint')) = lower(btrim(${pending.title}))`,
        ),
      );
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
