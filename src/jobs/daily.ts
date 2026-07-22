// Daily pipeline entrypoint — run via `npm run job:daily` (Railway cron or locally).
// Runs the same tracked pipeline the admin console triggers (ADR 0010): ingestion
// (cheap, no AI) then enrichment (Claude). The run is recorded in pipeline_runs.
import { db, getPool } from "@/db/client";
import { executeTrackedRun, PipelineBusyError } from "@/lib/pipeline";
import { pipelineRuns } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main(): Promise<number> {
  console.log(`[daily] starting at ${new Date().toISOString()}`);

  let runId: number;
  try {
    runId = await executeTrackedRun(db(), { trigger: "cron", mode: "full" });
  } catch (error) {
    if (error instanceof PipelineBusyError) {
      console.log("[daily] skipped: a pipeline run is already in progress.");
      return 0;
    }
    throw error;
  }

  const [run] = await db().select().from(pipelineRuns).where(eq(pipelineRuns.id, runId));
  const summary = (run?.summary ?? {}) as {
    ingestion?: { perSource: { name: string; fetched: number; inserted: number; error?: string }[]; totalInserted: number };
    enrichment?: { processed: number; succeeded: number; failed: number };
  };

  if (summary.ingestion) {
    for (const s of summary.ingestion.perSource) {
      const status = s.error ? `ERROR: ${s.error}` : `fetched ${s.fetched}, inserted ${s.inserted}`;
      console.log(`[ingestion] ${s.name}: ${status}`);
    }
    console.log(`[ingestion] total inserted: ${summary.ingestion.totalInserted}`);
  }
  if (summary.enrichment) {
    const e = summary.enrichment;
    console.log(`[enrichment] processed ${e.processed}, succeeded ${e.succeeded}, failed ${e.failed}`);
  }

  if (run?.status === "failed") {
    console.error(`[daily] run ${runId} failed: ${run.error}`);
    return 1;
  }
  console.log(`[daily] run ${runId} ${run?.status}`);
  return 0;
}

main()
  .then(async (code) => {
    await getPool().end();
    process.exit(code);
  })
  .catch(async (error) => {
    console.error("[daily] fatal:", error);
    await getPool().end();
    process.exit(1);
  });
