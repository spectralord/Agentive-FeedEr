// Integration test against local Postgres: the run-tracking layer (guard, status
// transitions, summary recording) with an injected phase-runner so no network /
// Claude API is touched.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db, getPool } from "@/db/client";
import { pipelineRuns } from "@/db/schema";
import {
  beginRun,
  executeTrackedRun,
  isRunInProgress,
  PipelineBusyError,
  runAndFinish,
  type PhaseRunner,
} from "./pipeline";

const fakeSummary = { ingestion: { perSource: [], totalInserted: 3 } };
const okPhases: PhaseRunner = async () => fakeSummary;
const failPhases: PhaseRunner = async () => {
  throw new Error("boom");
};

describe("pipeline run tracking (integration)", () => {
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE pipeline_runs RESTART IDENTITY`);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("beginRun guards against a concurrent run", async () => {
    await beginRun(db(), "manual", "full");
    expect(await isRunInProgress(db())).toBe(true);
    await expect(beginRun(db(), "cron", "full")).rejects.toBeInstanceOf(PipelineBusyError);
  });

  it("executeTrackedRun records success + summary", async () => {
    const runId = await executeTrackedRun(db(), { trigger: "manual", mode: "ingestion" }, okPhases);
    const [run] = await db().select().from(pipelineRuns);
    expect(run.id).toBe(runId);
    expect(run.status).toBe("success");
    expect(run.finishedAt).not.toBeNull();
    expect(run.summary).toEqual(fakeSummary);
    // After success, a new run is allowed again.
    expect(await isRunInProgress(db())).toBe(false);
  });

  it("records failure without throwing (safe to fire-and-forget)", async () => {
    const runId = await beginRun(db(), "manual", "full");
    await runAndFinish(db(), runId, "full", failPhases); // must not throw
    const [run] = await db().select().from(pipelineRuns);
    expect(run.status).toBe("failed");
    expect(run.error).toContain("boom");
    expect(await isRunInProgress(db())).toBe(false);
  });

  it("phase runner receives the requested mode", async () => {
    const spy = vi.fn<PhaseRunner>().mockResolvedValue({});
    await executeTrackedRun(db(), { trigger: "cron", mode: "enrichment" }, spy);
    expect(spy).toHaveBeenCalledWith(db(), "enrichment");
  });
});
