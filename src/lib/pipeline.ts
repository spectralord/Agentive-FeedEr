import { and, desc, eq, gte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { pipelineRuns } from "@/db/schema";
import { runEnrichment, type EnrichmentResult } from "@/lib/enrichment/run";
import { runFeedbackSummary, type FeedbackSummaryResult } from "@/lib/feedback/run";
import { runIngestion, type IngestionResult } from "@/lib/ingestion/run";

export type PipelineMode = "full" | "ingestion" | "enrichment";
export type PipelineTrigger = "manual" | "cron";

export interface PipelineSummary {
  ingestion?: IngestionResult;
  enrichment?: EnrichmentResult;
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
    summary.enrichment = await runEnrichment(db);
    // T6.4: rolling feedback summary, right after enrichment. Never aborts
    // the run — a failure here is logged and simply skipped; the next run
    // retries (the "new since last summary" count only grows in the meantime).
    try {
      summary.feedback = await runFeedbackSummary(db);
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
