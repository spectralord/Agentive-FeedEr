# Epic 4 — Today's Top-N (MVP)

**Goal:** A "Today" view with the N (default 3) most important reels — the
anti-doomscroll: allowed to be done. Purely a derived view, no new data structure.

**References:** ADR 0004, glossary: Today's Top-N.

---

## Tasks

### ✅ T4.1 — Ranking (`src/lib/ranking.ts`)
```ts
// score ∈ [0,1]; freshness half-life ≈ 7 days
export function topScore(r: { relevanceScore: number; qualityScore: number; publishedAt: Date }, now = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - r.publishedAt.getTime()) / 86_400_000);
  const recency = Math.exp(-ageDays / 7);
  return (r.relevanceScore / 100) * (r.qualityScore / 100) * recency;
}
```
- **Verification (unit tests, exact):**
  - today, R100/Q100 ⇒ 1.0
  - 7 days old, R100/Q100 ⇒ ≈ 0.3679 (±0.001)
  - today, R50/Q80 ⇒ 0.4
  - ordering: fresh R70/Q70 beats 14-day-old R95/Q95.

### ✅ T4.2 — `/today` page
- Candidates: reels with `ingested_at` in the last 24h; if < N results ⇒ extend the
  window to 48h (then a hint line "incl. yesterday").
- Low-signal rule applies (QUALITY_THRESHOLD), top `env.TOP_N` by `topScore`.
- Presentation: same `ReelCard`s in the snap feed, header "Important today (N)" +
  date at the top; below the last card a closing card: "That's it for today ✅" with
  a link "Go to full feed".
- Empty state (also when 48h is empty): "Nothing important today — enjoy the calm."
- **Verification:** integration test of the candidate/fallback logic with seed data;
  manual look at the page.

### ✅ T4.3 — Navigation & default
- "Today" as the **navigation's starting point**, prominent leftmost/first position;
  the app route `/` stays the full feed (no redirect).
- **Verification:** nav order: Today · Feed · Overview.

---

## Completion criteria (epic DoD)
- `/today` deterministically shows the Top-N by formula; fallback and empty states
  work; ranking tests green.

## Deviations/Questions
_(to be maintained by the executing model)_

- **`src/lib/today.ts` (new file, not explicitly named in the epic file):**
  the candidate/fallback logic (24h → 48h, top-N by `topScore`) needs its own
  place outside the pure ranking function (`ranking.ts` deliberately stays
  pure) and outside the page itself, so that T4.2 is verifiable via
  integration test as required (not just manually) — analogous to
  `getReels()`/`feed.test.ts` from Epic 3. `src/app/today/page.tsx` now only
  calls `getTodayTopReels()` and renders. No new data structure, no new
  dependency — ADR 0004 stays intact (derived view over the same `reels`
  data).
- **`getReels()` extended** (`src/lib/feed.ts`) with the option
  `sinceIngested`, to reuse the `ingested_at` candidate filter instead of
  duplicating a parallel query construction. Existing filters/tests remain
  unchanged.
- **`export const dynamic = "force-dynamic"` on `/today`:** otherwise
  `next build` would have statically pre-rendered the page at build time
  (lacking `searchParams`/cookies/headers) and frozen a one-time DB snapshot —
  wrong for a time-window view (24h/48h relative to "now"). Without
  this fix, `/today` would never have updated again after the build. Verified:
  before the fix, `next build` showed `/today` as `○ (Static)`, afterward as
  `ƒ (Dynamic)`.
- **Verification "manually in Safari/iPad" replaced with `npm run build` +
  `npm run start -- -p 3200` + `curl`** (as in Epic 3, already documented there
  as a deviation). Additionally, the empty state was manually forced via a
  temporary `TRUNCATE` + reseed and checked via curl, since the seed data
  currently always yields candidates.
- Ordering of the top 3 for close score differences (e.g. seed item 2 vs.
  3, scores 0.1597 vs. 0.1554) is deterministic through the exact formula,
  not through additional tie-break rules — not a deviation from the epic
  text, just noted for traceability.
- **Nav order:** in `src/app/layout.tsx` swapped from Feed·Today·Overview to
  Today·Feed·Overview (T4.3); `/` remains unchanged as the route for
  the full feed, no redirect.
