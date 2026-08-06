# Epic 17 — Execution modes (trigger × executor, Claude Code quota)

> **Status: IN PROGRESS (2026-07-23, ADR 0015; updated 2026-07-24).**
> T17.1–T17.5 + T17.7 done & tested (executor seam, profiles/validation,
> `ClaudeCodeExecutor`, `job:cc`, error handling; since Epic 12/15/11,
> SkillTagger, clustering, and the knowledge-check freshness pass also run
> through the same injected executor — T17.5 thereby fully done rather than
> only partially done).
> **T17.6 open** (CC routine scheduler = pure infra, not end-to-end testable
> in this environment). Promoted from `future-todos.md` T6.

**Goal:** Let the pipeline's LLM work run either via the **API**
(`ANTHROPIC_API_KEY`, costs money) or via **Claude Code quota** (agent turn,
cost-neutral), plus a local mode that **never** interacts with Railway/the API.
Two independent axes (trigger × executor) via profiles.

**References:** ADR 0015 (core), ADR 0003 (schema discipline/"null instead of
hallucination"), ADR 0002 (decoupled ingestion/enrichment), ADR 0010 (manual
trigger). Glossary candidates: executor, trigger, profile.

---

## Tasks

### ✅ T17.1 — Formalize the executor seam
- Turn the existing `StructuredCaller` interface into an explicit **`Executor`**; make
  sure **all** LLM steps (enrichment, SkillTagger, clustering, knowledge check,
  feedback summary) get it injected (some already do today). One place that
  constructs the executor per run.
- **Verification:** all call sites obtain the executor via injection; existing tests green.

### ✅ T17.2 — `env.ts`: profiles + axes + validation
- `APP_PROFILE=local|cloud` (default `cloud`) sets defaults; overrides:
  `PIPELINE_EXECUTOR=api|claude-code`, `PIPELINE_TRIGGER=railway-cron|claude-code-cron|manual`.
- **Validation (zod, in `env.ts`):** reject the illegal combination `railway-cron`+`claude-code`;
  `local` forces `executor=claude-code` + local DB + **no** required `ANTHROPIC_API_KEY`;
  the `api` executor requires a key.
- **Verification:** unit tests of profile resolution (every row of the ADR matrix), illegal
  combination throws.

### ✅ T17.3 — `ClaudeCodeExecutor` (per-item via the `claude` CLI; see deviation)
- New `Executor` implementation: processes a **batch** of unenriched items in one
  agent turn; provides a local tool **`emit_reel(reel)`** that **validates via zod
  and writes server-side** (discardable per item; `null` instead of hallucination, ADR 0003).
- **No API call** in this path; no silent fallback. Errors are isolated per item; the
  batch keeps going.
- **Verification:** test with a simulated agent that emits a valid/invalid item →
  valid one written, invalid one discarded; no API client instantiated.

### ✅ T17.4 — Local job entry point (`npm run job:cc`)
- Entry point that, in the `local` profile, runs the pipeline against the **local DB**
  through the `ClaudeCodeExecutor` — no Railway, no API. Ingestion (no LLM) unchanged.
- **Verification:** a run against the local DB with no `ANTHROPIC_API_KEY` set produces reels;
  network assertion: no Anthropic API call.

### ☑ T17.5 — Roll out enrichment-first, then the remaining steps
- First only enrichment via the chosen executor; afterward SkillTagger/clustering/
  knowledge check/feedback through the same seam (each with its own `emit_*` tool or reuse).
- **Verification:** enrichment green in CC mode; steps caught up individually, tests green.
- **Done (2026-07-24):** with Epic 12 (SkillTagger), 15 (clustering), and 11 T11.1–T11.6
  (knowledge-check freshness pass), all LLM pipeline steps (enrichment, SkillTagger,
  clustering, knowledge check, feedback summary) are wired through the same executor
  resolved in `pipeline.ts` (`getExecutor(resolveExecutionConfig(env()))`) — no step
  calls `callStructured`/the API directly. Thereby fully done rather than partially done.

### ☐ T17.6 — Scheduler: Claude Code routine (`claude-code-cron`)
- For the cloud case "Claude Code Cron"/"Claude Code API": a scheduled **Claude Code
  routine** that fires a session with the job prompt (against the Railway DB, F1 direct
  access). Document setup (routine/`create_trigger`, env needed in the CC environment).
- **Verification:** a manual test run of the routine produces reels in the target DB; docs present.

### ✅ T17.7 — Error handling/notification for scheduled CC runs
- What happens if a scheduled CC run fails (no silent API fallback!): mark the run as
  `failed` in `pipeline_runs` (ADR 0010) + optional notification. Conservative.
- **Verification:** simulated failure → `pipeline_runs.status=failed`, no API catch-up.

---

## Configuration (new env vars, in `env.ts` + `.env.example` + README §4)
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `APP_PROFILE` | no | `cloud` | `local` (CC + local DB, never Railway/API) or `cloud` |
| `PIPELINE_EXECUTOR` | no | profile-dependent | `api` \| `claude-code` (override) |
| `PIPELINE_TRIGGER` | no | profile-dependent | `railway-cron` \| `claude-code-cron` \| `manual` |

## Completion criteria (epic DoD)
- Executor selectable via profile/override; `local` demonstrably runs **without** API/Railway;
  illegal combination is rejected; `ClaudeCodeExecutor` upholds the ADR-0003 guarantee via the
  `emit` tool; enrichment-first green, remaining steps caught up; `npm run build` + `npm test`
  green; no new libs; no ADR violation.

## Deviations/Questions
- **T17.3 per-item CLI instead of batch+`emit_reel` tool (deliberate).** The
  `ClaudeCodeExecutor` makes **one** headless `claude` CLI call per item (`claude -p
  --output-format json`), which uses the subscription **quota**; the response is parsed
  leniently as JSON and **zod-validated** by the caller (ADR 0003 "null instead of
  hallucination" upheld). This fits exactly into the existing per-item `StructuredCaller`
  seam (same validation/isolation) and is robustly unit-testable (injectable runner). The
  **agent-batch + `emit_reel` tool** described in ADR 0015 (F3=C) remains a later
  **optimization** (ADR 0015 explicitly named per-item as fallback A/B). No API access, no
  silent fallback.
- **T17.5 completed retroactively (2026-07-24):** Epics 12 (SkillTagger), 15
  (clustering), and 11 T11.1–T11.6 (knowledge check) have since been built and all run
  through the same injected executor (see `runPipelinePhases` in `src/lib/pipeline.ts`) —
  the uniform executor injection took effect automatically as expected, without T17.5
  itself needing to be touched again.
- **T17.6 open (infra).** The Claude Code routine scheduler (`claude-code-cron` against
  the Railway DB) is setup/infra and not end-to-end verifiable in this environment; build +
  docs later (shares mechanics with Epic 16 refactoring agent).
- **Runtime precondition:** the `claude-code` executor assumes the `claude` CLI is
  available + logged in in the execution environment (given in the local profile).
