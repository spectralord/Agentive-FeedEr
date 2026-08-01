# ADR 0025 — A deferred task queue with typed handlers (PARKED — needs a grill)

- Status: **proposed** — *parked deliberately.* Needs a strong-model grill before any code.
  **Do not build on the strength of this file.** It exists to stop the idea being re-derived from
  scratch, and to record the questions that must be answered first.
- Date: 2026-08-01
- Origin: owner's proposal, 2026-08-01, offered as a *fallback* in case the app could not trigger
  the Claude Code subscription directly. It can (**ADR 0024** decision 2), so the fallback was not
  needed for that case — but the general idea was judged worth keeping as its own decision rather
  than discarded.
- Related: ADR 0015 (execution model — the ADR this one is in tension with), ADR 0010 (admin manual
  trigger), ADR 0024 (on-demand write-up, the case that did *not* need this),
  Epic 16 (nightly refactoring agent — shares the "Claude Code routine" mechanic),
  `future-todos.md` T6
- Related epics: 16 (parked), 17 (execution modes, partially built)

## The idea, as proposed

A `tasks` table holding units of work the app wants done but does not want to do inline, each with
a **type**; a registry of **typed handlers** in the codebase, one per task type; and a **Claude
Code schedule running every ~15 minutes** that polls for new tasks, runs the matching handler, and
marks them done. Write-up generation would have been the first handler; Epic 16's nightly
refactoring pass is an obvious second.

The motivation is real: some work should not block an HTTP request, and some work wants to run on
subscription quota on a cadence rather than on a click.

## Why this is not built yet

**It was not needed for the case that prompted it.** ADR 0024 showed the app can invoke `claude`
synchronously through the existing executor, so the write-up button needs no queue, no poller, and
no handler registry — a route that shells out is simpler than a queue plus a scheduled consumer.
Building the substrate first would have committed the project to a pattern before any case proved
it necessary.

**It is in real tension with ADR 0015 (binding).** That ADR deliberately chose *one executor,
resolved once in `pipeline.ts`, injected into every step* over a dispatcher. A handler registry
keyed by task type is a second orchestration pattern sitting beside that one. That may well be
justified — but "may well be" is exactly the standard the ADR threshold in CLAUDE.md says requires
a grill, not a judgement call in passing.

## Open questions — all must be answered before building

1. **What does this do that `pipeline_runs` does not?** The table already exists with
   `trigger` (`manual`/`cron`), `mode`, `status` (`running`/`success`/`failed`), `startedAt`,
   `finishedAt`, `summary` jsonb, and `error`. That is most of a task table with a fixed type
   column called `mode`. The honest options are: **extend `pipeline_runs`** (add task types to
   `mode`, or a nullable payload), or **add a second table** and accept two overlapping records of
   "work the system did". Which, and why? A new table that duplicates 80% of an existing one is a
   cost, not a feature.

2. **Why a dispatcher when ADR 0015 chose injection?** State the case for a handler registry
   explicitly against ADR 0015's reasoning. If the answer is "so a scheduled consumer can run
   heterogeneous work without knowing what it is", say so and accept the consequence: type-erased
   dispatch loses the compile-time wiring that ADR 0015's injected-executor pattern gives for free.

3. **What work genuinely needs to be asynchronous?** Enumerate real cases, not hypotheticals.
   Candidates: Epic 16's nightly refactoring pass (long, no user waiting); a full re-enrichment
   over the whole corpus; retrying a failed source. Non-candidates as of today: write-up generation
   (ADR 0024), the daily pipeline (already has its own trigger + run tracking). **If the list is
   one item, this ADR should be that item's design instead of a generic queue.**

4. **How does a 15-minute poll interact with the existing concurrency guard?** `beginRun` throws
   `PipelineBusyError` when a run is in progress, with a `STALE_RUN_MS` (30 min) escape for
   crashed runs. A poller firing every 15 minutes into that guard needs defined behaviour: skip,
   queue-and-retry, or run in parallel with a separate lock? Note the poll interval is **half** the
   stale threshold, so a wedged task could be picked up twice before it is considered stale.

5. **Who runs the poller, and what happens when it is not running?** A Claude Code scheduled task
   lives outside the app; if the laptop is asleep, tasks accumulate silently. Is a visible backlog
   (admin surface) required? Does anything expire?

6. **Failure, retry, and idempotency semantics.** Max attempts? Backoff? Are handlers required to
   be idempotent (the pipeline steps already are, per-item try/catch that never aborts a run), and
   what happens to a task that fails permanently — dead-letter, or a `failed` row nobody reads?

7. **Does this need to survive `APP_PROFILE=cloud`?** The Claude Code consumer cannot run on
   Railway (same constraint as ADR 0024 decision 3). Is this local-only by design, or does the
   cloud profile get a different consumer?

## Provisional lean (not a decision)

If the answer to Q3 is "Epic 16's nightly pass, and nothing else yet", the cheaper path is to give
Epic 16 its own trigger and skip the generic substrate entirely — then revisit when a second
genuine async case appears. Two cases make a pattern; one makes a feature.

## Consequences (if built)

- Schema change (new table, or an extension of `pipeline_runs`) + migration.
- A handler registry and a consumer entry point runnable headless by a Claude Code schedule.
- Admin visibility for the backlog, otherwise failures are invisible.
- A second orchestration path to keep consistent with `pipeline.ts` forever after.
