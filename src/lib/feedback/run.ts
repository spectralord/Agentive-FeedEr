import { count, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { interactions, rawItems, reels } from "@/db/schema";
import { getAppState, setAppState } from "@/lib/appState";
import { callStructured } from "@/lib/claude";
import {
  buildFeedbackUserPrompt,
  FEEDBACK_SYSTEM_PROMPT,
  FEEDBACK_TOOL_NAME,
  feedbackSummaryJsonSchema,
  feedbackSummarySchema,
  type RecentInteractionRow,
} from "./prompt";

export const FEEDBACK_SUMMARY_KEY = "feedback_summary";
/** Rolling summary only regenerates once at least this many interactions
 *  have accumulated since the last generation (T6.4). */
export const MIN_NEW_INTERACTIONS = 10;
/** How many of the most recent interactions feed the summary call. */
export const MAX_INTERACTIONS_INPUT = 100;

export interface FeedbackSummaryState {
  /** Rendered bullet text, ready to inject into the enrichment prompt as-is. */
  summary: string;
  generatedAt: string; // ISO
  /** Total interactions row count at generation time — the baseline the next
   *  run's "new since last summary" threshold check compares against. */
  interactionCountAtGeneration: number;
}

/** Signature of the structured-call dependency — injectable for tests, same
 *  pattern as src/lib/enrichment/run.ts's StructuredCaller. */
export type StructuredCaller = (opts: {
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
}) => Promise<unknown>;

export interface FeedbackSummaryResult {
  ran: boolean;
  reason?: "below-threshold";
  newInteractions: number;
  bulletCount?: number;
}

async function countInteractions(db: NodePgDatabase<typeof schema>): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(interactions);
  return value;
}

async function loadRecentInteractions(
  db: NodePgDatabase<typeof schema>,
  limit: number,
): Promise<RecentInteractionRow[]> {
  return db
    .select({
      type: interactions.type,
      createdAt: interactions.createdAt,
      title: rawItems.title,
      category: reels.category,
      skill: reels.skill,
    })
    .from(interactions)
    .innerJoin(reels, eq(interactions.reelId, reels.id))
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .orderBy(desc(interactions.createdAt))
    .limit(limit);
}

/**
 * Rolling feedback summary (T6.4). Runs after enrichment in the daily job:
 * once >= MIN_NEW_INTERACTIONS interactions have accumulated since the last
 * summary, a small Claude call (Haiku by default, see callStructured/
 * env().ANTHROPIC_MODEL) distills the last MAX_INTERACTIONS_INPUT
 * interactions (with reel title/category/skill) into 5-8 German bullet
 * points, stored in app_state["feedback_summary"]. The *next* enrichment run
 * picks this up as extra relevance context — see
 * src/lib/enrichment/prompt.ts's `feedbackSummary` input and
 * src/lib/enrichment/run.ts's `loadFeedbackSummaryText` call.
 *
 * Below the threshold this is a no-op (no Claude call). Callers should not
 * let a failure here abort the pipeline run (see src/lib/pipeline.ts).
 */
export async function runFeedbackSummary(
  db: NodePgDatabase<typeof schema>,
  caller: StructuredCaller = callStructured,
): Promise<FeedbackSummaryResult> {
  const totalCount = await countInteractions(db);
  const existing = await getAppState<FeedbackSummaryState>(db, FEEDBACK_SUMMARY_KEY);
  const newInteractions = totalCount - (existing?.interactionCountAtGeneration ?? 0);

  if (newInteractions < MIN_NEW_INTERACTIONS) {
    return { ran: false, reason: "below-threshold", newInteractions };
  }

  const rows = await loadRecentInteractions(db, MAX_INTERACTIONS_INPUT);
  const raw = await caller({
    system: FEEDBACK_SYSTEM_PROMPT,
    user: buildFeedbackUserPrompt(rows),
    toolName: FEEDBACK_TOOL_NAME,
    inputSchema: feedbackSummaryJsonSchema,
  });
  const { bullets } = feedbackSummarySchema.parse(raw);
  const summary = bullets.map((b) => `- ${b}`).join("\n");

  const state: FeedbackSummaryState = {
    summary,
    generatedAt: new Date().toISOString(),
    interactionCountAtGeneration: totalCount,
  };
  await setAppState(db, FEEDBACK_SUMMARY_KEY, state);

  return { ran: true, newInteractions, bulletCount: bullets.length };
}

/** The stored bullet text (if any summary has been generated yet) — used by
 *  runEnrichment to inject "Beobachtetes Verhalten" context into the prompt. */
export async function loadFeedbackSummaryText(
  db: NodePgDatabase<typeof schema>,
): Promise<string | undefined> {
  const state = await getAppState<FeedbackSummaryState>(db, FEEDBACK_SUMMARY_KEY);
  return state?.summary;
}
