# ADR 0010 — Admin console: manual pipeline trigger + shared-secret gate

- Status: accepted (autonomous session, user veto reserved)
- Date: 2026-07-22
- Touches: ADR 0002 (pipeline), ADR 0006 (always-on container)

## Context / Problem

The daily cron task should also be triggerable **manually via a button** from the app
(operator need). Two problems: (1) the task runs for minutes and calls the
Anthropic API (cost), (2) the app is reachable under a public URL — an
unprotected trigger would be a cost/abuse risk.

## Decision

1. **Reusable pipeline function:** the core is extracted as `runDailyPipeline(db,{mode})`
   in `src/lib/pipeline.ts`; cron (`jobs/daily.ts`) **and** the admin API call
   the same function — no logic duplication.
2. **Asynchronous run with status table:** `POST /api/admin/run` creates a
   `pipeline_runs` row (`running`), starts the pipeline **without await** (permitted in
   the always-on container, ADR 0006) and responds immediately with the run ID. At the
   end, `success`/`failed` + `summary` is written. A **"only one run at a time"
   guard** prevents overlap between button and cron runs.
3. **Shared-secret gate:** the entire admin area (`/admin/*`, `/api/admin/*`) is
   protected by `ADMIN_TOKEN` (env) (login → httpOnly cookie). **If `ADMIN_TOKEN`
   is not set, the admin area is disabled** (trigger API 503) — safe default,
   no open trigger on a public URL.

## Alternatives

- **Synchronous trigger** (route runs until finished): hanging request, timeout risk. Rejected.
- **No auth** (single-user assumption): unsafe, since the URL is public and LLM costs
  are incurred. Rejected.
- **Full auth system**: overkill for the MVP; the shared secret is the precursor to the
  team feed (V4).

## Consequences

- Cron runs also write to `pipeline_runs` → unified run history in the admin UI.
- New operational step: set `ADMIN_TOKEN` (otherwise admin is off); the **web service**
  now also needs `ANTHROPIC_API_KEY` (the pipeline runs there on button click).
- Raw job logs are not collected; the admin UI shows the structured `summary`.
- Stale-run detection (container restart mid-run) is time-based only in the MVP.
