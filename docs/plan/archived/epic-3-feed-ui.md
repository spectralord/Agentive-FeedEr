# Epic 3 — Reel feed UI (MVP)

**Goal:** Vertical, mobile-first scroll-snap feed of reels (iPad is the
reference device), with basic filters and a low-signal toggle.

**References:** ADR 0004 (labels = filters), glossary: feed, reel, label.

---

## Tasks

### ☑ T3.1 — Data access (`src/lib/feed.ts`)
- `getReels(opts: { before?: Date; category?: string; onlyNew?: boolean; showWeak?: boolean; limit?: number })`
  → join `reels` + `raw_items` (+ `sources.name`), sorted `published_at DESC`,
  default limit 50.
- Filter logic:
  - Default: `quality_score >= env.QUALITY_THRESHOLD`; `showWeak` lifts that.
  - `onlyNew`: `published_at > now() - env.NEW_DAYS`.
  - `category`: exact match.
  - `before`: cursor for "load more" (older items).
- **Verification:** unit/integration tests of the filter combinations against seed data.

### ☑ T3.2 — ReelCard component (`src/components/ReelCard.tsx`)
Structure of a card (full viewport height):
1. Header line: source name · relative date ("2 days ago").
2. Badges: category, maturity, `🧪 experimental` (only if flagged), derived
   `🆕` badge (published < NEW_DAYS — display logic, not stored!).
3. Title (from raw_item) + summary.
4. If `example`: monospaced block with heading "Example (from the source)".
5. If `action`: highlighted line "➜ For you:" + text + effort-tag chip
   (`5-min test` / `An afternoon` / `Just know it`).
6. Footer: source link (opens a new tab) · subtle score display (`R 82 · Q 74`).
- **Verification:** render test with a full reel and a minimal reel (all nullables null).

### ☑ T3.3 — Scroll-snap feed (`src/app/page.tsx`)
- Server component loads via `getReels` (searchParams → filter).
- Layout:
```css
.feed { height: 100dvh; overflow-y: auto; scroll-snap-type: y mandatory; }
.reel { min-height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; }
```
- `100dvh` (not `vh`) because of iOS/iPadOS browser bars; the card content itself
  is scrollable (`overflow-y:auto` inside the card) if it's taller than the viewport.
- Empty state: friendly note + pointer to `npm run job:daily`.
- **Verification:** manually in Safari simulation (responsive mode, iPad size):
  clean snapping per card, no horizontal scrolling.

### ☑ T3.4 — Filter bar (`src/components/FilterBar.tsx`)
- Compact, horizontal chip bar (fixed at the top, semi-transparent):
  category chips (from the enum), chip "🆕 New", toggle "show weak signal".
- State purely via URL searchParams (`?category=`, `?new=1`, `?weak=1`,
  `?before=`) — no client-state library.
- **Verification:** every filter combination is shareable/bookmarkable as a URL and loads correctly.

### ☑ T3.5 — "Load more"
- Below the last card, a button "Load older" → same route with
  `?before=<publishedAt of the last card>` (server-side, no infinite-scroll JS).
- **Verification:** page through two pages, no duplicates/gaps.

---

## Completion criteria (epic DoD)
- Feed on iPad (or simulation) snaps smoothly vertically; filter + toggle + cursor
  work purely via URL; low signal hidden by default, never deleted.
- Build + tests green.

## Deviations/Questions
_(to be maintained by the executing model)_

- **Verification method instead of "manually in Safari/iPad":** as prescribed in
  this model's task, the manual simulation was replaced with
  `npm run build` + `npm run start -- -p 3200` + `curl` against the rendered
  HTML structure. Checked: the `.feed` container carries `h-dvh snap-y
  snap-mandatory overflow-y-auto overflow-x-hidden`, each card
  `min-h-dvh snap-start [scroll-snap-stop:always]`, the card content itself
  `h-dvh overflow-y-auto` (scrolls internally if taller than the viewport). No
  automated cross-browser/touch test was possible — on real
  iPad/Safari access, the snapping should still be visually
  double-checked once.
- **`getReels` signature:** exactly as specified in the plan (`getReels(opts)`,
  no injectable `db` parameter like `runEnrichment`/`runIngestion`),
  because the plan text prescribes the signature verbatim. Tests seed via
  `db()` directly (same singleton pool) — works identically.
- **Unknown `category` value in the URL:** silently ignored (filter
  doesn't apply, no error, no empty list) instead of e.g. throwing 400 —
  the most conservative interpretation, since the plan doesn't specify anything
  about it and chips in the FilterBar only ever produce valid values anyway.
- **No render-test framework (no `@testing-library/react`, no jsdom):**
  since `vitest.config.ts` uses `environment: "node"` and no new
  dependencies are allowed, `ReelCard` and `FilterBar` are rendered via
  `renderToStaticMarkup` from the already-present `react-dom` and the HTML
  output is checked for expected fragments (full/minimal reel
  for T3.2, active/inactive chips + hrefs for T3.4). Covers the required
  verification without introducing new libraries.
- **Additional files outside the three named in the plan:**
  `src/lib/relativeTime.ts` (+ test) for "2 days ago" formatting and
  `src/components/labels.ts` for the category/maturity/effort labels
  (shared by `ReelCard` and `FilterBar`). Pure helper modules with no
  new dependencies, no scope beyond T3.1–T3.5.
- **"Load more" only visible on a full result:** the button appears only
  when `reels.length === DEFAULT_FEED_LIMIT` (50), as a cheap signal
  that older items might exist. With the 12 seed reels this is never
  the case; the cursor logic itself was separately verified end-to-end via
  `curl` with a manually set `?before=` parameter against the running server
  (see completion report), as well as by a dedicated multi-page test in
  `src/lib/feed.test.ts` (T3.1) with `limit: 2`.
- **Seeded test reels deleted and re-created by integration tests:**
  as anticipated in the environment facts, the integration tests
  (`feed.test.ts`, plus the already-existing ingestion/enrichment tests)
  TRUNCATE `reels`/`raw_items`/`sources`. The original 12 seed reels/20 raw
  items were removed by this. For the HTML verification they were
  re-created via a temporary, non-committed script (`tmp-reseed.ts`, deleted
  after use) with comparable variance (quality score 30–98,
  all 6 categories, all 3 maturity levels, with/without example/action). After
  the final `npm test` run, the DB was reseeded again with this script, so
  that it ends up with 12 reels/20 raw items again — though not content-
  identical to the original state before this session.
