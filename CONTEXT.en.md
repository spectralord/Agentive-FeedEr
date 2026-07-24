# CONTEXT — Glossary (English domain language)

> This document is **only a glossary**: it defines the meaning of Agentive-FeedEr's
> domain terms. No implementation details, no rationale, no how-to — those live in
> `docs/specs/` and `docs/adr/`.
>
> **Status:** English domain language established 2026-07-23 (T3). This file is the
> canonical term reference for the ongoing German→English switch and supersedes the
> German `CONTEXT.md` once the full switch lands.

| Term | Definition |
|---|---|
| **Agentive-FeedEr** | Personal web tool that collects AI news (focus: new Claude features and agentic AI use in development) from curated sources, prepares it with AI, and makes it consumable as a vertically scrollable feed. Non-commercial, primarily single-user. |
| **Source** | A curated, structured-retrievable origin of raw content (RSS/Atom feed, official changelog, an API like Hacker News/Reddit, newsletter). Open web scraping and open web search are **not** sources in the MVP. |
| **Ingestion** | The daily process that fetches all sources and stores their new entries raw as **Raw Items**. Contains no AI processing. |
| **Raw Item** | An unprocessed entry collected from a source (title, text/HTML, link, publication date, source reference). Raw state before enrichment. |
| **Enrichment** | The AI processing step that turns a **new** Raw Item into a **Reel**. Runs as a single structured LLM call per item. |
| **Reel** | The atomic, consumable unit of content: a card prepared from **one** Raw Item. Carries a summary, attributes (see below), a sourced example, an action line, and the source link. Scrolled vertically in the feed. |
| **Feed** | The vertically scrollable (scroll-snap, mobile-first) view of Reels, newest first, filterable. |
| **Attribute** | A stored fact about a Reel. Core attributes: `published_at`, `ingested_at`, `category`, `maturity`, `experimental`, `relevance_score`, `quality_score`, `skill`. Extensible via a flexible metadata field without a schema migration. |
| **category** | Coarse topical assignment of a Reel (e.g. "Claude feature", "tooling", "technique"). Assigned by enrichment. |
| **maturity** | Estimate of how established a piece of content is, on an axis `experimental ↔ established`. |
| **experimental** | Stored flag: marks content that is an impulse/toy and not (yet) production-ready — e.g. something a source "just tried out". **Not** derived from date/relevance; a property of its own. |
| **relevance_score** | AI estimate of how relevant an item is for the user, judged against the **Developer Profile**. |
| **quality_score** | AI estimate of an item's substance (substance vs. marketing hype). Drives hiding of low-signal content — **never** deletion. |
| **Label** | A display-side marker like "🆕 New", "⭐ State of the Art", "🛠️ Best Practice". Labels are **derived views/filters** over attributes, not stored tags. Exception: `experimental` is a stored flag. |
| **Developer Profile** | A hand-maintained description of the user (stack, tools, seniority, interests, "what annoys me"), kept as a file. Serves as context for relevance scoring during enrichment. No ML, no training. |
| **Sourced-only** | Core principle: examples and action lines in a Reel may only show what is **backed by the source**. If nothing is backed, the field stays empty (`null`) — nothing is invented. |
| **Action (action line)** | The "what does this mean for me?" line of a Reel: a concrete, source-backed action. An **Effort Tag** hangs off it. |
| **Effort Tag** | Effort estimate on an Action (e.g. `5-min-test`, `afternoon`, `know-only`). An estimate, not a claim requiring a source. |
| **Today's Top-N** | A derived view of the N (default 3) most important Reels of the day, ranked by `relevance × quality × recency`. Not its own data structure. |
| **Topic Cluster** | Optional assignment of a Reel to a topic, to bundle multiple sources on the same topic. Provided for in the MVP data model but not yet actively used. |
| **Skill Node** | A skill/topic (e.g. "agentic tool use", "using prompt caching") in the Skill Map. Reels hang under Skill Nodes as evidence/content; a Reel references its skill via the `skill` attribute. |
| **Skill Map** | Visual, single-place view of the Skill Nodes, grouped into topic clusters, **without** hard prerequisite chains. Shows per-node progress. |
| **user_progress** | The state of a Skill Node for the user: `seen → tried → mastered`. The transition is **self-confirmed** (honor-based), optionally with a note. |
| **Adoption Log** | The collection of self-confirmations and notes ("this is how I used it") produced when applying skills. |
| **Deep-Dive** | Vision feature: an on-demand, agentic follow-up research pass on a Reel/topic that further enriches the same Reel object. |
| **Experience Report** | A subjective, not necessarily validated experience/practice report (e.g. "how long I keep a session open"). Its own content type, separate from Reels — **not** subject to the Sourced-only rule (ADR 0005). Carries an author instead of a source. |
| **author_type** | Origin kind of an Experience Report: `own` (written by self/company) · `curated` (fished by the AI from a source like Reddit/comment threads) · later `colleague`. Stands in for real user authentication (which does not exist) in the MVP. |
| **author_label** | Display name of a report's origin: for `own` a configured name, for `curated` the source handle (e.g. "r/ClaudeAI / u/xyz"). Becomes a `user_id` under a future real multi-user setup. |
| **Ephemeral Content Layer** | Content that automatically **rotates out** of the *active* views over time (`active → deprecated → archived`): news **Reels** and **curated** Experience Reports. "Ephemeral" refers to visibility, **not** deletion — the content stays stored and historically traceable. |
| **Durable Knowledge Layer** | Content/state that accrues and stays in the active views until *manually* transitioned: **Skill Nodes**, **user_progress**/**Adoption Log**, and **own** Experience Reports. Never automatically demoted or deleted. |
| **lifecycle_state** | Unified lifecycle state of content (Reels, Experience Reports) *and* Skill Nodes: `active` (visible in normal views) → `deprecated` (superseded, out of active views but visible in history; with `reason`/`superseded_by`) → `archived` (only in an explicit archive/history view). **Nothing is deleted automatically**; everything stays historically traceable. |
| **superseded_by** | Optional reference from a `deprecated`/`archived` item to the newer variant that replaces it (Reel/Report). |
| **Hard Delete** | Final removal from the DB — **not** part of the automatic flow, only a rare, deliberate manual action (emergency exit). The normal case is `deprecated`/`archived`, not deletion. |
| **Actionable (To-Try)** | A discrete, checkable, skill-tagged recommended action, **derived from** Reels *and* Experience Reports ("you should try this"). The user checks off Actionables — **never** Reels or Reports themselves. Completed Actionables are progress evidence for a Skill Node. |
| **SkillTagger** | The pipeline step/task that assigns content (Reels + Reports) a canonical Skill Node via **Match-or-Propose**: match an existing node (automatically in the background) or propose a new one (created only on user confirmation). Prevents a sprawling taxonomy. |
| **Verifier** | Two-tier critical check (Epic 10). **Tier 1 (Reel Verifier):** a dedicated critic pass checks a Reel for **fidelity to the source** and **skepticism** (risky claim types) → produces `caveat`. **Tier 2 (cluster corroboration):** at the knowledge/cluster level derives a `confidence` from the number of independent supporting sources. No "LLM decides truth". |
| **caveat** | A stored reservation on a Reel (text, nullable) that the Reel Verifier sets when the write-up overstates the source or a claim warrants caution. Surfaced as ⚠️ and filterable — **separate** from `quality_score` (ADR 0004). |
| **confidence** | Confidence measure at the knowledge/cluster level: how well a claim/topic is backed by **independent** sources (corroboration). Not an LLM truth judgment but a consensus signal. Depends on clustering (Vision V1). |
| **Corroboration** | The backing of a claim by multiple independent sources. Basis of `confidence` — first from the own collected corpus (Topic Cluster), later optionally extended via external web search. |
| **Topic-Knowledge-Check** | A feature (Epic 11) on top of clustering that, per **Topic Cluster**, produces two outputs from *one* cross-comparison over sources/time: `confidence` (corroboration) and `freshness` (supersession). Unifies the former Verifier tier 2 and the SOTA re-check. Results propagate to referencing items (Skill Nodes, Saves, SOTA). |
| **freshness / supersession** | Detection that newer content replaces older (e.g. a renamed parameter). Marks the older via `superseded_by`/`lifecycle_state=deprecated`. A grounded comparison of the cluster items against each other, no external truth judgment. |
| **Admin Console** | Protected operator view (`/admin`) to trigger backend tasks manually (chiefly the pipeline) and see system state. Secured by `ADMIN_TOKEN` (shared secret); unset ⇒ disabled. |
| **Pipeline Run** | One run of the daily pipeline (ingestion and/or enrichment), triggered by cron (`trigger=cron`) or the admin button (`trigger=manual`). Recorded in `pipeline_runs` (status, duration, summary, error); never more than one runs at a time. |
| **Pipeline Mode** | Scope of a Pipeline Run: `full` (ingestion + enrichment), `ingestion` (collect only), or `enrichment` (prepare only). |
| **Executor** | The interchangeable inference backend behind the `StructuredCaller` seam (Epic 17 / ADR 0015): `api` (paid Anthropic API) or `claude-code` (subscription quota via the local `claude` CLI). Every AI step runs through an injected Executor, so it works in both variants. |
| **Trigger** | Who kicks off a Pipeline Run (Epic 17 / ADR 0015): `railway-cron`, `claude-code-cron`, or `manual`. Independent axis from the Executor. |
| **APP_PROFILE** | Execution profile bundling Trigger × Executor defaults (Epic 17 / ADR 0015): `cloud` (railway-cron + api) or `local` (manual + claude-code; never Railway, never the paid API). Individual axes are overridable. |
