# ADR 0028 — Curator inbox: an approval gate between enrichment and the visible feed

- Status: **proposed — FLAGGED FOR A DESIGN SESSION** (owner idea, 2026-08-02). Not grilled, not
  designed. This file records the idea and the questions it raises so it is not re-derived from
  scratch. **Do not build from this file.**
- Date: 2026-08-02
- Design tier: **ADR 0014 tier 2 (UX/gamification)** with a tier-1 (product/architecture) component —
  it adds a lifecycle state to content *and* a new surface, so it likely needs both a design-expert
  session and a strong-model grill.
- Related: ADR 0003 (structured single-pass enrichment — the scores this surface would explain),
  ADR 0004 (derived labels over stamped tags — **in tension**, see below), ADR 0010 (admin console:
  the existing operator surface), ADR 0011 (verifier/`caveat` — an adjacent "flag for human
  attention" mechanism), ADR 0013 (clustering), ADR 0001 (curated sources)

## The idea (owner, 2026-08-02, verbatim intent)

A **curator mask/feed** showing all newly-arrived feeds, Reels and content, with:

1. the **date each was added**,
2. a **short explanation of why that relevance and quality level was chosen**,
3. the ability to **manually override** those judgements,
4. an explicit **confirm/approve** step that promotes the item into the visible feeds.

Until approved, items live in a **separate temporary location** rather than the main feed.

## Why this is not a small feature

Two of the four parts do not exist in any form today. Verified against the code on 2026-08-02:

**There is no rationale for the scores.** `reelOutputSchema` (`src/lib/enrichment/schema.ts:15-33`)
emits `summary`, `category`, `maturity`, `experimental`, `relevance_score`, `quality_score`,
`example`, `action`, `effort_tag`, `skill_hint` — **and no reason field of any kind.** Requirement 2
therefore needs the enrichment prompt and schema extended to emit a justification, which changes
ADR 0003's single-pass output contract and adds output tokens to every item. It cannot be
back-filled for existing Reels without re-running enrichment over them.

**There is no approval state.** Visibility today is a pure computed threshold —
`quality_score >= QUALITY_THRESHOLD` applied at read time in `getReels`
(`src/lib/feed.ts:196`, default 60 via `src/lib/env.ts:16`). Nothing is "pending"; there is no
holding area, and no notion of an item having been seen-and-accepted by a human. Requirement 4 adds
a genuine **lifecycle state** to Reels.

The other two parts are cheap by comparison: `reels.created_at` already exists (requirement 1), and
manual override (requirement 3) is a mutation over columns that already exist.

## Two feedback moments, not one (owner, 2026-08-02)

The idea has **two distinct surfaces**, and separating them resolves several of the questions below:

| | **Pre-publication queue** | **Post-publication input** |
|---|---|---|
| When | Before an item is visible | On content already in the feed |
| Scope | **Per registered curator** — each has their own queue | Shared, on live content |
| Act | Approve / override / reject | Rate, correct, comment |
| Blocks visibility? | Yes, for that curator | No |

This is what makes **T7 composable with T8 rather than a duplicate of it**. T7 supplies *who* is
giving input (registered curators with differing trust); T8 supplies *when* — before or after
publication. Multiple curators can then give feedback on the same item, and their judgements can be
weighted by T7's trust model rather than treated as one anonymous voice.

**It also defuses the "curator is away" problem** (question 3 below): if queues are per-curator, one
absent curator does not starve anyone else's feed. In the current single-user reality there is
exactly one queue, so the risk remains until a second curator exists — but the design does not bake
the failure in.

**Consequence for sequencing:** the post-publication surface is **much cheaper** and independent. It
needs no lifecycle state, no rationale back-fill, and no holding area — it is feedback on content
that already exists, and `src/lib/feedback/run.ts` is the natural seam. The pre-publication queue is
the expensive half. They should be scoped as separate deliverables, and the cheap one can ship first.

## Open questions for the design session

**Product / architecture (tier 1):**

1. **Does this contradict ADR 0004 ("derive labels from facts, don't stamp them")?** That ADR
   deliberately chose computed views over stored human judgements. A stored manual override *is* a
   stamped label. This is resolvable — an override is arguably a *fact* about what the curator
   decided, not a derived label — but it must be argued explicitly and ADR 0004 amended if so.
2. **Does an unapproved item block the pipeline?** SkillTagger, clustering and the knowledge-check
   all run over Reels today. Do they run on unapproved items, or wait? Waiting means the corpus
   stalls behind the curator; not waiting means clusters and skill nodes can reference content the
   user has never seen.
3. **What happens when the curator never shows up?** A single-user tool where the one user is busy
   for two weeks: does the feed simply go empty? An approval gate converts "signal over noise" into
   "nothing at all" during absence. Consider auto-approval after N days, or approval as an *opt-in*
   mode rather than the default path.
4. **Is the override a one-off edit, or does it teach anything?** A curator repeatedly raising
   scores for one source is a signal about that source. Feeding overrides back (into the profile,
   or source-level weighting) is a much larger feature — but not doing it means the same correction
   is made forever. `feedback/run.ts` already exists and is the natural seam.
5. **Scope: Reels only, or sources too?** The idea says "feeds and reels and contents". Approving a
   *source* is a different act from approving an *item* and probably belongs with Epic 14 (source
   health, parked).
6. **Relationship to the existing admin console (ADR 0010).** Admin is already the operator surface
   and already lists sources and pipeline runs. Is this a new tab there, or a first-class
   destination? Note **ADR 0023's binding rule: new surfaces go into a hub, never onto the tab bar**
   (which is a fixed four), and ADR 0023 decision 2 deliberately moved Admin *out* of primary
   navigation.

**UX (tier 2):**

7. **How much explanation is useful?** A one-line justification per score is cheap to generate and
   easy to skim; a paragraph is neither. This interacts with how many items arrive per day.
8. **What is the review unit?** One item at a time (thorough, slow) or a scannable list with bulk
   approve (fast, but then the explanation goes unread and the feature's premise collapses)?
9. **Where does the "temporary location" live, and does it show a count?** An unbadged holding area
   is one nobody visits.

**Cost:**

10. Generating a rationale for every enriched item raises per-item output tokens on the **default**
    path. Under `APP_PROFILE=local` that is subscription quota rather than money (ADR 0024), but it
    is not free.

## What this ADR deliberately does not decide

Everything. This is a captured idea with its questions enumerated, per the ADR 0014 rule that an
idea worth building is worth grilling first. The next step is a design session, not an epic plan.
