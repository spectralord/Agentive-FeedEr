# Future TODOs / ideas (raw, to be picked up later)

Thoughts parked by the user (2026-07-23). Not grilled yet — a short design/grill
conversation before implementation in each case.

## T1 — Two levels of detail per content item (compact → expanded)
The feed stays, as now, the *summarized* mode. But a reel should be **clickable**
and then show a **better worked-out, deeper summary** (detail view).
- Related to, but not identical with, Epic 8 (agentic "deepening"): here it's initially
  about an *existing* deeper write-up on click, not live research.
- Conceivable: enrichment produces two tiers (compact + detailed), or the detail level
  is loaded on demand.

## T2 — Rework actionables / "to-try" prompts
> **PICKED UP 2026-08-01 → ADR 0019 (accepted).** `reels.action` is promoted to a
> checkable actionable, two-track progress (declared/evidenced) with no gating, `effort_tag`
> becomes functional (filter "5-minute win"). The core noted here — "the prompts are
> too weak" — is thereby *structurally* addressed (checkable + rolls up to the skill node);
> the *wording quality* of the generated `action` texts remains a separate prompt question.
The current action/TODO prompts (`action`/`effort_tag`) are still **too weak**.
Rework when there's a chance — more concrete, more motivating, a clearer incentive to try it.
Connected to the actionable concept (Epic 6/7 revision).

## T3 — Switch to English (chat + the entire app)
Eventually switch **chat and all app content/UI to English**. This then also affects
`CLAUDE.md` (language convention "UI/docs German" → English) and all existing
UI strings. A deliberate, one-time switch — only on explicit go-ahead.

## T4 — Design/UX expert agent (own session) + handoff prompt
Design/UX is currently thin. Goal: Claude builds a **comprehensive prompt** that the
user gives to a **further session**; that session acts as a **design expert**, looks at
the project, and works out concrete, actionable design proposals with a
**gamifying + good-UX mindset**. (Deliverable: the handoff prompt.)
> **Update 2026-07-23:** handoff prompt **delivered** →
> `docs/specs/design-expert-handoff-prompt.md` (leitmotif: look-and-feel and gamification
> on equal footing). All that's left open is for the user to start the design session with it.

## T5 — Persona agent "developer's view of the value" (future music)
Later, a session that evaluates the **generated content from a developer's perspective**:
how much real value/experience does a developer actually get out of it? Well suited to a
**persona agent**. Deliberately future music.

## T6 — Second execution mode: pipeline via Claude Code quota instead of an API key
> **Promoted 2026-07-23:** grilled (F1–F5 below) → **ADR 0015** + **Epic 17**
> (`epic-17-execution-modes.md`). Build only on user go-ahead.
**Motive:** the daily task today calls the LLM work (enrichment/summaries etc.) via the
**Anthropic API** (`ANTHROPIC_API_KEY`) → consumes **API tokens (money)**. If there is
still **Claude Code quota** (subscription) left, the same work should run through that
instead — and one should be able to **switch** *how* the run is executed.

**Core idea:** two execution modes behind a switch (e.g. `PIPELINE_EXECUTOR=api|claude-code`):
- **`api` (today):** Railway cron calls the app, which calls the API with the key via the SDK.
- **`claude-code` (new):** A **Claude Code scheduled task/routine** fires a session that
  kicks off the pipeline run.

**Important technical catch (for the grill):** for this to actually consume **quota
instead of API tokens**, the **inference must happen inside the Claude Code agent turn**
(the agent reads the raw items and produces the structured summaries itself, writes them
to the DB) — a mere routine that triggers the app, which *then* calls the API, saves
**nothing**. That's a different execution path than the deterministic, tool-use-structured
enrichment (ADR 0003).
- **Seam:** the existing **`StructuredCaller` interface** (enrichment/SkillTagger/…) is
  the point of attachment — a second, "agent-driven" implementation behind it.
- **Trade-offs to grill:** consistency/quality (agent free text vs. enforced JSON schema +
  zod validation), idempotency/error tolerance per item, cadence/scheduling (Railway cron vs.
  Claude Code routine), how "null instead of hallucination" (ADR 0003) is guaranteed in agent
  mode, and whether only *parts* (e.g. enrichment) or the whole pipeline get switched over.
- **Likely outcome:** its own ADR (execution model) + env switch + second
  `StructuredCaller` implementation. **Grill before building** (a genuine architectural fork).

### Grill protocol (in progress, 2026-07-23)
- **F1 — data path in `claude-code` mode → DECIDED: A (direct DB access).** The
  CC session uses the same Drizzle layer as the app (reads `raw_items`, writes `reels`),
  same idempotency/validation — no zoo of endpoints. For a single-user tool, the simplest,
  most robust way.

- **F2 — profile structure → DECIDED: C (profile with defaults + override).** An
  `APP_PROFILE=local|cloud` sets sensible defaults (local→Claude Code + local DB;
  cloud→API + Railway), individual axes (especially the executor) are overridable via env
  (⇒ cloud+Claude Code also possible). Not the full 2×2 combinatorics as the normal case.
- **F3 — schema discipline/granularity → DECIDED: C (agent batch + enforced tool use).**
  The agent processes a batch in one turn, but calls a local tool **`emit_reel(reel)`
  per item**, which **validates via zod server-side + writes** — schema enforcement in the
  tool, per-item validation/isolation (ADR 0003 upheld) at batch efficiency. Mirrors today's
  "forced tool_choice" discipline. Fallback on setup problems: (A) agent batch → script
  validates the array.
- **F4 — scope → DECIDED: B (uniform executor, built incrementally).** An executor, once
  chosen, is injected at **all** `StructuredCaller` call sites (enrichment,
  SkillTagger, clustering, knowledge check, feedback summary) → a uniform run, no
  mixing. Build order: enrichment-first as the first slice. **Hard guardrail:** in
  Claude Code/local mode, **zero** API calls run, and there is **no silent API fallback**
  (otherwise costs would arise). If the CC path is missing/fails, it gets **aborted/skipped**,
  never caught up via the API. `ANTHROPIC_API_KEY` may be unset in local mode.
- **F5 — trigger/scheduling → DECIDED: two independent axes + a profile matrix.**
  - **Axis 1 trigger:** `railway-cron` | `claude-code-cron` | `manual/local`.
  - **Axis 2 executor:** `api` | `claude-code` (see F4).
  - **local:** trigger manual/local, executor `claude-code`, DB local — **never Railway, never
    API** (hard-walled off).
  - **cloud** (DB=Railway), three usable combos:
    - "Cloud" = `railway-cron` + `api` (status quo).
    - "Claude Code Cron" = `claude-code-cron` + `claude-code` (quota, no API).
    - "Claude Code API" = `claude-code-cron` + `api` (CC schedules, API infers).
  - **Excluded:** `railway-cron` + `claude-code` (Railway can't use CC quota).

### Extension (user, 2026-07-23): two **environment profiles**, local ↔ cloud
The switch is actually **two-dimensional** — environment *and* inference:
- **Environment:** **`local`** (own machine, **local DB**, execution in Claude Code) vs.
  **`cloud`** (Railway + cloud DB).
- **Inference:** **`api`** (Anthropic key) vs. **`claude-code`** (quota).
- **Coupling/motive:** **`local` ⇒ Claude Code + local DB** — saves *both* Railway *and*
  API costs (development/use on one's own machine). **`cloud`** is mainly interesting for
  **tablet use** (no own machine at hand); there too, an `api`-vs-`claude-code` distinction
  is desired. Goal: make our tools/services startable **once "local" and once "cloud"**.
- **Consequences for the build:** not just one `PIPELINE_EXECUTOR` flag, but **environment
  profiles** (DB target + executor + scheduling bundled), e.g. `APP_PROFILE=local|cloud` with
  sensible defaults (`local`→`claude-code`+local DB; `cloud`→today `api`+Railway, optionally
  `claude-code`). Local startup path without Railway (own `npm` command / Claude Code routine
  against the local DB).

## T7 — Curator / user system with trust-weighted evaluation
> Parked by the user on 2026-07-24, during the T11.7 grill (reports ↔ topic clusters).
> Needs its own grill before any build. New docs are English per README §2.

**Motive:** colleagues should be able to act as **curators** — curating Reels and posting
Experience Reports — and content from a known, trusted curator should carry a **markedly
higher evaluation** than content the system fished off the web by itself.

**The distinction that drives this:** a "report from the web" and a "report added by a known
person" are fundamentally different trust objects, even though both are Experience Reports
today. The existing `author_type` enum already encodes the two ends:
- `curated` — **AI-fished** from a public source (Reddit/comment threads). Low trust; the
  author is a handle, not a person we know. *(Beware the naming trap: `curated` here means
  machine-harvested, NOT "a human curator curated it" — the opposite trust level. If this
  feature lands, seriously consider renaming the enum value to something like `web` /
  `harvested` to kill the ambiguity, rather than overloading `curated` with both meanings.)*
- `colleague` — a real, known person. High trust. Currently an unused enum value with no
  creation path; this is the value a curator system would actually populate.

**What it would touch:**
- **Real user/auth:** ADR 0007 already names the seam — `author_label` → `user_id`. Today
  `author_type`/`author_label` stand in for authentication that does not exist. A curator
  system is the point where that stops being sufficient.
- **`relevance_score`:** reserved in the schema as "curated only; MVP always null" — a trust
  model would give it an actual meaning and a source of truth.
- **`confidence` weighting (ADR 0021, Epic 11 T11.7):** the MVP rule counts every distinct
  author as exactly **one** independent voice, deliberately unweighted, because
  `confidence` is a coarse `few/some/strong` scale (ADR 0013 point 4). A trust model is
  precisely the thing that would reopen that: a trusted curator's first-hand report
  arguably outweighs an anonymous web handle. Note the MVP rule **scales gracefully** into
  this — each curator is a distinct `author_label` and so already counts as a distinct
  voice; only the *weighting* would be new.
- **Reel curation by colleagues:** a posting path for Reels that does not go through
  ingestion/enrichment at all, which brushes against ADR 0005 (sourced-only) and needs an
  explicit decision — is a trusted colleague's word a "source"?
- **The deferred `curated` echo judgment (ADR 0021):** once web-harvested reports can
  actually be created, they need the Reel-style `is_primary` echo check that own/colleague
  reports do not. Same grill.

## T8 — Curator inbox: an approval gate before content becomes visible
> Owner idea 2026-08-02. **Flagged for a design session** → **ADR 0028** (proposed, ungrilled).
> New docs are English per README §2.

**Motive:** a review surface listing every newly-arrived item with (a) the date it was added,
(b) a short explanation of *why* that relevance/quality level was chosen, (c) manual override of
those judgements, and (d) an explicit approve step. Unapproved items sit in a holding area instead
of the main feed.

**T7 and T8 compose — clarified by the owner 2026-08-02.** They answer different questions
(T7: *who* is giving input; T8: *when* — before or after publication), and combining them gives
per-curator queues whose judgements are weighted by T7's trust model, so several curators can
review the same item without their votes counting equally. Still keep the concepts distinct when
designing: neither depends on the other, and T8's post-publication half works with a single user.

**Two surfaces, very different cost:**
- **Pre-publication queue** (per registered curator) — the expensive half: lifecycle state, a
  rationale field, a holding area.
- **Post-publication input** on already-visible content — **cheap and independent**: no lifecycle
  state, no back-fill, no holding area. `src/lib/feedback/run.ts` is the natural seam. Ship first.

**Why it needs a grill rather than an epic plan** (detail in ADR 0028):
- Enrichment emits **no rationale field** today, so (b) changes ADR 0003's output contract and
  cannot be back-filled without re-running enrichment.
- Visibility is currently a pure computed threshold with **no lifecycle state**, so (d) is a real
  schema and pipeline change, not a UI addition.
- It is in tension with **ADR 0004** (derive labels, don't stamp them) and with ADR 0023's rule
  that new surfaces go into a hub, never onto the fixed four-item tab bar.
- Sharpest open question: **what happens when the curator is away?** An approval gate turns
  "signal over noise" into "nothing at all" during absence.

## T9 — Click-to-explain glossary with inline term highlighting
> Owner idea 2026-08-03. **Rough note only — no ADR, not grilled.**

**Motive:** click any word or term in the app to trigger an explanation workflow. The result is saved
into a **glossary / knowledge base**. Reels and other text then render already-known terms
**highlighted**, and hovering one shows a short pop-up explanation.

**Reference for the feel:** *Warhammer 40k: Rogue Trader* does this well for setting-specific terms.

**First thoughts (not decisions):**
- Distinct from **Skill Nodes**: a skill is a competency you progress on; a glossary term is just a
  definition. Overlap is possible but conflating them would repeat the T7/T8 naming trap.
- There are already two glossary files (`CONTEXT.md` DE, `CONTEXT.en.md` EN) — those are *developer*
  docs, not user-facing. Decide whether this is a third store or a promotion of those.
- Highlighting means matching term occurrences inside rendered prose — a text-processing pass, and
  the first thing in the app to modify Reel text at render time.
- Explanation generation should go through the executor seam (ADR 0015) and, following ADR 0024,
  probably user-triggered on the Claude Code subscription rather than a batch pass.
- Sourced-only (ADR 0005) needs thought: a definition of "MCP" is general knowledge, not something
  the source text supports. That is a genuine tension with the app's trust model.

## T10 — Token/cost accounting per pipeline run
> Owner idea 2026-08-03. **Rough note — no ADR yet.** Cheaper than it looks: the data already
> exists and is being thrown away.

**Motive:** see where tokens go. "If I run the daily task, how many tokens does that cost?" — to get
a feel for the cost of each pass and each interaction.

**The data is already there, on both executors (verified 2026-08-03):**
- **API path** — `client.messages.create()` returns `response.usage`
  (`input_tokens`, `output_tokens`, cache read/creation counts). `callStructured`
  (`src/lib/claude.ts:33`) returns **only** `toolUse.input` and discards the rest.
- **Claude Code path** — the CLI's `--output-format json` envelope carries `usage` **and**
  `total_cost_usd`. `extractResultJson` (`src/lib/executor/claudeCode.ts`) pulls out `result` and
  discards the envelope, including usage.

So no new LLM calls are needed — just stop dropping what comes back.

**The one real design obstacle:** `Executor` is typed
`(opts: StructuredCallOptions) => Promise<unknown>` (`src/lib/executor/executor.ts:11`). Usage has
nowhere to travel without changing that seam, which is **ADR 0015 territory** and touches all six
LLM steps. Options, none chosen:
1. Widen the return to `{ result, usage }` — honest, but a breaking change across every step and
   every mocked-caller test.
2. An out-of-band collector (an injected counter the executor writes to) — leaves the seam alone,
   but is implicit state.
3. Wrap the executor in a metering decorator at the one place it is resolved
   (`pipeline.ts:53`) — no signature change, and the natural home for a per-run total.

Option 3 looks cheapest and matches how the executor is already resolved exactly once per run.

**Where to store it:** `pipeline_runs.summary` is already `jsonb` and already holds per-phase
counts, so a `tokens`/`cost` block fits with no migration. The admin console already renders run
summaries, so it is also the natural place to display it.

**Also worth surfacing:** per-*item* cost (which Reels were expensive), and the on-demand features
(write-up, ADR 0024) where the user presses a button and might want to know what it cost.

**Caveat on the cost figure:** under `APP_PROFILE=local` the spend is Claude Code **subscription
quota**, not money — `total_cost_usd` from the CLI is what the same work *would* have cost on the
API. Label it as such or it will read as a bill.
