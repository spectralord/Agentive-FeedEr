# Epic 5 — Overview / SOTA / History (near-MVP)

**Goal:** An overview page that shows "what is currently state of the art" —
age-independent — plus a history with filters by time range, category, relevance.
All derived views over the same reels.

**References:** ADR 0004 (derived labels — core of this epic), glossary: label.

---

## Tasks

### ✅ T5.1 — Label logic (`src/lib/labels.ts`)
One function per label, pure functions, centralized and tested — **duplicate
label logic nowhere else** (switch ReelCard from Epic 3 over to these functions):

```ts
export const isNew = (r, now = new Date()) =>
  r.publishedAt > new Date(now.getTime() - env.NEW_DAYS * 86_400_000);

export const isSota = (r) =>
  r.maturity === "established" && r.relevanceScore >= 70 && r.qualityScore >= 70;

export const isBestPractice = (r) =>
  r.maturity !== "experimental" && r.action !== null && r.qualityScore >= 70;
```
- `isSota` is deliberately **age-independent** (that was the explicit requirement).
- **Verification:** unit tests incl. boundary values (score 69/70, maturity variants).

### ✅ T5.2 — `/overview` page: SOTA section
- At the top: "⭐ Current state of the art" — SOTA reels grouped by category,
  within each group sorted by `relevanceScore * qualityScore` (not by date!),
  max. 5 per category, compact list display (title, summary 1st sentence, date, link
  → jumps to the card in the feed via `/?category=…`).
- **Verification:** an old reel (> 30 days) with high scores appears in SOTA. ✅ Confirmed
  against `scripts/seed-dev.sql`: "Seed Item 13" (39 days old, established, R94/Q98) appears
  as the only SOTA reel under category "Technique", link points to `/?category=technique`.

### ✅ T5.3 — `/overview` page: history with filters
- Below that: a chronological compact list (no snap — normal scroll list) with a
  filter bar: time range (7/30/90 days/all), category, maturity,
  min relevance (slider or steps 0/50/70), checkbox "best practice only",
  checkbox "🧪 show experimental" (default: on).
- State again purely via searchParams; reuse the FilterBar building blocks
  from Epic 3 where it makes sense.
- **Verification:** filter combinations against seed data; older, highly relevant items
  are specifically findable via time range "all" + min relevance 70. ✅ Confirmed via curl
  against `npm run start -p 3200` after reseeding — see Deviations for the checked URLs
  and expected/observed results.

---

## Completion criteria (epic DoD)
- Label logic exists exactly once (`labels.ts`) and is used by the feed **and** the
  overview; SOTA is demonstrably age-independent; history is filterable.

## Deviations/Questions
_(to be maintained by the executing model)_

- **`showWeak: true` for the SOTA query:** the global `QUALITY_THRESHOLD` floor of
  `getReels` (default 60) is a feed-specific simplification (Epic 3, "hide weak
  signal"). `isSota` already has its own, stricter quality threshold (≥70),
  so the SOTA candidate set is fetched with `showWeak: true`, to make sure that
  no potential SOTA reel gets lost due to the feed floor.
- **`getReels` extension instead of a new query function (T5.3):** the history needed
  filters that `getReels` didn't yet know about (`maturity`, `minRelevance`, `publishedAfter`,
  `excludeExperimental`). These were added as additional, purely factual
  `GetReelsOptions` fields in `src/lib/feed.ts` (no new query module, no
  duplication of the existing filter logic). The **label logic itself**
  (`isBestPractice`) explicitly does **not** run in SQL, but as a JS filter over the
  results of `getReels`, reusing `src/lib/labels.ts` — this way label logic stays
  in exactly one place (ADR 0004 / DoD).
- **`showWeak: true` for the history too:** for the same reason as with SOTA —
  the task specifies that the history should be controlled explicitly via its own,
  visible filters (min relevance, maturity, best practice, experimental), not via a
  hidden quality floor from the feed. A conservative, documented interpretation — easy
  to switch to a visible history toggle later if needed.
- **The "🧪 show experimental" checkbox refers to the stored `experimental` flag**,
  not to `maturity === "experimental"` (two distinct facts per ADR 0004 —
  `maturity` is a maturity-level classification, `experimental` is the separately
  stored flag that also drives ReelCard's 🧪 badge). Default on = flagged reels are
  shown; `experimental=0` in the URL hides them.
- **No infinite scroll/"load more" in the history:** both overview queries fetch up
  to 1000 reels at once (`FETCH_LIMIT` in `src/app/overview/page.tsx`), analogous to
  the `CANDIDATE_LIMIT` pattern from Epic 4 (`src/lib/today.ts`). Sufficient for
  MVP data volumes; under significant growth the history would need its own cursor
  pagination like the feed (`before`) — not required by the epic, hence not built.
- **Time-range boundary inclusive (`gte`), unlike `onlyNew`'s exclusive (`gt`):** for the
  history's time-range steps (7/30/90 days), `publishedAfter` was implemented with `gte`
  against `published_at` (in contrast to the feed's own, NEW_DAYS-specific
  `onlyNew`, which strictly uses `gt`). Both boundary semantics are plausible for their
  respective use cases; since the epic doesn't prescribe an exact boundary semantic, the
  simplest/most predictable one was chosen ("day X is still within the window").
- **New overview components** (`src/components/OverviewFilterBar.tsx`,
  `src/components/HistoryList.tsx`): FilterBar from Epic 3 has a different filter set
  (category/new/weak) and wasn't reused directly, but its pattern
  (URL state, `buildXHref`, chip styling) was carried over 1:1 — as intended
  in T5.3 ("reuse the FilterBar building blocks where it makes sense").
- **No dedicated page test for `src/app/overview/page.tsx`:** as with `/` (Epic 3) and
  `/today` (Epic 4), the server-component page itself stays untested (async DB access);
  instead there are unit/render tests for the extracted components (`SotaSection.test.tsx`,
  `HistoryList.test.tsx`, `OverviewFilterBar.test.tsx`) plus manual curl verification.
- **Curl verification (after reseeding via `scripts/seed-dev.sql`, `npm run start -p 3200`):**
  - `GET /overview` → SOTA shows exactly "Seed Item 13" (established, R94/Q98, 39 days
    old, category Technique) under "Technique", link `/?category=technique`; history shows all 14
    items newest first.
  - `GET /overview?period=7` → history exactly {Seed Item 0, 1, 2} (0/3/6 days old).
  - `GET /overview?minRelevance=70` (time range implicitly "all") → history exactly
    {Seed Item 4, 5, 6, 11, 12, 13} — R∈{75,86,97,72,83,94}, age up to 39 days: confirms
    the required "older, highly relevant items via time range all + min relevance 70" search.
  - `GET /overview?category=tooling` → history exactly {Seed Item 0, 6, 12}.
  - `GET /overview?maturity=established` → history exactly {Seed Item 1, 4, 7, 10, 13}.
  - `GET /overview?bestPractice=1` → history exactly {Seed Item 3, 7, 13}.
  - `GET /overview?experimental=0` → history 12 items, excl. {Seed Item 4, 9} (the two with
    the `experimental` flag set).
  - `GET /overview?category=technique&maturity=established` (combination) → history exactly
    {Seed Item 1, 7, 13}.
  - Regression check: `/` still shows 🆕 new badges, `/today` still returns 200.
