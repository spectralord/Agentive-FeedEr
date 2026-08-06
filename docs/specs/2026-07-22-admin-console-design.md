# Admin/operator console — design (self-grill)

- Date: 2026-07-22
- Status: for review / basis for Epic 13
- Related: ADR 0010, `docs/plan/epic-13-admin-console.md`
- Context: the user wants an admin view, among other things to run the cron task
  via a button, plus "other functions that make sense there". This session was
  carried out autonomously (the user is asleep) — decisions are documented here
  as a self-grill so they can be reviewed/vetoed tomorrow.

---

## Self-grill (question → answer, with alternatives)

**Q1 — How does a web button run the cron task, which can run for minutes?**
- (A) Synchronously in the API route, until done → the button "hangs" for minutes, proxy/browser timeout risk. Rejected.
- (B) **Start asynchronously, respond immediately**, track status via a `pipeline_runs` table; the admin page shows run status. **Chosen.** More robust, no hanging request, history included.
- Consequence: `pipeline_runs` table + a "only one run at a time" guard (prevents double/overlapping runs from the button and cron).

**Q2 — Is logic duplicated (cron vs. button)?**
- No. The core (`runIngestion` + `runEnrichment`) is extracted into **one
  reusable function `runDailyPipeline()`** (`src/lib/pipeline.ts`). Both
  `src/jobs/daily.ts` (cron) and the admin API call the same function. No
  second path, no divergence.

**Q3 — Security: the app is public (a railway.app URL). An open "run" button
can cause real Anthropic costs (LLM calls).**
- This is a real risk. The admin area **must** be protected.
- (A) Full auth system → overkill for the single-user MVP.
- (B) **Shared secret via an `ADMIN_TOKEN` env var** → login form sets an httpOnly cookie;
  admin pages + trigger API check it. **Chosen.** Fits the already-planned
  team-feed vision (V4, stage 1: shared secret).
- **Safe default:** if `ADMIN_TOKEN` is **not set**, the admin area is
  **disabled** (the page shows a notice, the trigger API responds 503). No
  unprotected trigger on a public URL.

**Q4 — What functions belong in the admin view besides "run"?**
Selected by value/effort (the operator needs of a single-user news tool):
- **Run the pipeline now** (full / ingestion only / enrichment only) — the core request.
- **Recent runs** (`pipeline_runs`): status, duration, ingestion counts per source,
  enrichment counts, errors. Exactly the view that shows "which source is 403ing".
- **System status**: DB reachable? `ANTHROPIC_API_KEY` set? Counts (raw_items,
  reels, unenriched, enrich_errors).
- **Source overview**: list with `enabled`, `last_polled_at`; enable/disable toggle.
- **Retry failed items**: reset `enrich_error` so the next run re-enriches them.
- Later (once the epics exist): buttons for SkillTagger (Epic 12),
  SOTA re-check (Epic 11), verifier (Epic 10) — the same "named task" mechanic.

**Q5 — MVP cut for tonight?**
- **Must (requested by the user):** "run pipeline now" button end-to-end,
  protected, async, with run status.
- **If time allows (bonus):** recent-runs list, system status/counts, source list.
- **Only planned (not today):** writable source toggle, error retry, task buttons
  for later epics.

---

## Data model

`pipeline_runs`:
- `id`, `trigger` (`manual` | `cron`), `mode` (`full` | `ingestion` | `enrichment`),
  `status` (`running` | `success` | `failed`), `started_at`, `finished_at` (nullable),
  `summary` JSONB (per-source ingestion + enrichment counts), `error` (nullable).
- "One run at a time" guard: a new run is only started if no `status='running'` row exists
  (or none younger than a stale timeout).

## Task execution
- `runDailyPipeline(db, { mode })` in `src/lib/pipeline.ts` — used by cron and admin.
- Admin API `POST /api/admin/run` (token-gated): creates a `pipeline_runs` row (`running`),
  starts `runDailyPipeline` **without awaiting** (fire-and-forget in the always-on container,
  ADR 0006), writes `success`/`failed` + `summary` at the end. Returns the run ID immediately.
- `src/jobs/daily.ts` also writes a `pipeline_runs` row (`trigger='cron'`),
  so cron runs show up in the admin history.

## Auth (shared secret)
- Env `ADMIN_TOKEN` (optional). Unset ⇒ admin disabled (503/notice).
- `/admin/login`: form takes a token, compares it (constant-time) against `ADMIN_TOKEN`,
  sets an httpOnly cookie `admin_session` (value = hash/HMAC of the token, not the token itself).
- All `/admin/*` pages + `/api/admin/*` routes check the cookie. No cookie ⇒ redirect
  to login or 401.

## UI
- `/admin` (protected): status tiles (DB, key, counts) · "run pipeline" buttons
  (full/ingestion/enrichment) with a live run indicator · a "recent runs" table.
- Nav entry "Admin" kept subtle (on the right). `force-dynamic`.

## Operations / user actions
- **Set `ADMIN_TOKEN` in Railway** (web service), otherwise admin stays off.
- The web service needs **`ANTHROPIC_API_KEY`** (for the run button), since the pipeline
  runs there — add it as a reference to the project shared variable.

## Open points
- Showing real job logs (stdout) in the admin UI would be nice, but is expensive
  without a log collector — the MVP shows the structured `summary` instead of raw logs.
- Stale-run detection (container restart mid-run) — a simple time bound in the MVP.
