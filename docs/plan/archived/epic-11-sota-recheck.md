# Epic 11 — Topic knowledge check (freshness + corroboration)

> **Status: DESIGN GRILLED (2026-07-23), implementation open.** Merges the earlier
> "SOTA freshness re-check" idea **and** verifier stage 2 (corroboration) into **one**
> feature built on clustering (ADR 0012). **Precondition: Epic 15 (topic clustering).**

**Goal:** Two outputs per topic cluster from *one* cross-comparison over sources/time:
- **`confidence`** — how well is the claim supported by **independent** sources (corroboration).
- **`freshness`/supersession** — is there something newer that supersedes something older
  (e.g. `batch → fork`)? → mark the older one via `superseded_by`/`lifecycle_state=deprecated`.

**References:** ADR 0012 (core), ADR 0013 (clustering foundation, `is_primary`), ADR 0008
(layers, `superseded_by`), ADR 0004 (derived views), ADR 0007 (experience reports),
ADR 0001 (curated sources — external web corroboration remains a separate decision).
Glossary: topic knowledge check, confidence, freshness, corroboration, topic cluster.

## Grilled decisions
- **Unit of computation = topic cluster** (Epic 15); `confidence`/`freshness` are cluster
  properties and **propagate** to referencing items (skill nodes, saved reels, SOTA) — "your
  knowledge on X is outdated, see something newer" / degree of support. Supersession lives on
  the items/clusters.
- **No "LLM decides truth":** corroboration = **counting independent sources** (from
  `is_primary`, ADR 0013); freshness = a **grounded comparison** of the cluster's items against
  each other.
- **`confidence` = coarse scale `few/some/strong`** (not an exact number) — robust against
  misclassification in echo detection.
- **Conservative:** supersession is **proposed** (`deprecated`), not automatically moved out —
  human-in-the-loop, so nothing falsely disappears (ADR 0008: no auto-delete).
- **Experience reports:** get corroboration (degree of support); only a **narrow overclaim
  flag** (absolute claims), never subjectivity itself (ADR 0007).

---

## Tasks

### ☑ T11.1 — Schema: cluster `confidence` + freshness/supersession
- Add to `topic_clusters`:
  ```ts
  confidence: text("confidence", { enum: ["few", "some", "strong"] }),  // nullable until computed
  independentCount: integer("independent_count"),                        // evidence count behind confidence
  lifecycleState: text("lifecycle_state", { enum: ["active", "deprecated"] })
    .notNull().default("active"),                                        // ADR 0008
  supersededByClusterId: integer("superseded_by_cluster_id"),           // self-FK, proposal
  supersedeReason: text("supersede_reason"),                            // brief rationale (grounded)
  knowledgeCheckedAt: timestamp("knowledge_checked_at", { withTimezone: true }),
  ```
- **Verification:** migration green; fields default `null` or `active` respectively.

### ☑ T11.2 — Corroboration → `confidence` (`src/lib/knowledge-check/confidence.ts`)
- Per active cluster: **count independent evidence** = distinct `source` among members
  with `is_primary=true` (each original experience report counts too). Pure reblogs
  (`is_primary=false`) do **not** count.
- Map count → scale (thresholds from env, see below): `1 = few`, `2–3 = some`, `≥4 = strong`.
  Store `independentCount` + `confidence` on the cluster. **Purely grounded, no LLM.**
- **Verification:** unit tests with seeded cluster members (primary/echo/experience report)
  → expected `confidence`.

### ☑ T11.3 — Freshness/supersession comparison (`src/lib/knowledge-check/freshness.ts`)
- **Candidate selection:** clusters that **share a skill node** (broad level, Epic 12)
  are comparison partners — that's exactly where supersession happens (narrow clusters
  within *one* topic).
- **LLM pass** (injectable `StructuredCaller`, default `ANTHROPIC_MODEL`): input =
  the cluster items being compared **+ explicit deprecation signals from the source text**
  (changelog/"deprecated" notes). Output (zod):
  ```ts
  { supersededClusterId: number | null, supersededByClusterId: number | null, reason: string | null }
  ```
  Only a **grounded** comparison of the items at hand, **no** external fact-checking, no
  inventing (ADR 0003). When in doubt, `null`.
- **Apply conservatively:** the result sets `supersededByClusterId` + `supersedeReason` on the
  older cluster and **proposes** `lifecycle_state=deprecated` — not automatically hidden as
  active; confirmation/display is handled by T11.5 (human-in-the-loop).
- **Verification:** unit tests with a mocked caller: clear supersession → proposal set;
  unrelated topics → `null`.

### ☑ T11.4 — Propagation to referencing items
- `confidence`/`freshness` are cluster properties; derived views (ADR 0004) pull them in:
  saved reels, SOTA/overview entries, later skill nodes. A reel "inherits" its cluster's
  `confidence` and supersession notice.
- **Verification:** query test: a reel from a cluster with `deprecated`/`confidence` returns
  the cluster's values in the feed/saved/overview view.

### ☑ T11.5 — Display (confidence + "newer available")
- The stack card/cluster view shows `confidence` as a subtle badge (`few/some/strong`, separate
  from `quality_score`/`relevance_score`, ADR 0004). On superseded content, a notice
  "🕓 Newer available" with a link to the superseding cluster; a **confirm action** that
  actually sets `lifecycle_state=deprecated` (no auto-hide).
- **Verification:** curl — cluster shows the confidence badge; superseded item shows the
  notice + confirm; scores unchanged.

### ☑ T11.6 — Hook into pipeline/cron (cadence)
- Own step **after clustering** in `src/lib/pipeline.ts` (cron + admin button).
  Recompute `confidence` on every run (cheap, grounded); freshness comparison gated
  (only clusters with new members since the last `knowledge_checked_at`). Errors don't
  abort the run.
- **Verification:** integration test: after the run, `confidence` is set; a second run with
  no new members makes no repeated LLM freshness call.

### ☐ T11.7 — Experience Reports as corroboration (grilled 2026-07-24 → **ADR 0021**)

> **Design resolved.** The original one-liner assumed a report→cluster linkage that never
> existed. ADR 0021 settles it: **match-only** (a report joins an existing cluster, never
> creates one), bounded triggers, primary by construction, one distinct author = one voice.
> **The overclaim flag moved out of this task** to Epic 10 **T10.8** — it is a Verifier
> concern, not a Knowledge-Check concern (ADR 0021 decision 5). Read ADR 0021 before building.

#### ☐ T11.7a — Schema: `experience_reports.topic_cluster_id`
- Add `topicClusterId: integer("topic_cluster_id").references(() => topicClusters.id)`
  (nullable) to `experienceReports` in `src/db/schema.ts`. **No `is_primary` column** — reports
  are primary by construction (ADR 0021 decision 3). Migration via `drizzle-kit`.
- **Verification:** migration green; column defaults `null`; FK present.

#### ☐ T11.7b — Report→cluster matching (`src/lib/clustering/reports.ts`)
- **Match-or-null, never propose.** Do *not* reuse `clusterOutputSchema` unchanged — it requires
  the propose branch. Write a sibling schema/prompt: output `{ match_cluster_id: number | null }`,
  zod-validated, defensively rejecting ids outside the supplied candidate list (same guard as
  `runFreshnessCheck`).
- Injectable `StructuredCaller` (ADR 0015 executor seam — never call `callStructured` directly).
  Candidates: the same active-window cluster list `loadActiveClusters` already builds.
- Prompt: a report is a **subjective first-hand account**; match only if it is genuinely about
  the same narrow, specific topic as a candidate cluster. When in doubt → `null` (ADR 0003).
  State explicitly that most reports will legitimately match nothing.
- **Verification:** unit tests with a mocked caller — report clearly about an existing cluster's
  topic → matched; unrelated/practice-level report → `null`, no cluster created; model returning
  an id outside the candidate list → ignored.

#### ☐ T11.7c — Triggers: on-save + bounded daily backstop
- **On save:** fire-and-forget in `src/app/experience/create/route.ts`, exactly alongside the
  existing `tagSingle` call (same executor resolution, never blocks the form, never throws).
- **Daily sweep:** own step in `runPipelinePhases` after clustering, try/catch-guarded like
  every other step. **Candidate set is bounded** (ADR 0021 decision 2):
  `topic_cluster_id IS NULL AND created_at >= now() - CLUSTER_WINDOW_DAYS`. Without that bound
  the sweep never converges — unmatched reports would re-burn an LLM call every run forever.
- **Verification:** integration test — a fresh report inside the window is processed; a report
  older than `CLUSTER_WINDOW_DAYS` is **not** picked up; a matched report is not re-processed.

#### ☐ T11.7d — Corroboration: count reports in `confidence`
- Extend `computeConfidenceForActiveClusters` (`src/lib/knowledge-check/confidence.ts`) from a
  reels-only query to the **union of distinct reel `sources.name` and distinct report
  `author_label`** among a cluster's members (reels still filtered on `is_primary = true`;
  reports need no such filter). Unweighted — one distinct author, one voice.
- No eager recompute: `runKnowledgeCheck` already recomputes every active cluster each run.
- **Verification:** integration tests — 5 own reports (same `author_label`) on one cluster add
  exactly **1** to `independentCount`, not 5; a second distinct author adds a second voice;
  a cluster with 1 reel source + 1 report author scores `independentCount = 2`.

#### ☐ T11.7e — Show report members on the cluster page
- `getClusterWithMembers` (`src/lib/clusters.ts`) and `/clusters/[id]` currently list reel
  members only. Include linked reports, visibly labelled as experience reports (not sources),
  so the corroboration count is explainable to the reader.
- **Verification:** curl — a cluster with one reel and one report shows both, report clearly
  marked as such.

### ☐ T11.8 — External web corroboration (even later, its own decision)
- Active web search for supporting sources; sources found this way extend the corpus. Touches
  ADR 0001 → **own ADR/grill before building**. Documented here only as a placeholder.

---

## Configuration (new env vars, in `env.ts` + `.env.example` + README §4)
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `CONF_SOME_MIN` | no | `2` | from this many independent pieces of evidence ⇒ `some` |
| `CONF_STRONG_MIN` | no | `4` | from this many ⇒ `strong` |
| `KNOWLEDGE_CHECK_MODEL` | no | `ANTHROPIC_MODEL` | model for the freshness LLM pass |

## Completion criteria (epic DoD)
- Clusters get `confidence` (few/some/strong, counted in a grounded way) and, where
  applicable, a supersession **proposal**; both propagate into the views and are shown
  subtly, separate from the scores; deprecation only after confirmation (no auto-delete/
  hide); knowledge check as an idempotent pipeline step (cron + admin); `npm run build` +
  `npm test` green; no new libs; no ADR violation.

## Deviations/Questions
_(to be maintained by the executing model)_

**Status: T11.1–T11.6 built & tested (`npm run build` + `npm test` green, 260 tests).
T11.7 and T11.8 deliberately not built (see below) — checkboxes stay open.**

- **T11.7 (experience report corroboration) — deliberately deferred.** Checked before
  building: `experience_reports` has no `topic_cluster_id` column or any other
  cluster linkage, and Epic 15's clustering pass clusters exclusively `reels`, never
  `experience_reports`. T11.7's own text already hedged this with "(later via
  SkillTagger/cluster link)" — the linkage itself is undesigned. Building it would have
  meant inventing this linkage design (README §1 rule 3: no invented
  scope; rule 4: don't guess when unclear). So: `computeConfidenceForActiveClusters`
  in `src/lib/knowledge-check/confidence.ts` counts exclusively `reels` members;
  `experience_reports` stays untouched (no new column, no corroboration logic).
  Before T11.7 gets built, it needs its own grill: how/when does an experience report
  get a `topic_cluster_id` link (at SkillTagger time? its own
  match-or-propose pass? only loosely via `skill`?).
  > **✅ RESOLVED (grill 2026-07-24 → ADR 0021).** Answer: **its own pass, but
  > match-only** — a report may *join* an existing cluster, never create one
  > (otherwise subjective content would create clusters with no sourced members and
  > get `confidence` — breaking the ADR 0005/0007 boundary at the cluster level). "Only
  > loosely via `skill`" rejected: skills are broad, one skill spans multiple narrow
  > clusters (ADR 0013 point 3), so it's no basis for selection. Trigger: on-save +
  > daily sweep, **bounded by `CLUSTER_WINDOW_DAYS`** (without a bound the sweep never
  > converges). The overclaim flag is **out of T11.7** → Epic 10 **T10.8** (a Verifier
  > concern, needs no clustering). Task split is now T11.7a–e above.
- **T11.8 (external web corroboration)** — as marked in the epic file itself as a
  "placeholder": needs its own ADR/grill (touches ADR 0001, curated sources). Not built.

**Judgment calls in T11.1–T11.6 (most conservative interpretation chosen):**

- **T11.2 threshold mapping:** the epic text literally says "1 = few,
  CONF_SOME_MIN..CONF_STRONG_MIN-1 = some, >= CONF_STRONG_MIN = strong". This hardcodes
  "1" for "few", which would become inconsistent with an env configuration of
  `CONF_SOME_MIN=1` (and doesn't cover the theoretical `independentCount=0` case at all —
  currently can't occur, because the first member of a new cluster is always
  `is_primary=true` per ADR 0013 point 4, but the function should still not be
  wrong/undefined for it). Generalized in `confidenceForCount`
  (`src/lib/knowledge-check/confidence.ts`) to: `< CONF_SOME_MIN ⇒ few`,
  `CONF_SOME_MIN..CONF_STRONG_MIN-1 ⇒ some`, `>= CONF_STRONG_MIN ⇒ strong`. Identical to
  the epic text with the defaults (2/4); only behaves more consistently under a
  different env configuration.
- **T11.3 candidate pairing — the unit of comparison is the skill group, not the pair:**
  the epic text says "clusters that share a skill node are comparison partners"
  and the output schema is singular (`{ supersededClusterId, supersededByClusterId,
  reason }`, no array). Interpreted as: one LLM call per skill group (all clusters
  that, via their member reels, share the same `reels.skill` value), not one call per
  cluster *pair* — otherwise, with 3 clusters on the same skill node, the same
  information would be presented redundantly 3× (or n·(n-1)/2× for n clusters). The
  model sees all clusters in the group at once and returns at most one supersession
  statement per call. Model-invented ids outside the presented candidate group are
  defensively rejected (same principle as clustering's `match_cluster_id` guard, ADR 0003).
- **T11.3 link target for "newer available" (T11.5):** the epic text requires a "link to
  the superseding cluster", without assuming an existing cluster detail page. Since the
  deprecate route path itself already implies `src/app/clusters/[id]/deprecate/route.ts`,
  a minimal `src/app/clusters/[id]/page.tsx` (member list + confidence badge + its own
  supersession display where applicable) was added instead of just linking to the
  external source — that's the most natural, self-contained interpretation of "link to
  the items of the superseding cluster" without inventing additional scope (no new
  navigation/no new menu item, only the target page needed for the link).
- **T11.6 gating granularity:** "clusters with new members since `knowledge_checked_at`"
  is checked per cluster via `EXISTS (reels.created_at > topic_clusters.knowledge_checked_at)`
  (`loadDirtyClusterIds` in `src/lib/knowledge-check/run.ts`). A "dirty" cluster pulls its
  (possibly non-dirty) sibling clusters of the same skill node into the freshness
  comparison group too (the full comparison group is needed so the model has full
  context) — but a run with no dirty clusters at all makes globally zero LLM calls
  (verified in the integration test). `confidence` is recomputed independently of this,
  for all active clusters, on every run (cheap, no gating needed, as explicitly
  required by the epic text).
- **`KNOWLEDGE_CHECK_MODEL` fallback:** there is no existing pattern in `env.ts` for
  "optional, automatically falls back to another env value" at the schema level
  (`DEEPEN_MODEL` has its own hardcoded default, no reference to
  `ANTHROPIC_MODEL`). Therefore: `KNOWLEDGE_CHECK_MODEL` is optional/undefined in the
  schema (same "empty string = unset" preprocessing as `ANTHROPIC_API_KEY`/`ADMIN_TOKEN`),
  the fallback to `ANTHROPIC_MODEL` happens at the call site in
  `src/lib/knowledge-check/freshness.ts` (`knowledgeCheckModel()`), analogous to
  `callStructured`'s own `opts.model ?? env().ANTHROPIC_MODEL` pattern in
  `src/lib/claude.ts`.
