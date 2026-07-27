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
  getLatestSuccessfulRunFinishedAt,
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

  // T18.11 (§10.3): the app-bar freshness indicator's data source. Nested in
  // this same describe (not a second top-level one) so it shares the
  // existing beforeEach truncation and the single `afterAll(pool.end)` —
  // two top-level describes each ending the pool would error on whichever
  // one runs second.
  describe("getLatestSuccessfulRunFinishedAt", () => {
    it("is null when no run has ever finished", async () => {
      expect(await getLatestSuccessfulRunFinishedAt(db())).toBeNull();
    });

    it("ignores a still-running or failed run", async () => {
      const runId = await beginRun(db(), "manual", "full"); // "running", no finishedAt
      expect(await getLatestSuccessfulRunFinishedAt(db())).toBeNull();
      await runAndFinish(db(), runId, "full", failPhases); // finalizes the same row as "failed"
      expect(await getLatestSuccessfulRunFinishedAt(db())).toBeNull();
    });

    it("returns the most recent successful run's finishedAt, not an older one", async () => {
      await executeTrackedRun(db(), { trigger: "manual", mode: "ingestion" }, okPhases);
      const beforeSecond = new Date();
      await new Promise((r) => setTimeout(r, 5));
      await executeTrackedRun(db(), { trigger: "manual", mode: "ingestion" }, okPhases);

      const finishedAt = await getLatestSuccessfulRunFinishedAt(db());
      expect(finishedAt).not.toBeNull();
      expect(finishedAt!.getTime()).toBeGreaterThan(beforeSecond.getTime());
    });
  });
});
