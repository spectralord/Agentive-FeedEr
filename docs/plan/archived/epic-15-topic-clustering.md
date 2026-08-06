# Epic 15 — Topic clustering (foundation)

> **Status: DESIGN GRILLED (2026-07-23), implementation open.** Precursor foundation,
> promoted from vision backlog V1 (content model C), because the topic knowledge check
> (Epic 11) and content bundling build on top of it.

**Goal:** Group reels (and later experience reports) that cover **the same specific
topic** into **topic clusters** — the basis for content bundling
(content model C) as well as `confidence` and `freshness` (Epic 11).

**References:** ADR 0013 (core — clustering design), ADR 0009 (match-or-propose,
pattern template), ADR 0012 (topic knowledge check builds on this), ADR 0008 (layers),
ADR 0004 (derived views). Content model C (design doc 2026-07-21),
vision backlog V1. Glossary: topic cluster.

## Motivation
- The reserved field `reels.topic_cluster_id` has existed since Epic 2, but is unused.
- The feed feels repetitive with multiple sources on the same topic (original grill concern C).
- Corroboration/freshness (Epic 11) need "multiple sources for one claim" — that *is* a cluster.

---

## Grilled decisions (2026-07-23)

1. **Cluster formation = match-or-propose against *active* clusters** (pattern like
   SkillTagger, ADR 0009): each new reel looks, within a time window, for the closest
   existing cluster (**match**) or proposes a new one (**propose**). Stable over time,
   no re-rolling per run, LLM context stays bounded. Embeddings are a later
   scaling seam, **not MVP**.

2. **Granularity = narrow / feature- or story-specific.** A cluster bundles content
   about *one concrete thing and its usage* (the user's example: "the batch command
   & its usage"), **not** at the generic skill level. This keeps the corroboration
   count honest (multiple independent sources for the *same specific* claim).

3. **The broad thematic level = the skill node (Epic 12), not a separate cluster type.**
   A reel has (a) one **narrow topic cluster** (Epic 15) *and* (b) is attached to one or
   more **skill nodes** (Epic 12, via the SkillTagger). These are the two "peer sets":
   **narrow** for corroboration/freshness, **broad** for the thematic knowledge/browsing
   view. Epic 15 therefore only builds **the one narrow cluster type**; no two-tier
   cluster hierarchy. (Example: narrow cluster "batch command", skill node "parallelization".)

4. **Source independence = an `is_primary` signal per cluster member, deliberately
   coarse.** For later corroboration, what counts isn't the raw number of cluster
   members but the **independent** ones among them. Epic 15 records a simple
   `is_primary` per reel in the cluster: **first-hand/original** (official primary
   source, own test, experience report) ⇒ `true`; a recognizable **retelling/reblog**
   of another cluster member (links to it / repeats it without own observation) ⇒
   `false`. The actual `confidence` is computed from this by **Epic 11** — as a
   **coarse scale (few/some/strong)**, so that misclassifications in echo detection
   barely matter.

### MVP cut (what Epic 15 itself builds vs. Epic 11)
- **Epic 15 (this epic):** schema (`topic_clusters` + `reels.is_primary` + activating
  `topic_cluster_id`), match-or-propose pass incl. the `is_primary` judgment, pipeline
  hookup, feed bundling as a stack card ("N sources on this topic").
- **Epic 11 (after this):** `confidence` (few/some/strong from `is_primary`), freshness/
  supersession, propagation to referencing items, corresponding display.

---

## Tasks

### ✅ T15.1 — Schema: `topic_clusters` + `reels.is_primary` + activate `topic_cluster_id`
```ts
export const topicClusters = pgTable("topic_clusters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),                 // short, specific cluster title (LLM-assigned)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastMatchedAt: timestamp("last_matched_at", { withTimezone: true })
    .notNull().defaultNow(),                       // for the "active window" of match candidates
});
```
- `reels`: bind the existing `topicClusterId` via FK to `topic_clusters(id)` (stays
  nullable) and a new field `isPrimary boolean` (nullable — set by the clustering pass;
  `null` = not yet clustered).
- Migration via `drizzle-kit`. **Verification:** migration green; new fields default `null`
  or `lastMatchedAt` defaults to now; FK present.

### ✅ T15.2 — Cluster assignment (`src/lib/clustering/run.ts`): match-or-propose
- Own module with an **injectable `StructuredCaller`** (pattern like enrichment/SkillTagger),
  model configurable (default Haiku, `ANTHROPIC_MODEL`).
- **Candidates:** active clusters with `lastMatchedAt` within `CLUSTER_WINDOW_DAYS`,
  capped at `MAX_CLUSTER_CANDIDATES` (title as context).
- **Input per reel:** title + summary + `source` name of the new reel **+** candidate
  clusters (id + title) **+** brief info about sources already in the cluster (for `is_primary`).
- **Output (JSON schema, zod-validated):**
  ```ts
  { matchClusterId: number | null, newClusterTitle: string | null, isPrimary: boolean }
  ```
  Exactly one of `matchClusterId` / `newClusterTitle` is set (match **or** propose,
  ADR 0009). `isPrimary`: an original/first-hand statement vs. retelling a cluster member.
- **Semantics:** on match → attach the reel to the existing cluster, set its
  `lastMatchedAt` to now. On propose → create a new cluster, assign the reel, `isPrimary`
  is usually `true` (the first member is primary by definition).
- **Gated:** only process reels that are actually displayed (`quality_score ≥ QUALITY_THRESHOLD`
  or relevance-relevant) and that don't yet have a `topic_cluster_id`. Idempotent.
- **Don't invent anything** (ADR 0003): when in doubt, propose a new cluster instead of
  falsely matching; when in doubt, `isPrimary` is `true` (conservative — better to count
  as original than to hide an echo).
- **Verification:** unit tests with a mocked caller: (a) reel fits an existing cluster
  → assigned; (b) new topic → new cluster; (c) reblog of a member → `isPrimary=false`.

### ✅ T15.3 — Hook into the pipeline
- As its **own step after enrichment** (and after the SkillTagger, once Epic 12 is in
  place) in `src/lib/pipeline.ts` (`runPipelinePhases`), so that cron **and** the admin
  button both run it. Clustering errors do **not** abort the run (try/catch per reel,
  log a summary). Idempotent ("only reels without a `topic_cluster_id`").
- **Verification:** integration test: new reels → after the run, `topic_cluster_id` +
  `isPrimary` are set; second run processes 0.

### ✅ T15.4 — Feed: bundling as a stack card
- The feed query groups displayable reels by `topic_cluster_id`. Clusters with **≥ 2**
  reels appear as **one stack card**: cluster title, "N sources on this topic",
  the **primary** reel on top (`isPrimary=true`, otherwise the newest), the rest
  expandable. Reels without a cluster (or a solo cluster) still appear as a single card
  as before.
- Additive to existing feed mechanics (hide/scores/`caveat`): a hidden (`hide`)
  source doesn't count toward the stack; if a stack shrinks to 1, it becomes a single card again.
- **Verification:** curl against `npm run start` — a cluster with N reels shows a stack
  card with "N sources"; expanding shows members; primary on top; solo reels unchanged.

### ✅ T15.5 — Cluster display polish (small)
- The stack card shows the **source names** of the members (transparency about which
  sources). **No** `confidence` badge here — few/some/strong comes in Epic 11; Epic 15
  only shows the raw source count + names.
- **Verification:** curl — source names visible, no confidence semantics anticipated.

---

## Configuration (new env vars, in `env.ts` + `.env.example` + README §4)
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `CLUSTER_WINDOW_DAYS` | no | `30` | "Active window": only clusters with `last_matched_at` within it are match candidates |
| `MAX_CLUSTER_CANDIDATES` | no | `40` | Cost/context guard: max. candidate clusters per reel prompt |

(Model = `ANTHROPIC_MODEL`, default Haiku — no dedicated key needed.)

## Completion criteria (epic DoD)
- Reels get `topic_cluster_id` + `isPrimary` during the pipeline run (or stay `null`
  if not displayable); match-or-propose gated + idempotent; feed shows stack cards
  ("N sources"); no `confidence` semantics anticipated; `npm run build` + `npm test` green;
  no new libs; no ADR violation.

## Deviations/Questions
_(to be maintained by the executing model)_

- **`.env.example` doesn't exist in the repo** (never created, even though README §4
  references it — presumably leftover from earlier epics). Conservative choice: not
  recreated, to avoid inventing scope beyond clustering; the two new vars are instead
  documented in `src/lib/env.ts` (zod, with defaults) and in `docs/plan/README.md` §4.
- **`is_primary` on propose is always forced to `true`**, regardless of what the model
  returns in the `is_primary` field (`src/lib/clustering/cluster.ts`'s `toResult`: the
  propose branch doesn't consult that field at all). Rationale: "the first member is
  primary by definition" (epic text) is unambiguous — on propose there is no other
  cluster member yet that a reblog could come from, so any other answer would be a
  contradiction in itself. The most conservative, most unambiguous reading, rather than
  trusting the model's judgment here.
- **Active candidate clusters are updated live within *one* run**
  (`runClustering` keeps an in-memory copy that gets updated immediately on every
  match/propose), so that a cluster just proposed within this run is already visible
  as a match candidate for a *later* reel in the same run. Necessary so that multiple
  new sources on the same, brand-new story within one pipeline run correctly land in
  one cluster instead of each opening its own (otherwise the epic's central purpose —
  corroboration across multiple sources — would be systematically undermined by
  same-run duplicates). Side effect: `MAX_CLUSTER_CANDIDATES` can therefore be
  transiently exceeded slightly within a single run (only by clusters newly created
  within that run); at MVP data volume (default `MAX_ENRICH_PER_RUN = 100`) judged
  non-critical. The cap still fully applies to clusters loaded from earlier runs.
- **T15.5 is already fully satisfied by T15.4**, with no additional code: the single
  `ReelStackCard` component was built from the start with both requirements (source
  names of all members in the expandable list incl. primary marking; no
  confidence/few-some-strong text whatsoever). No meaningful separate code-change
  commit was possible — T15.5 was instead checked off with its own, code-less
  documentation commit (checkbox + this note), verification via curl against the
  state already built in T15.4.
- **The clustering gate only checks `quality_score >= QUALITY_THRESHOLD`**, not
  additionally the `hide` interaction status — the epic text explicitly names only
  "displayed (quality_score ≥ QUALITY_THRESHOLD or relevance-relevant)" as the gate
  criterion for the clustering *pass*. A hidden (`hide`) reel therefore still gets
  clustered (gets a `topic_cluster_id`), but thanks to the existing `getReels()` hide
  filter still doesn't count toward the visible stack in the feed — the "doesn't show
  up in the stack" requirement is satisfied purely via the feed query/grouping (T15.4),
  not via an additional block in the clustering pass itself.
- **The stack card's action bar (save/up/down/hide) only affects the primary reel** —
  as with a solo card. The other members have no action bar of their own in this epic
  (the epic text only requires "transparency about which sources" for the member list,
  no interaction). Clicking "Hide" on the primary reel removes the whole stack card
  from the view immediately client-side; server-side, the remaining members stay
  unchanged and appear correctly on the next load (as a solo card, if only one is left
  — see `groupReelsForFeed`).
- **Epic 15 only processes reels**, no experience reports — matching the epic text
  "reels (and later experience reports)" (explicitly deferred, not MVP scope).
