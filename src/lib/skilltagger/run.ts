import { eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { experienceReports, rawItems, reels, skillNodes } from "@/db/schema";
import { callStructured } from "@/lib/claude";
import type { ExistingSkillNode } from "./prompt";
import { tagContent, type StructuredCaller, type TagResult } from "./tagger";

export type { StructuredCaller } from "./tagger";

export interface SkillTaggingResult {
  processed: number;
  matched: number;
  proposed: number;
  failed: number;
}

/** Which content row a tag result applies to — the two content types the
 *  SkillTagger serves (ADR 0009: "ein Tagger, mehrere Auslöser"). */
export type ContentRef = { type: "reel"; id: number } | { type: "report"; id: number };

interface TaggableItem {
  ref: ContentRef;
  hint: string | null;
  title: string;
  text: string;
}

async function loadActiveNodes(db: NodePgDatabase<typeof schema>): Promise<ExistingSkillNode[]> {
  return db
    .select({ slug: skillNodes.slug, title: skillNodes.title, description: skillNodes.description })
    .from(skillNodes)
    .where(eq(skillNodes.status, "active"));
}

async function loadPendingReels(db: NodePgDatabase<typeof schema>): Promise<TaggableItem[]> {
  const rows = await db
    .select({ id: reels.id, title: rawItems.title, text: reels.summary, metadata: reels.metadata })
    .from(reels)
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .where(isNull(reels.skill));

  return rows.map((r) => ({
    ref: { type: "reel", id: r.id },
    // T12.2: the raw competency guess enrichment left behind in metadata.
    hint: (r.metadata as { skillHint?: string } | null)?.skillHint ?? null,
    title: r.title,
    text: r.text,
  }));
}

async function loadPendingReports(db: NodePgDatabase<typeof schema>): Promise<TaggableItem[]> {
  const rows = await db
    .select({ id: experienceReports.id, title: experienceReports.title, text: experienceReports.body })
    .from(experienceReports)
    .where(isNull(experienceReports.skill));

  return rows.map((r) => ({
    ref: { type: "report", id: r.id },
    hint: null, // experience reports have no enrichment skill_hint
    title: r.title,
    text: r.text,
  }));
}

async function loadOne(
  db: NodePgDatabase<typeof schema>,
  ref: ContentRef,
): Promise<TaggableItem | undefined> {
  if (ref.type === "reel") {
    const [row] = await db
      .select({ id: reels.id, title: rawItems.title, text: reels.summary, metadata: reels.metadata, skill: reels.skill })
      .from(reels)
      .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
      .where(eq(reels.id, ref.id));
    if (!row || row.skill !== null) return undefined; // already tagged — idempotent no-op
    return {
      ref,
      hint: (row.metadata as { skillHint?: string } | null)?.skillHint ?? null,
      title: row.title,
      text: row.text,
    };
  }
  const [row] = await db
    .select({ id: experienceReports.id, title: experienceReports.title, text: experienceReports.body, skill: experienceReports.skill })
    .from(experienceReports)
    .where(eq(experienceReports.id, ref.id));
  if (!row || row.skill !== null) return undefined;
  return { ref, hint: null, title: row.title, text: row.text };
}

/** Applies a tag decision: `match` sets the content's canonical skill;
 *  `propose` upserts a `pending` node (never downgrades an existing
 *  active/pending row — `onConflictDoNothing`) and leaves the item untagged
 *  until a human confirms the proposal (T12.6). */
async function applyResult(
  db: NodePgDatabase<typeof schema>,
  ref: ContentRef,
  result: TagResult,
): Promise<void> {
  if ("match" in result) {
    if (ref.type === "reel") {
      await db.update(reels).set({ skill: result.match }).where(eq(reels.id, ref.id));
    } else {
      await db.update(experienceReports).set({ skill: result.match }).where(eq(experienceReports.id, ref.id));
    }
    return;
  }

  await db
    .insert(skillNodes)
    .values({
      slug: result.propose.slug,
      title: result.propose.title,
      theme: result.propose.theme,
      description: result.propose.description,
      status: "pending",
    })
    .onConflictDoNothing({ target: skillNodes.slug });
}

/**
 * Batch sweep (T12.4): tags every reel + experience_report with `skill IS
 * NULL`, idempotent (a rerun with nothing new to tag processes 0). This is
 * both the daily-job stage (after enrichment, see src/lib/pipeline.ts) and
 * the backstop for anything the on-save path (`tagSingle`) missed or for
 * items newly unblocked by a confirmed proposal (T12.6).
 *
 * Per-item try/catch (ingestion/enrichment convention): one item's failure
 * never aborts the run; it simply stays `skill IS NULL` and is retried next
 * run (no separate error column here, unlike raw_items.enrich_error — every
 * unresolved item is inherently retryable).
 */
export async function runSkillTagging(
  db: NodePgDatabase<typeof schema>,
  caller: StructuredCaller = callStructured,
): Promise<SkillTaggingResult> {
  const activeNodes = await loadActiveNodes(db);
  const items = [...(await loadPendingReels(db)), ...(await loadPendingReports(db))];

  let matched = 0;
  let proposed = 0;
  let failed = 0;

  for (const { ref, hint, title, text } of items) {
    try {
      const result = await tagContent({ hint, title, text }, activeNodes, caller);
      await applyResult(db, ref, result);
      if ("match" in result) matched++;
      else proposed++;
    } catch (error) {
      failed++;
      console.error(`[skilltagger] ${ref.type} ${ref.id} failed:`, error);
    }
  }

  return { processed: items.length, matched, proposed, failed };
}

/**
 * On-save path (T12.5): tags a single freshly-created item (e.g. a manual
 * experience report right after createReport). A no-op if the item is
 * already tagged (idempotent) or no longer exists. Never throws — a failure
 * here just leaves the item for the daily backstop sweep to retry.
 */
export async function tagSingle(
  db: NodePgDatabase<typeof schema>,
  ref: ContentRef,
  caller: StructuredCaller = callStructured,
): Promise<TagResult | null> {
  try {
    const item = await loadOne(db, ref);
    if (!item) return null;
    const activeNodes = await loadActiveNodes(db);
    const result = await tagContent({ hint: item.hint, title: item.title, text: item.text }, activeNodes, caller);
    await applyResult(db, ref, result);
    return result;
  } catch (error) {
    console.error(`[skilltagger] tagSingle ${ref.type} ${ref.id} failed:`, error);
    return null;
  }
}
