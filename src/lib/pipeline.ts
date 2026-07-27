import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { pipelineRuns } from "@/db/schema";
import { runClustering, type ClusteringResult } from "@/lib/clustering/run";
import { runEnrichment, type EnrichmentResult } from "@/lib/enrichment/run";
import { env } from "@/lib/env";
import { resolveExecutionConfig } from "@/lib/executor/config";
import { getExecutor } from "@/lib/executor/executor";
import { runFeedbackSummary, type FeedbackSummaryResult } from "@/lib/feedback/run";
import { runIngestion, type IngestionResult } from "@/lib/ingestion/run";
import { runKnowledgeCheck, type KnowledgeCheckResult } from "@/lib/knowledge-check/run";
import { runSkillTagging, type SkillTaggingResult } from "@/lib/skilltagger/run";
import { runVerifier, type VerifierRunResult } from "@/lib/verifier/run";

export type PipelineMode = "full" | "ingestion" | "enrichment";
export type PipelineTrigger = "manual" | "cron";

export interface PipelineSummary {
  ingestion?: IngestionResult;
  enrichment?: EnrichmentResult;
  skillTagging?: SkillTaggingResult;
  clustering?: ClusteringResult;
  knowledgeCheck?: KnowledgeCheckResult;
  verifier?: VerifierRunResult;
  feedback?: FeedbackSummaryResult;
}

/** A run older than this that is still "running" is treated as stale (e.g. the
 *  container was restarted mid-run), so it no longer blocks a new run. */
export const STALE_RUN_MS = 30 * 60_000;

export class PipelineBusyError extends Error {
  constructor() {
    super("A pipeline run is already in progress.");
    this.name = "PipelineBusyError";
  }
}

/** Pure phase runner shared by cron and admin — no run-tracking side effects. */
export async function runPipelinePhases(
  db: NodePgDatabase<typeof schema>,
  mode: PipelineMode,
): Promise<PipelineSummary> {
  const summary: PipelineSummary = {};
  if (mode === "full" || mode === "ingestion") {
    summary.ingestion = await runIngestion(db);
  }
  if (mode === "full" || mode === "enrichment") {
    // Epic 17 (ADR 0015): resolve the executor once and inject it into every
    // LLM step (uniform executor, no per-step mixing). `api` uses the paid API,
    // `claude-code` uses subscription quota via the local CLI — never both.
    const executor = getExecutor(resolveExecutionConfig(env()));
    summary.enrichment = await runEnrichment(db, executor);
    // Epic 10 (ADR 0011, Stage 1): Reel-Verifier critic pass runs right after
    // enrichment, on the same executor — gated to displayed reels
    // (quality_score >= QUALITY_THRESHOLD) not yet checked, sets reels.caveat
    // + caveat_checked_at. Its own runner never throws per-item, but guard
    // the call anyway (same never-abort-the-run contract as the other steps
    // here).
    try {
      summary.verifier = await runVerifier(db, executor);
    } catch (error) {
      console.error("[pipeline] verifier failed:", error);
    }
    // Epic 12 (ADR 0009): SkillTagger runs right after enrichment, on the
    // same executor — Match-or-Propose against the current active node
    // list, sets reels.skill or proposes a pending node. Also the backstop
    // for the on-save `tagSingle` path (src/app/experience/create/route.ts)
    // and for items unblocked by a newly-confirmed proposal (T12.6). Its own
    // runner never throws per-item, but guard the call anyway (same
    // never-abort-the-run contract as the feedback summary below).
    try {
      summary.skillTagging = await runSkillTagging(db, executor);
    } catch (error) {
      console.error("[pipeline] skill tagging failed:", error);
    }
    // Epic 15 (ADR 0013): topic clustering runs right after SkillTagger, on
    // the same executor — Match-or-Propose against the currently-active
    // cluster window, sets reels.topic_cluster_id + is_primary. Its own
    // runner never throws per-item, but guard the call anyway (same
    // never-abort-the-run contract as skill tagging/feedback below).
    try {
      summary.clustering = await runClustering(db, executor);
    } catch (error) {
      console.error("[pipeline] clustering failed:", error);
    }
    // Epic 11 (ADR 0012): Topic-Knowledge-Check runs right after clustering,
    // on the same executor — recomputes confidence for every active cluster
    // (cheap, grounded, no gating) and runs the gated freshness/supersession
    // LLM pass only for clusters with new members since their last check.
    // Its own runner never throws per-item, but guard the call anyway (same
    // never-abort-the-run contract as the other steps here).
    try {
      summary.knowledgeCheck = await runKnowledgeCheck(db, executor);
    } catch (error) {
      console.error("[pipeline] knowledge check failed:", error);
    }
    // T6.4: rolling feedback summary, right after enrichment/tagging. Never
    // aborts the run — a failure here is logged and simply skipped; the next
    // run retries (the "new since last summary" count only grows meanwhile).
    try {
      summary.feedback = await runFeedbackSummary(db, executor);
    } catch (error) {
      console.error("[pipeline] feedback summary failed:", error);
    }
  }
  return summary;
}

/** True if a non-stale run is currently marked `running`. */
export async function isRunInProgress(db: NodePgDatabase<typeof schema>): Promise<boolean> {
  const cutoff = new Date(Date.now() - STALE_RUN_MS);
  const rows = await db
    .select({ id: pipelineRuns.id })
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.status, "running"), gte(pipelineRuns.startedAt, cutoff)))
    .limit(1);
  return rows.length > 0;
}

/** Inserts a `running` row after guarding against a concurrent run. Returns the id.
 *  Throws PipelineBusyError if a run is already in progress. */
export async function beginRun(
  db: NodePgDatabase<typeof schema>,
  trigger: PipelineTrigger,
  mode: PipelineMode,
): Promise<number> {
  if (await isRunInProgress(db)) throw new PipelineBusyError();
  const [row] = await db
    .insert(pipelineRuns)
    .values({ trigger, mode, status: "running" })
    .returning({ id: pipelineRuns.id });
  return row.id;
}

/** Phase-runner signature — injectable so the tracking layer is testable without
 *  hitting the network / Claude API. */
export type PhaseRunner = (
  db: NodePgDatabase<typeof schema>,
  mode: PipelineMode,
) => Promise<PipelineSummary>;

/** Runs the phases for an already-created run row and finalizes it. Never throws —
 *  failures are recorded on the row (so it is safe to fire-and-forget). */
export async function runAndFinish(
  db: NodePgDatabase<typeof schema>,
  runId: number,
  mode: PipelineMode,
  phases: PhaseRunner = runPipelinePhases,
): Promise<void> {
  try {
    const summary = await phases(db, mode);
    await db
      .update(pipelineRuns)
      .set({ status: "success", finishedAt: new Date(), summary })
      .where(eq(pipelineRuns.id, runId));
  } catch (error) {
    await db
      .update(pipelineRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      })
      .where(eq(pipelineRuns.id, runId));
  }
}

/** Synchronous tracked run (used by the cron entrypoint): begin + run + finalize. */
export async function executeTrackedRun(
  db: NodePgDatabase<typeof schema>,
  opts: { trigger: PipelineTrigger; mode: PipelineMode },
  phases: PhaseRunner = runPipelinePhases,
): Promise<number> {
  const runId = await beginRun(db, opts.trigger, opts.mode);
  await runAndFinish(db, runId, opts.mode, phases);
  return runId;
}

export async function recentRuns(db: NodePgDatabase<typeof schema>, limit = 15) {
  return db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(limit);
}

/** T18.11 (§10.3): past this age, a successful run is "stale" — the app-bar
 *  freshness indicator escalates its salience (never to `--caution`; see
 *  `getFreshnessInfo` in `src/lib/freshness.ts` for the non-alarm-color
 *  treatment ADR 0016 requires). 36h matches the design doc's own example
 *  threshold. */
export const FRESHNESS_STALE_MS = 36 * 60 * 60_000;

/** The most recent run that actually finished successfully — the signal the
 *  §10.3 freshness indicator surfaces in the app bar. `lastPolledAt` (per
 *  source) exists too, but a successful pipeline run is a better proxy for
 *  "is the whole thing healthy", which is the actual question §10.3 asks:
 *  "if the pipeline fails for three days the feed just looks quiet." Returns
 *  `null` if no run has ever finished successfully (a distinct, honestly-
 *  labelled state from "ran a while ago" — see `getFreshnessInfo`). */
export async function getLatestSuccessfulRunFinishedAt(
  db: NodePgDatabase<typeof schema>,
): Promise<Date | null> {
  const rows = await db
    .select({ finishedAt: pipelineRuns.finishedAt })
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.status, "success"), isNotNull(pipelineRuns.finishedAt)))
    .orderBy(desc(pipelineRuns.finishedAt))
    .limit(1);
  return rows[0]?.finishedAt ?? null;
}
