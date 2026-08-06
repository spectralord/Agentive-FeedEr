# ADR 0022 — Retire the SOTA section; `/overview` becomes Archive

- Status: proposed (needs strong-model grill — removes a shipped Epic 5 feature).
  **Dependency clarified 2026-08-01:** ADR 0018 (Skill Guides) is now **accepted**, so this ADR is
  no longer waiting on a *decision*. But decision 1 below gates retirement on Guides having
  **shipped**, and ADR 0018 decision 6 gates *its* build on a corpus that does not exist yet — so
  this remains blocked, one step further out than it looks. Do not retire SOTA before
  Guides are live and demonstrably carrying the comparative load SOTA carries today.
- Date: 2026-07-24
- Related: ADR 0004 (derived labels — this ADR does **not** overturn it), Epic 5 (`/overview`),
  ADR 0011/0012 (verifier, topic-knowledge-check), ADR 0018 (Skill Guides — the replacement)
- Design context: `docs/specs/2026-07-24-ux-gamification-design.md` §10.5

## Context / Problem

`/overview` has two halves: a **SOTA section** ("⭐ Current State of the Art", grouped by
category) and a **History list** (filterable chronological archive).

The SOTA half rests entirely on `isSota()`:

```ts
maturity === "established" && relevanceScore >= 70 && qualityScore >= 70
```

That is a **per-reel threshold filter with no notion of a topic and no comparison to anything.**
"State of the art" is inherently comparative and topical — *the current best answer for X,
superseding older answers.* What this computes is "well-scored established item", then labels it
SOTA.

Two symptoms confirm the gap rather than merely suggesting it:

1. It is **age-independent by explicit design** (an Epic 5 requirement). That is exactly why Epic
   11's freshness/supersession machinery had to be built — to stop stale items sitting in the
   SOTA list wearing a ⭐. The label needed an external correction mechanism because it cannot
   express currency itself.
2. The UI must **group by `category`** (6 coarse buckets) to fake a topical dimension the label
   does not have. The grouping is doing work the predicate cannot.

Meanwhile ADR 0018's Skill Guides are topical and comparative *by construction*: synthesised per
skill node from everything tagged to it, re-synthesised as new content arrives, carrying
`synthesised_at`, and — with the change-diffs in design doc §9.7 — able to show what actually
moved since you last read. **The Guide is what the SOTA section was trying to be.**

## Decision (proposed)

1. **Retire the SOTA section from `/overview` — but only once Skill Guides ship.** It is
   currently the only surface answering "what is the current best thinking on X", and removing it
   before its replacement exists would be a straight regression. Sequencing is part of this
   decision, not an implementation detail.

2. **Keep the History half; it is not superseded.** History is *retrieval* — "find the thing I
   saw three weeks ago" — which Guides do not do at all. It is renamed **Archive**, moves into the
   Library hub (ADR 0023), and becomes the home for the **search** the app currently lacks
   entirely.

3. **`isSota()` itself is not deleted outright.** It stays available as a *filter* in Archive
   alongside `isBestPractice`. As a filter chip ("established, high-scoring") the predicate is
   honest about what it actually computes; it is the framing as an authoritative **section titled
   State of the Art** that overclaims.

4. **ADR 0004 stands unchanged.** Derived-labels-over-stamped-tags remains correct — this ADR does
   not reintroduce stored labels. It narrows *one* derived label's presentation from "a section
   that asserts currency" to "a filter that describes attributes."

## Alternatives

- **Keep SOTA as-is alongside Guides:** two surfaces answering the same question with different
  and sometimes contradicting answers (a threshold-passing reel vs. a synthesis that may have
  moved past it). Worse than either alone. Rejected.
- **Fix `isSota` to be comparative** (e.g. rank within a topic cluster, prefer newer members):
  possible, but it would be reimplementing a weaker version of the Topic-Knowledge-Check (ADR
  0012) and the Guide synthesis, in a predicate that has no access to cluster context. Rejected —
  the comparative machinery already exists elsewhere and should not be duplicated in a label.
- **Retire SOTA immediately, before Guides land:** simpler, but leaves a real capability gap for
  however long Guides take. Rejected in favour of the sequencing in point 1.

## Consequences

- `SotaSection.tsx` and `groupSota()` are removed once Guides ship; `isSota` moves to filter-only
  usage. `/overview` becomes `/archive` (route rename, one nav entry moved into the Library hub).
- Archive gains search — a new capability, currently absent app-wide.
- Anything relying on SOTA framing must migrate to Guides; nothing in the pipeline does today
  (`isSota` is display-side only, per ADR 0004), so the blast radius is UI-only.
- Some content becomes unreachable via the "best of" framing: reels with `skill = null` have no
  Guide. Judged acceptable — an untagged reel is not "state of the art in a competency" — but it
  is a real coverage difference and should be watched after Guides land.

## Open questions

- Should Archive's search be plain SQL `ILIKE` over title/summary (cheap, no new dependency, good
  enough at single-user data volumes) or something better? Leaning `ILIKE`; anything more is a
  new dependency for a problem we do not yet measurably have.
- Does the Knowledge Base view (design doc §9.6) fully cover the cross-topic "best of everything"
  scan that SOTA offered, or is a ranked all-nodes view worth adding there? Worth checking against
  real use once both exist rather than deciding now.
