# Epic 13 — Admin/operator console (Fast-Follow)

**Goal:** A protected admin view in the app to manually trigger backend tasks
(especially the cron task) and see system state.

**References:** ADR 0010, `docs/specs/2026-07-22-admin-console-design.md`, ADR 0002/0006.

> **Must** (user request): "Run pipeline now" button end-to-end, protected,
> async, with run status (T13.1–T13.5). **Bonus** if time allows: T13.6–T13.7.

---

## Tasks

### ☑ T13.1 — Env: `ADMIN_TOKEN`
- `src/lib/env.ts`: `ADMIN_TOKEN` optional (no default). Unset ⇒ admin disabled.
- Add to `.env.example`. **Verification:** env test (set/unset).

### ☑ T13.2 — Schema: `pipeline_runs`
```ts
export const pipelineRuns = pgTable("pipeline_runs", {
  id: serial("id").primaryKey(),
  trigger: text("trigger", { enum: ["manual", "cron"] }).notNull(),
  mode: text("mode", { enum: ["full", "ingestion", "enrichment"] }).notNull(),
  status: text("status", { enum: ["running", "success", "failed"] }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  summary: jsonb("summary"),
  error: text("error"),
});
```
- Migration. **Verification:** migration green.

### ☑ T13.3 — Pipeline refactor (`src/lib/pipeline.ts`)
- `runDailyPipeline(db, { mode }): Promise<PipelineSummary>` — encapsulates
  `runIngestion` and/or `runEnrichment` depending on `mode`; returns a structured summary.
- Switch `src/jobs/daily.ts` to `runDailyPipeline(db,{mode:'full'})` and additionally write
  a `pipeline_runs` row (`trigger:'cron'`) (running→success/failed).
- **Verification:** existing ingestion/enrichment integration tests stay green; new
  test for `runDailyPipeline` (mode variants with a mocked enrichment caller).

### ☑ T13.4 — Auth gate (`src/lib/admin/auth.ts` + `/admin/login`)
- Constant-time token comparison; httpOnly cookie `admin_session` = HMAC(token) (not the
  token itself). Helper `requireAdmin()` for pages/routes.
- `ADMIN_TOKEN` unset ⇒ login shows "Admin disabled".
- **Verification:** unit tests: wrong token rejected, correct one accepted, cookie check.

### ☑ T13.5 — Trigger API + admin page (core)
- `POST /api/admin/run` (token-gated): body `{ mode }`; guard "no run currently running";
  creates a `running` row, starts `runDailyPipeline` **without awaiting**, writes the
  result at the end; responds immediately with `{ runId }`. Unset `ADMIN_TOKEN` ⇒ 503.
- `/admin` (protected, `force-dynamic`): buttons "Run full / ingestion only /
  enrichment only" (POST to the API), display of the currently running run + auto/manual refresh.
- Nav entry "Admin".
- **Verification:** curl with/without token (401/503 vs. 200); a manual run creates a
  `pipeline_runs` row and fills (locally) reels; double-click doesn't start a second run.

### ☑ T13.6 — Bonus: recent runs + system status
- Table of the most recent `pipeline_runs` (status, duration, ingestion counts per source,
  enrichment counts, errors). Status tiles: DB ok, `ANTHROPIC_API_KEY` set?, counts
  (raw_items, reels, unenriched, enrich_errors).
- **Verification:** curl shows runs + counts.

### ☑ T13.7 — Bonus: source list (read-only) + error retry
- Sources with `enabled`/`last_polled_at`. Action "reset enrich_error" (items become
  re-enrichable). (Writable source toggle = later.)
- **Verification:** retry sets `enrich_error=null`; source list renders.

---

## Completion criteria (epic DoD)
- Protected admin area; "run pipeline" button triggers the task async and shows
  status; cron and button runs share `runDailyPipeline` and the `pipeline_runs` history;
  unset `ADMIN_TOKEN` safely disables the area. Build + tests green.

## User actions (Railway)
- Set `ADMIN_TOKEN` on the web service (otherwise admin stays off).
- Make `ANTHROPIC_API_KEY` available on the **web service** (reference to the
  project shared var), since the button runs the pipeline in the web container.

## Deviations/Questions
- **Implemented: T13.1–T13.7** (the user-requested core + both bonus tasks).
- **T13.7:** data access in `src/lib/admin/sources.ts` (`listSourcesWithErrorCounts`,
  `resetEnrichErrors`), same pattern as `recentRuns` in `src/lib/pipeline.ts`. Retry route
  `POST /api/admin/sources/[id]/retry` follows exactly the guard/POST/redirect pattern of
  `/api/admin/run`. The error count per source is a single grouped query
  (`GROUP BY source_id` over `raw_items` with `enrich_error IS NOT NULL`), since it's
  admin-only/low-traffic. `resetEnrichErrors` deliberately sets only `enrich_error = NULL`
  (not `enriched_at`) — `runEnrichment` (`src/lib/enrichment/run.ts`) selects rows with
  `enriched_at IS NULL AND enrich_error IS NULL`, so this is enough to pick them up again
  on the next run. Verification via dev build (`npm run start`) + curl: sources section
  renders name/type/enabled/last-polled/error count; retry POST returns 303 with
  `?retried=<n>`, DB check confirms `enrich_error IS NULL`; unauthorized POST → 401.
  Integration test `src/lib/admin/sources.integration.test.ts` (5 tests) covers listing and
  retry isolation between sources.
- **Additionally (review finding, not part of T13.7):** `runSummary()` in `src/app/admin/page.tsx`
  didn't display `clustering` (Epic 15) and `knowledgeCheck` (Epic 11) from `PipelineSummary`,
  even though both fields have existed for a while. Added (own `fix` commit, not part of the
  T13.7 commit).
- **Pipeline API slightly different from the sketch:** instead of a single `runDailyPipeline`,
  `src/lib/pipeline.ts` was split into `runPipelinePhases` (pure phase runner),
  `beginRun`/`runAndFinish` (tracking + guard), and `executeTrackedRun` (cron). Reason:
  the admin button must return the run ID **immediately** and let execution run
  fire-and-forget — that requires separating "create the row" from "execute". `PhaseRunner`
  is injectable → the tracking layer is testable without network/Claude.
- **Robustness fix (root cause of the cron crash):** `ANTHROPIC_API_KEY` as an **empty
  string** is now treated as "not set" in `env.ts` (`z.preprocess`), so that an
  incorrectly resolved Railway shared-var reference no longer crashes the process at boot.
  Same pattern for `ADMIN_TOKEN`.
- **Cookie `secure`** is tied to `NODE_ENV === "production"` (active on Railway/https,
  off locally over http) — otherwise the curl verification over http wouldn't be possible.
- **Verification** via dev server + curl (as in Epics 3–5/9): auth redirect, wrong/correct
  token, cookie, run trigger (401 without cookie, 303 with, busy guard on 2nd click), created
  `pipeline_runs` row with real +20 items (GitHub feeds in the sandbox), safe default
  (without `ADMIN_TOKEN`: 503 + "disabled" + redirect). 128/128 tests green, build green,
  all `/admin` and `/api/admin/*` routes dynamic.
- **User action open:** set `ADMIN_TOKEN` on the web service in Railway (otherwise
  admin stays safely disabled). `ANTHROPIC_API_KEY` on the web service was already added via
  `${{shared.ANTHROPIC_API_KEY}}` (for the button's enrichment run).
