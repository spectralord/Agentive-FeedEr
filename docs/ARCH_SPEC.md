# Architecture Specification — Agentive-FeedEr

> For what's next / open questions / bugs, see `docs/OVERVIEW.md`.

This is the durable "how the system works" reference. It is organized by topic, not by ADR
number, so you can understand current architecture without opening individual ADR files. Every
bullet traces to an ADR number in parentheses if you need the full reasoning. Only **accepted,
currently-binding** decisions are included — proposed/deferred/parked items are listed separately
in "Not yet built / not binding" at the end.

---

## 1. Content sourcing & ingestion

- Content comes **only from curated, structurally-fetchable sources** — RSS/Atom, official
  changelogs, HN/Reddit APIs, newsletters. No open web scraping, no open web search. (ADR 0001)
  - Why: open scraping/search is unreliable (every page different, layouts break), costly, and
    the main source of noise/hallucination — directly opposed to "reliably know what's SOTA".
  - Escape hatch already built in: new sources, or a specific per-source scraper, can be added
    "on concrete need" without revisiting this decision. A user-supplied URL counts as curation
    by the user, not open search.
- A code-level **source registry** (`src/lib/sources.ts`) declares each source; code is the
  source of truth for structural config (same pattern as `THEMES`).
- **Ingestion and enrichment are decoupled into two pipeline phases** (ADR 0002):
  1. **Ingestion** — fetch all sources, store new entries as raw items, deduped by
     source-ID/link/date. No LLM involved, effectively free.
  2. **Enrichment** — only not-yet-enriched raw items go through the LLM.
  - Why: LLM tokens are the only real variable cost; combining fetch+enrich would risk paying
    multiple times for the same item and couples cost to fetch frequency. Keeping raw items also
    means later re-processing (new prompt, new profile) never needs re-fetching.

## 2. Enrichment (core LLM pass)

- Each raw item is enriched in **one LLM call with a strict JSON schema** (structured output),
  producing exactly one validated Reel object: `summary`, `category`, `maturity`, `experimental`,
  `relevance_score`, `quality_score`, `example`, `action`, `effort_tag`, a raw skill-hint. (ADR
  0003)
  - Fields that can't be substantiated from the source come back as `null` — never guessed. This
    is what makes "sourced-only" (§8) technically enforceable.
  - `quality_score` (substance vs. hype) is produced in the *same* pass, not a second call.
  - Why one pass: multiple specialized calls (summarizer/classifier/judge) would multiply cost
    and latency for a single-user daily batch, for no real benefit at this scale.
- **Labels are derived views, not stamped facts** (ADR 0004). Reels store facts/attributes
  (`published_at`, `ingested_at`, `category`, `maturity`, scores). Display labels like "New",
  "SOTA", "Best Practice" are computed filters over those facts, recomputed at read time — not
  written to a row.
  - Exception: `experimental` is a stored flag (it isn't derivable from date/score).
  - Why: stamped labels would be static/inconsistent and hard to recompute as "what's SOTA now"
    changes; deriving means the overview/history page is "free" — just another query.
  - The attribute set is meant to be metadata-field-extensible without a schema migration.
- **Sourced-only content, no invented examples or actions** (ADR 0005). `example` and `action`
  may only state what the source actually supports; unsupported → `null`. `effort_tag` is exempt
  (it's an estimate, not a factual claim).
  - Why: a hallucinated example/action is worse than none for a "how to actually use AI" tool —
    it actively teaches wrong practice and destroys the trust that is this product's only
    currency.
  - This is one of the binding rules — see §12.

## 3. Skill tagging (Match-or-Propose)

- Content (Reels + Experience Reports) is assigned to a **Skill Node** by a dedicated pipeline
  step, the **SkillTagger**, not by the core enrichment pass and not by free-text generation or a
  closed list. (ADR 0009)
  - **Match:** item + current node list (slugs + short descriptions) → best match if confidence
    clears a threshold; matches apply automatically in the background.
  - **Propose:** nothing matches → a new node is *proposed*, but only created on user
    confirmation (create / merge into existing / discard). Proposals never block the batch; the
    item stays untagged until confirmed.
  - Why not free generation or a closed list: free generation causes taxonomy explosion
    (`prompt-caching` / `prompt-cache` / `caching` as separate nodes); a closed list can't capture
    emergent skills, which defeats an "up to date" tool.
  - Why its own step and not part of core enrichment: the single-pass call sees one item, not the
    global current node list needed to match against.
- **One tagger, multiple triggers**, decoupled from the logic itself (which just processes
  `skill IS NULL`): reels get tagged as a batch stage in the daily job after enrichment; manual
  Experience Reports get tagged individually right after save; the daily run also sweeps as a
  backstop for anything still untagged.
- Embedding-based dedup is an explicitly deferred scaling optimization, not part of the current
  design.

## 4. Topic clustering

- A **Topic Cluster** is the computational unit for "multiple sources about one specific thing" —
  needed for corroboration/freshness. Formed the same way as skill tagging: **Match-or-Propose**
  against active clusters within a time window. (ADR 0013)
  - Why match-or-propose again: keeps clusters stable over time (no re-shuffling every run) and
    keeps LLM context bounded, mirroring the SkillTagger pattern.
- **Granularity is deliberately narrow** — a cluster is about one concrete thing and its specific
  use (e.g. "the batch command"), not a general skill. This keeps a later corroboration count
  honest: it counts independent sources on the *same specific claim*, not theme-wide.
- **Skill Nodes remain the only broad/thematic grouping** — there is deliberately no second,
  broader cluster tier. A Reel carries two peer-groupings: a narrow Topic Cluster (corroboration/
  freshness) and one or more Skill Nodes (broad browsing/knowledge).
- **Independence is tracked via `is_primary` per cluster member**, deliberately coarse: the
  clustering pass marks whether a member is a first-hand/primary statement (official source, own
  test, experience report) or a recognizable echo/reblog of another member. Confidence is derived
  from this as a coarse scale (few/some/strong), not an exact count — so echo-detection errors
  barely move the result.
- **Experience Reports can join a cluster but never create one** (match-only, Propose branch
  removed). (ADR 0021)
  - Why: the full Match-or-Propose would let subjective, unsourced content spawn a cluster whose
    only member has no sourced material, breaking the ADR 0005/0007 trust boundary at the cluster
    level. This would also be the *common* case, not an edge case, given reports are practice-
    level (skill-node granularity) while clusters are narrow.
  - An unmatched report just stays unclustered — its skill tag already places it in the broad
    Skill Map, which is the right home for practice-level content.
  - Matching is **bounded to the active clustering window** (`CLUSTER_WINDOW_DAYS`) — an
    unbounded "still NULL" sweep would never converge since Propose always used to succeed for
    reels but doesn't exist for reports.
  - Reports count as primary **by construction** — no echo judgment is computed for them (there's
    no path today for non-`own` reports where echo would even be meaningful).
  - **Independent count = distinct authors/sources, unweighted.** Five reports from the owner
    count as one voice, not five; a colleague's report adds a second. No weighting between a
    first-hand test and a blog post — the confidence scale is deliberately coarse.

## 5. Topic knowledge check (confidence + freshness)

- **Corroboration confidence and freshness/supersession are one feature**, computed together on
  the Topic Cluster, not two separately-built capabilities. (ADR 0012)
  - `confidence` and `freshness`/supersession are **cluster properties that propagate** to
    anything referencing cluster items (skill nodes, saved reels, etc.) — "your knowledge of X is
    outdated, see newer" or a corroboration strength signal.
  - Supersession itself lives on items via `superseded_by`; the views derive it (§2's
    derived-labels pattern).
  - Topic clustering (§4) is a hard prerequisite — the check is not buildable without it.

## 6. Content verification (two-tier verifier)

- The verifier is **two independent tiers along the ephemeral/durable split**, because an LLM
  judging "truth" is itself prone to hallucinating exactly there — an unreliable checker is worse
  than none. (ADR 0011)
  - **Tier 1 — per-Reel critic pass** (ephemeral layer): a separate LLM call, given the source +
    finished Reel, checks (A) **fidelity** — does the write-up overclaim vs. the source — and (B)
    **skepticism** — risky claim types (unsubstantiated benchmarks, superlatives like "X replaces
    Y", overgeneralizing from one case). Produces `caveat` (nullable text).
    - **Gated**: only runs on Reels that clear the display threshold, to bound cost.
    - `caveat` is its own stored fact, shown as a visible warning and filterable — it does **not**
      feed back into `quality_score` (kept as separate signals, per ADR 0004's derived-views
      spirit — transparency over silent suppression).
  - **Tier 2 — cluster corroboration** (durable layer): `confidence` derived from the count of
    independent supporting sources within a Topic Cluster — a consensus signal, not an LLM truth
    judgment. Own corpus only for now; external web corroboration is explicitly deferred (touches
    ADR 0001, needs its own decision).
  - **For Experience Reports:** Tier-1 fidelity doesn't apply (no external source to be faithful
    to); skepticism narrows to an **overclaim flag** on absolute/universal claims only — never
    flagging subjectivity itself ("I found X annoying" must never be flagged). This reuses the
    Reel verifier machinery with a report-specific, rule-(B)-only prompt, writing to
    `experience_reports.caveat`. (ADR 0021 decision 5)
  - Tier 1 is technically a **second LLM pass** per Reel, an intentional exception to the
    single-pass core enrichment contract (ADR 0003) — the same pattern as SkillTagger: a
    genuinely separate concern gets its own pass with the context it needs.

## 7. Durable knowledge vs. ephemeral content (lifecycle model)

- Two layers with different lifecycles. (ADR 0008)
  - **Ephemeral**: news Reels + curated Experience Reports. Age out of *active* views over time —
    never by deletion, only by lifecycle transition.
  - **Durable**: Skill Nodes + user progress/adoption log + own Experience Reports. Accumulate,
    stay active until manually moved.
- **Uniform lifecycle state, no auto-delete, on everything** (Reels, Reports, Skill Nodes):
  `active` (normal views) → `deprecated` (superseded, has reason/`superseded_by`, out of active
  views but still in history) → `archived` (only in an explicit archive view). Hard delete is a
  rare, deliberate manual action only.
- Rules that keep the durable layer actually durable:
  - Skill Nodes are **first-class** — content references nodes, never the reverse; a node can
    have zero current content and still exist.
  - Nodes are created once and never auto-deleted (only manual archive).
  - **Progress and notes live on the node**, not on content — they survive any content turnover.
  - Own/company reports can still be manually deprecated/archived; they're just exempt from the
    *automatic* ephemeral rotation.

## 8. Skill Guides (synthesized durable knowledge)

- A **Skill Guide**: one synthesized, durable document per Skill Node (1:1, nullable), generated
  from all content ever tagged to that node, regenerated as significant new content arrives. (ADR
  0018)
  - Scope is per node, not per theme — deliberately avoids a third grouping tier above nodes (the
    same collision ADR 0013 already rejected for clusters).
  - **Citations are mandatory** — every claim traces back to its source Reel(s). A guide
    synthesizes across sources so needs *more* traceability than a single-source summary, not
    less, to stay inside the sourced-only trust model.
  - **Regeneration is threshold-based** (N newly-tagged items since last synthesis, env-tunable),
    not per-Reel — re-synthesizing on every tag would be expensive and make the doc shift under
    the reader. Manual regenerate is also always available, ignoring the threshold.
  - **Staleness is visible** via a `synthesised_at` timestamp surfaced in the UI.
  - **Manual editing is layered, not merged into regeneration.** Generated text and a manual edit
    are separate stored layers; regeneration only replaces the generated layer, never destroys an
    edit. The edit is surfaced alongside the new generation with a diff, and the user decides
    whether to fold changes in. (Automated LLM "fusion" was considered and rejected — it's a
    three-way-merge problem that either silently drops a correction or produces self-contradicting
    prose.) A manual edit should be flagged when newer/better generated content exists.
  - **v1 synthesizes Reels only** — Experience Reports are out of scope for v1 (their `skill`
    column exists but is unpopulated; nothing tags reports to skills yet).
  - Goes through the Executor seam (§12).
  - **Build is gated, not the design**: as of the last measurement, active nodes held 1–3 tagged
    Reels each — too little to synthesize from. Implementation waits until the corpus supports it.
    Guide structure (free prose vs. fixed sections) and model choice are deliberately left
    unanswered until real content exists to judge against.
- **Distinct from Write-up and Deep-Dive** — three different generation concepts:

  | | Scope | Source material | Trigger |
  |---|---|---|---|
  | **Write-up** | one Reel | that Reel's stored raw content | user-triggered, per Reel |
  | **Guide** | one Skill Node | all content tagged to the node | threshold-based / manual |
  | **Deep-Dive** | one Reel | fetches *new* external pages | on-demand, agentic (not built) |

## 9. Write-up (long-form per-Reel content)

- `reels.writeup` (nullable text): a longer, more discursive elaboration on a Reel than the short
  `summary` — a few paragraphs, no hard cap. (ADR 0017)
  - Generated by a **second, decoupled pass**, not a change to core enrichment — keeps ADR 0003's
    single-pass contract intact and lets write-up generation be retried independently.
  - **Still sourced-only**: elaborates using the already-stored raw content only, no new fetching,
    no claims beyond what the source supports. This is explicitly *not* Deep-Dive.
  - The Write-up tab is **always shown**, even when `writeup IS NULL` — rendering an
    explicitly-labelled placeholder rather than hiding the tab or reusing `summary` text
    silently. (Placeholder honesty is itself an application of "null over hallucination" to the
    UI layer.)
- **Generation is user-triggered, per Reel, on demand — not a batch pass.** (ADR 0024)
  - Why: this is a single-user product; "will someone read this" proxies like `QUALITY_THRESHOLD`
    or Top-N/day are strictly worse than just letting the one reader press a button when they
    actually want it.
  - Runs through the **`claude-code` executor** (Claude Code subscription quota), never the paid
    API — enforced by `resolveExecutionConfig` throwing on `local` + `api`, not just documented.
  - **Local-profile-only by construction** — the executor spawns the local `claude` CLI, which
    doesn't exist on Railway. The action must be hidden/disabled under `cloud`, not left to fail
    at runtime.
  - Cached for good once generated — a one-time cost per Reel, served on every subsequent read.
  - Failure is visible and leaves no partial state: on CLI failure or schema-validation rejection,
    `writeup` stays `NULL` and the UI shows the failure — never partial or hallucinated prose.

## 10. Actionables & two-track skill progress

- `reels.action` is promoted to a **first-class checkable Actionable** — no new LLM pass needed,
  since enrichment already produces it. A completion record (ref + done state + optional note +
  timestamp) is the only new state. (ADR 0019)
- **Two parallel, non-gating progress tracks per Skill Node:**
  - **Declared** — `user_progress.status` (seen/tried/mastered), honour-based, downgrades
    allowed.
  - **Evidenced** — completed Actionables, guide-read state, notes.
  - "Mastered with zero evidence" is fully allowed and fully visible — visibility is the feature,
    enforcement is explicitly not (consistent with Skill-*Map*-not-Tree, no gating).
- Actionables remain **sourced-only** — a node with no sourced actions just shows none.
- **Completion is evidence for the node, never the Reel** — Reels are never checked off directly
  (an earlier reel-level `tried` interaction was deliberately removed; conflated "I read this"
  with "I did something").
- **A completion record snapshots the action text at completion time** — because `reels.action`
  is mutable (re-enrichment can rewrite it); without a snapshot, checking off history could
  silently rewrite what you actually did. Uncompleted actionables remain a pure view with no
  duplicated text.
- `effort_tag` is functional, not just decorative — Actionables are filterable/sortable by effort
  (5-min-test / afternoon / know-only).
- Actionables **never expire or get hidden** — instead the parent Reel's supersession state is
  surfaced on it (a `--caution` case per §11's color rules). Superseded advice is often still
  valid; silently removing a planned to-try is worse than showing it with an honest caveat.
- No auto-advance from evidence to the declared track (`seen → tried`) — would blur the two-track
  separation. A one-time dismissible *suggestion* is permitted since the write stays in the user's
  hands.

## 11. Skill Map layout & constellation

- **The skeleton is designed and fixed; only the leaves are dynamic.** (ADR 0020)
  - **Theme regions are hand-placed code constants** (`THEME_LAYOUT`, center + radius per theme)
    — matches the existing pattern of structural constants living in code (`THEMES`,
    `SOURCE_REGISTRY`) while accumulating state lives in DB rows.
  - **Node position resolves in three tiers**: manual override (if locked) → stored computed
    layout → deterministic hash fallback. The hash fallback guarantees every node always has
    *some* stable position even before any layout pass runs.
  - **Layout is incremental and stored** — adding a node pins all existing nodes and places only
    the newcomer; existing nodes never move on their own. A full re-layout is an explicit,
    deliberate action only.
  - **Positional meaning comes from grounded co-occurrence data** (skills appearing together in
    the same topic clusters), not from an LLM picking coordinates — consistent with the project's
    preference for grounded computation over LLM judgment (same spirit as `confidence` from source
    counts). An LLM may propose adjacency/relatedness *edges* later if co-occurrence stays too
    sparse — never coordinates.
  - **Manual override + edit mode is the escape hatch**: drag-to-place sets an explicit locked
    position; locked nodes are never touched by any layout pass. Edit mode is desktop/iPad only —
    mobile parity is explicitly not required (dragging is fiddly on phones, it's a rare action).
- **Themes are a closed vocabulary of 8 slugs**, enum/FK-constrained so off-vocabulary values
  can't enter; a separate `THEME_LABELS` map decouples the stored slug from the display string —
  renaming what the user sees costs nothing. The current 8 values are explicitly provisional and
  not to be treated as a considered decision.
- **The layout pass (relaxation) is gated on co-occurrence density; the hash tier ships first.**
  With real co-occurrence data still sparse, only the position schema + hash tier (+ optional
  manual override) is currently justified — the relaxation pass is added once density supports it.
- **Three view layers, zoom only, no gating**: Layer 1 (Roots — the 8 themes, drag-to-arrange
  here), Layer 2 (all nodes within their theme region), Layer 3 (one theme in isolation). Themes
  *are* the roots — no new hierarchy, no prerequisites between skill nodes, every status still
  reachable from every status (this does not revisit Skill-Map-not-Tree).
- **One canonical position per node** — zoom never recomputes layout, to preserve cross-device
  spatial memory.

## 12. Execution model (trigger × executor)

- Every pipeline run is controlled by **two orthogonal axes**, bundled via environment profiles.
  (ADR 0015)
  - **Trigger** (who starts the run): `railway-cron` | `claude-code-cron` | `manual`.
  - **Executor** (what performs inference): `api` (Anthropic SDK + key, paid) | `claude-code`
    (local CLI agent turn, subscription quota).
  - `railway-cron` + `claude-code` is an illegal combination (Railway can't consume CC quota).
  - **`APP_PROFILE=local|cloud`** sets defaults for both axes; either axis can be overridden
    individually via env.
  - **Default is `local`** (flipped 2026-08-01 from `cloud`) — an unset profile now means
    "subscription quota + manual trigger", not "spend money on a cloud cron", because `cloud`
    implies the paid API. `cloud` remains fully supported but must be set explicitly. The default
    is pinned by a test so a silent regression back to `cloud` wouldn't go unnoticed.
  - **Hard local guardrail: zero API calls, no silent API fallback.** If the `claude-code` path
    fails, the run aborts/skips — it is never quietly retried over the paid API.
- **Executor seam is binding for every LLM step, no exceptions** (see §13's binding-rules list) —
  this is what makes the whole matrix work: one seam, injected once, used everywhere.
- **Data path**: the Claude Code executor session accesses the DB directly through the same
  Drizzle layer the app uses — local DB under `local`, Railway DB under a `cloud` override.

## 13. Admin console & manual pipeline trigger

- The pipeline core is a single reusable function (`runDailyPipeline(db, {mode})` in
  `src/lib/pipeline.ts`); **cron and the admin API call the same function** — no logic
  duplication. (ADR 0010)
- **Runs are asynchronous with a status table.** `POST /api/admin/run` creates a `pipeline_runs`
  row (`running`), starts the pipeline without awaiting it, and returns immediately with the run
  ID; final status/summary is written on completion. A single-run guard prevents cron and
  button-triggered runs from overlapping.
- **The entire admin area (`/admin/*`, `/api/admin/*`) is gated by a shared-secret `ADMIN_TOKEN`**
  (login → httpOnly cookie). If `ADMIN_TOKEN` is unset, admin is disabled entirely (trigger API
  returns 503) — a safe default, since the app is reachable at a public URL.
- Cron runs also write to `pipeline_runs`, giving one unified run history in the admin UI.

## 14. Navigation & information architecture

- **Four tab-bar destinations, two of which are hubs.** (ADR 0023)

  | Destination | Contains |
  |---|---|
  | Today | daily ritual — Top-N |
  | Feed | browse everything, filters |
  | Skills | Map · Knowledge Base · Adoption Log |
  | Library | Saved · Archive · Experience |

  - Admin is **not** in primary navigation — it's an operator surface in a single-user app,
    reachable via a gear icon in the app bar instead.
  - Bottom tab bar on mobile (primary nav belongs at the reachable edge on a one-handed phone
    product); desktop/iPad can render the same four destinations differently.
  - **Binding rule: new surfaces go into a hub, never onto the tab bar.** The tab bar is fixed at
    four; growth is absorbed by a hub's segmented sub-nav. This is the durable content of the ADR
    — without it the next epic re-adds an eighth link.
  - The tab bar is **persistent everywhere including the feed** — feed cards are sized to
    `calc(100dvh - var(--tabbar-h))`, not `100dvh`. Auto-hide-on-scroll was explicitly rejected:
    with scroll-snap paging, every swipe fires a scroll event and would toggle the bar on every
    card.
  - **Reel Detail covers the app bar but never the tab bar** — `fixed`, `z-30`, `bottom:
    var(--tabbar-h)`. Detail owns the screen for reading (feed-level chrome has nothing to say
    about the open item), but the tab bar stays reachable so you can leave a Reel by tapping
    another destination directly, not just Back.
- `/` stays the Feed (not Today) — Today is one tap away and Feed is the better browse default.

## 15. SOTA retirement (Archive)

- The SOTA section is slated to retire **once Skill Guides ship** — not before, since it's
  currently the only surface answering "what's the current best thinking on X" and removing it
  first would be a straight regression. (ADR 0022)
  - Why: `isSota()` is a per-reel threshold filter (`maturity === established && relevanceScore >=
    70 && qualityScore >= 70`) with no notion of topic or comparison — it fakes a topical
    dimension by grouping on `category`. Guides are comparative and topical *by construction*,
    which is what SOTA was trying approximate.
  - The **History half is not superseded** — it's retrieval ("find what I saw three weeks ago"),
    which Guides don't do. It's renamed **Archive**, moves into the Library hub, and becomes the
    home for app-wide search (currently absent entirely).
  - `isSota()` itself isn't deleted — it survives as a filter chip in Archive, which is an honest
    framing of what it actually computes (unlike a section titled "State of the Art").
  - This does **not** reopen ADR 0004 (derived labels) — it narrows one label's presentation, not
    the derived-vs-stamped principle.
  - **Currently blocked further out than it looks**: this is gated on Guides shipping, and Guides
    are themselves build-gated on corpus size (§8). So SOTA is not yet retired.

## 16. Content type separation: Experience Reports

- Experience Reports are a **separate content type** (`experience_reports`), not a flag on
  `reels`. (ADR 0007)
  - They are **exempt from sourced-only (ADR 0005)** — subjective/unvalidated is allowed and
    clearly labelled as such.
  - Instead of a `source`, they carry an **author** (`author_type`: `own` | `curated`, later
    `colleague` + `author_label`) — a stand-in for real auth in the MVP.
  - Relevance scoring is only AI-assigned for `curated` reports; `own` reports stay neutral
    (never down-ranked), with optional AI self-feedback on request.
  - Why a separate type and not a flag: mixing both content contracts (sourced vs. subjective) in
    one table and one UI logic would blur the exact trust boundary that is this product's
    currency.

## 17. Hosting

- **All-in-one always-on container** (Railway: app + cron + managed Postgres in one place), not
  serverless. (ADR 0006)
  - Why: the daily batch job needs to run a multi-minute scrape+LLM job; serverless platforms
    (e.g. Vercel) impose per-function time limits that would force chunking the batch.
  - Same codebase runs locally as a (currently primary, see §12) alternative; local is not a
    stopgap so much as the now-default profile.

---

## 18. The binding rules (violating these is a review failure)

These are the rules pulled up from individual ADRs because they apply project-wide, to every new
feature, not just the one that introduced them.

- **Executor seam, no exceptions (ADR 0015).** Every LLM step takes an **injected `Executor`**
  (the `StructuredCaller` signature), defaulting to `callStructured`, wired through
  `pipeline.ts`. Never call the Anthropic API directly from a pipeline step. Output must be
  zod-validated (ties into "null over hallucination" below). Unit tests use a **mocked** caller.
  Why this is load-bearing: it's the single seam that makes every LLM feature work under both the
  paid-API and Claude-Code-subscription executors without per-step config, and it's what lets the
  `local` profile guarantee zero API spend structurally rather than by convention.
- **Reserved semantic colors, one meaning each, dark-only (ADR 0016).** `--accent`
  (link/focus/tried) · `--action` (sourced Action line + skill badge + "mark as tried") · `--gold`
  (mastered, **only** mastered) · `--caution` (`caveat` + freshness/supersession notice, **only**
  those — never a neutral/informational badge). No raw `zinc-*`/`amber-*`/`emerald-*` utility
  colors in new code for these meanings. The app is **dark-only** — no `prefers-color-scheme`
  override, no light-mode values anywhere. Why: color usage had already drifted once before this
  was written down (a neutral badge briefly used the warning color); a documented meaning per
  token is the only thing that prevents the next drift. The dark-only clause exists because its
  earlier absence (documented only in a prototype README) shipped a real BLOCKER — an unlayered
  CSS rule beat a layered one and rendered the app on a white background for any non-dark-mode OS.
- **Null over hallucination (ADR 0003).** A field with no support in the source comes back
  `null`, never guessed — enforced via structured-output schema validation, not prompt wording
  alone. This is the technical mechanism; §19's "sourced-only" is the product principle it serves.
- **Sourced-only content (ADR 0005).** Examples and actions may only state what a source actually
  supports. No hallucinated code samples or action items — a wrong "how to use this" is worse than
  none, and trust is this product's only currency. Experience Reports are the one deliberate
  exemption (§16), because they're explicitly subjective by design, not because the rule is
  optional.
- **Four tab destinations, maximum (ADR 0023).** New user-facing surfaces go into a hub (Skills or
  Library), never directly onto the tab bar. The tab bar is fixed at four; this rule is what keeps
  it that way as new epics ship.
- **No new runtime dependencies** without a documented, deliberate exception (the one on record:
  `playwright` as a **devDependency** for the design-screenshot tooling — dev-only, runtime rule
  unchanged). English everywhere — UI text, generated content, code, comments, commits, docs.
  Pipeline steps use per-item try/catch and never abort the whole run on one failure.
- **`src/lib/env.ts` is server-only.** Calling `env()` from a client component throws at hydration
  by design — this is what keeps server secrets (API keys, admin token, DB URL) out of any
  client bundle. Known occurrences on record: six call sites, all server-side.

---

## Not yet built / not binding

Decisions that are accepted-in-design but explicitly gated on a precondition, or still proposed/
parked — do not treat these as current architecture.

- **Skill Guides (ADR 0018)** — design accepted, **build gated** on corpus size (nodes hold too
  few tagged items to synthesize from today).
- **SOTA retirement (ADR 0022)** — proposed, additionally gated on Guides actually shipping (not
  just being decided).
- **Writing-assistance service (ADR 0026)** — accepted, scoped to one consumer (Experience Report
  authoring), planned as Epic 22 but not yet built.
- **Constellation relaxation pass, view layers 2/3 entry mechanics, layer-1 theme-region dragging
  (ADR 0020)** — design accepted, gated on co-occurrence density / left as open UI questions.
- **Deferred task queue + typed handlers (ADR 0025)** — reopened at low priority after being
  rejected; needs a second grill before any build.
- **Node seeding / declared-node fetching (ADR 0027)** — deferred, not built; blocked in practice
  on the (also parked) agentic Deep-Dive epic.
- **Curator inbox / approval gate (ADR 0028)** — proposed only, flagged for a design session, not
  grilled. Explicitly: "do not build from this file."
- **Design process (ADR 0014)** — this is a process/governance decision (three-tier design
  process: product/architecture, UX, content-quality), not a system architecture decision, so it's
  noted here rather than given its own numbered section above.
