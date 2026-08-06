# ADR 0025 — A deferred task queue with typed handlers (PARKED — needs a grill)

- Status: **reopened** 2026-08-03 (was: rejected the same day). The owner named a use case the
  grill missed — running the app **from inside a Claude Code context**, where the executor cannot
  spawn a nested `claude` and there is therefore *no* synchronous path for the write-up button
  (ADR 0024) or writing assistance (ADR 0026). That is a second, already-shipped consumer, which
  the rejection's "one consumer, and it is unbuilt" argument does not cover. **Low priority**
  (owner's framing); needs a second grill. The original rejection's *findings* stand and are the
  starting point — only its conclusion is superseded. See "Reopened" below.
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

## Grill outcome (2026-08-03) — rejected, with the evidence

Each question below was answered against the live code and schema rather than argued in the
abstract. The answers are recorded inline. Summary of why they add up to a rejection:

1. **`pipeline_runs` already is most of this table.** Measured: 8 columns —
   `id, trigger, mode, status, started_at, finished_at, summary (jsonb), error`. It already has a
   status lifecycle, both timestamps, a structured result blob and an error field. `mode` is a
   fixed type column. A second table would duplicate ~80% of it for no capability gain.
2. **The dispatcher fights a pattern with ten call sites.** `StructuredCaller = callStructured`
   appears in **10 non-test modules** (enrichment, verifier, skilltagger ×2, clustering ×2,
   knowledge-check ×2, feedback, writeup). ADR 0015 deliberately chose *one executor, resolved
   once, injected everywhere*. A type-erased handler registry beside that is a second orchestration
   model to keep consistent forever.
3. **The list of genuinely async work is one item long, and it is unbuilt.** Epic 16 (nightly
   refactoring agent) is the only named case, and it is itself `PARKED — requires its own grill
   before implementation`. Everything else the queue was imagined for has since been answered elsewhere: write-up
   generation is synchronous and user-triggered (ADR 0024), and the daily pipeline already has its
   own trigger and run tracking.
4. **The poll/stale interaction is a real defect in the proposal, not a detail.** `STALE_RUN_MS` is
   **30 minutes** (`src/lib/pipeline.ts:31`) and the proposed poll was ~15 minutes — exactly half.
   A wedged run would be picked up twice before it is considered stale. Fixable, but it is
   complexity bought for one hypothetical consumer.
7. **It cannot serve the cloud profile anyway.** `PROFILE_DEFAULTS` pins `cloud` to
   `executor: "api"`, and a Claude Code consumer needs the local CLI — so the queue would be
   local-only by construction, the same limitation ADR 0024 decision 3 already documents.

**Decision: reject the generic substrate.** If Epic 16 is ever built, give it its own trigger — the
same shape `runAndFinish`/`beginRun` already provides for the daily job. *Two* cases make a pattern;
one makes a feature. This ADR's own "Provisional lean" said exactly that, and the evidence confirms
it rather than overturning it.

**What would reopen this:** a second genuine async case appearing (not a hypothetical), or Epic 16
turning out to need work that `pipeline_runs` + a trigger cannot express.

### Reopened 2026-08-03 (owner) — the nested-context case the rejection missed

The owner raised a case the grill did not consider, and it is real:

> *"0025 would still have merit, when I use the app in a context where I cannot trigger the executor
> because I'm in a Claude Code context."*

**Why this is a genuine second consumer, not a restatement of Epic 16.** The `claude-code` executor
works by **spawning `claude` as a subprocess** (`src/lib/executor/claudeCode.ts:24`,
`spawn("claude", ["-p", "--output-format", "json"])`). When the app is itself being driven from
inside a Claude Code session, that nesting is exactly what failed during Epic 19's implementation
on 2026-08-02: the nested CLI returned `Not logged in`, and no amount of fixing the app could have
helped, because the constraint is the nesting itself.

In that context there is **no synchronous path at all**. Every user-triggered LLM feature — the
write-up button (ADR 0024), writing assistance (ADR 0026) — is simply unavailable, and today it
fails at the point of use with an error. A queue changes the failure into a deferral: the app
**records the intent**, and the outer Claude Code session (which *is* authenticated) drains it.

This is materially different from Epic 16's case. Epic 16 wanted async because the work is *long*.
This wants async because the work is *impossible in-process from certain contexts* — a
capability gap, not a latency preference. The rejection's core argument ("one consumer, and it is
unbuilt") no longer holds: this consumer is **two shipped features**, in a context the owner
actually uses.

**Status: reopened, low priority (owner's own framing).** Not re-decided here — a second grill
should run when it comes up the queue. Three things that grill inherits:

1. The `pipeline_runs` overlap finding still stands and still argues for **extending that table**
   rather than adding a second one. The nested case wants a *pending work* row, which `mode` +
   `status` can nearly express already.
2. The dispatcher-vs-injected-executor tension (10 call sites) also still stands — but note this
   use case may not need a *typed handler registry* at all. "Re-run this one already-designed
   operation later" is much narrower than "arbitrary typed tasks", and the narrow version does not
   fight ADR 0015.
3. **Detecting the nested context is its own question.** The app currently discovers the problem by
   spawning and failing. Deciding *when* to enqueue rather than execute needs a signal — an env
   var, a probe, or an explicit mode — and that is likely the first thing the grill must settle.

**Correction to the record:** the rejection above was reasoned from the code but from an incomplete
set of use cases. It is left in place rather than deleted, because its findings about
`pipeline_runs`, the executor pattern and the poll interval remain accurate and are the starting
point for the re-grill — only its *conclusion* is superseded.

## Open questions — answered by the 2026-08-03 grill; kept for the record

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
