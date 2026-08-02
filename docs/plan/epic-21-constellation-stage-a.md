# Epic 21 — Constellation stage (a): theme vocabulary + stable node positions (ADR 0020)

> **Status: PLAN, ready to delegate.** Written 2026-08-01 by the strong model.
> Implementation target: **Sonnet subagent**, branch `claude/epic-21-constellation`.
> **Binding work rules: `docs/plan/README.md` §1.** Read them before starting.

**Goal:** turn the Skill Map from a grouped list into a **constellation** — skills as dots in
hand-placed theme regions, where **every dot has a stable position that never moves when new skills
appear**. Stage (a) only: the map renders and is curatable. The clever "related skills drift
together" layout pass is **stage (b) and explicitly out of scope** (see below).

**References (read first, in this order):**
- **ADR 0020** — the decision this implements. **Decisions 6–9 were added in the 2026-08-01 grill;
  do not work from decisions 1–5 alone.** Decision 7 is the scope gate for this epic.
- Design doc **§9.5** (the constellation), **§9.8** (mobile zoom — resolved by decision 9),
  **§9.9** (the honest caution about building this before Guides exist).
- **ADR 0016** (reserved colours), **ADR 0012/0013** (grounded computation over LLM judgment — the
  pattern decision 4 follows).

---

## ⚠️ T21.1 is a prerequisite, not a nice-to-have

**The map cannot be built before the theme vocabulary is fixed.** Measured 2026-08-01:

| `skill_nodes.slug` | `skill_nodes.theme` (actual) | in `THEMES`? |
|---|---|---|
| `agentic-tool-use` | `Agentic Workflows` | ❌ no |
| `computer-use` | `Agentic Workflows` | ❌ no |
| `mcp-servers` | `Agentic Workflows` | ❌ no |
| `prompt-caching` | `Cost & Performance` | ❌ no |

`THEMES` (`src/lib/skills.ts:11-29`) is a closed 8-value list: `parallelization`, `agents`, `tooling`,
`prompting`, `evaluation`, `models`, `integration`, `industry`. **None of the four live rows matches
it.** ADR 0020 decision 1 gives one map region *per `THEMES` value*, so as things stand **no node has
a region to live in**.

How it happened: the SkillTagger **is** enum-validated (`src/lib/skilltagger/schema.ts:22`,
`propose_theme: z.enum(THEMES)`), so the pipeline was always correct. `scripts/seed-dev.sql:55-62`
wrote friendly display strings straight into a free-form `text` column and bypassed it.

---

## Tasks

### ☒ T21.1 — Theme vocabulary: constrain, migrate, and add display labels

**Do:**
1. **`THEME_LABELS`** in `src/lib/skills.ts` — a `Record<Theme, string>` of user-facing labels, e.g.
   `prompting → "Prompting & Context"`, `agents → "Agentic Workflows"`. The DB stores the **slug**;
   the UI shows the **label**. Cover all 8. Pick reasonable labels and move on — they are display
   strings with no data dependency, so they are trivially changed later.
2. **Migrate the data.** Use this mapping — **just apply it, do not deliberate**:
   - `Agentic Workflows` → `agents` (all three rows)
   - `Cost & Performance` → `prompting`
   Write it as a **drizzle migration** so it is reproducible, not a manual `psql` edit.

   > **Owner decision 2026-08-01: the slug set does not need to be right yet.** The goal is a running
   > constellation; which categories *actually* make sense will be judged once it can be seen with
   > real data. So: do **not** redesign `THEMES`, do **not** open a question about whether
   > `Cost & Performance` deserves its own category, and do **not** block on confirming the mapping.
   > Any mapping that puts every row on a valid slug is good enough for this task. Renaming or
   > re-cutting the vocabulary later is a cheap follow-up — it is a `THEMES` edit plus one migration,
   > and `THEME_LABELS` (below) already decouples the display text from the stored key, so labels can
   > change without touching data at all.
3. **Fix `scripts/seed-dev.sql:55-62`** to use slugs. Otherwise the next `npm run db:seed`
   reintroduces the exact problem.
4. **Constrain the column** so this cannot recur: `skill_nodes.theme` becomes a Postgres enum (or a
   `CHECK` against the 8 values) and the Drizzle definition gets
   `text("theme", { enum: THEMES })`. Currently it is bare `text().notNull()`
   (`src/db/schema.ts:156`).
5. **Render labels, not slugs.** `theme` is currently printed raw as a heading —
   `SkillMap.tsx:29-32` and `SkillNodeDetail.tsx:94`. Route both through `THEME_LABELS`.

**Verify:**
- `npm run db:migrate` clean; `SELECT DISTINCT theme FROM skill_nodes;` returns only `THEMES` values.
- Inserting an off-vocabulary theme **fails** at the DB level. Check this explicitly.
- `npm run db:seed` then re-check — the seed must not reintroduce free text.
- `npm test` green. **Grep the tests for the old strings** (`"Agentic Workflows"`, `"Cost & Performance"`)
  — fixtures may hardcode them.
- Screenshot `/skills` and confirm headings read as friendly labels, not slugs.

**Note:** `npm test` runs against `feedr_test` and does **not** wipe `feedr_dev` (fixed 2026-07-27).
`npm run db:seed` **is** destructive (TRUNCATE first); a count query mid-seed reporting zeros is a
race, not a failure.

---

### ☒ T21.2 — `THEME_LAYOUT`: hand-placed theme regions (code constant)

**Do:** a `THEME_LAYOUT: Record<Theme, { cx: number; cy: number; r: number }>` in
`src/lib/skills/layout.ts` — centre + radius per theme in an abstract coordinate space (e.g. 0–1000
square; the renderer scales it).

**Why code and not DB:** ADR 0020 decision 1 — structural constants live in code
(`THEMES`, `SOURCE_REGISTRY` set the precedent) while accumulating state lives in DB rows. Themes
change rarely and deliberately; their arrangement is a design choice, not derived data.

Place the 8 regions so related themes are adjacent and none overlap. This is a **design judgement** —
lay them out deliberately rather than on a mechanical grid, and comment the intent.

**Verify:** unit test — every `THEMES` value has an entry (exhaustiveness), and no two regions
overlap given their radii.

---

### ☒ T21.3 — Position schema + three-tier resolution

**Do:**
1. Schema: `skill_nodes` gains `position_x` real nullable, `position_y` real nullable,
   `position_locked` boolean not null default false. Nullable so an unplaced node falls through to
   the hash tier. Migration via `drizzle-kit`.
2. `resolveNodePosition(node)` in `src/lib/skills/layout.ts`, implementing ADR 0020 decision 2
   **in this precedence order**:
   ```
   manual override (position_locked && x,y present)
     ?? stored computed layout (x,y present)
     ?? deterministic hash fallback
   ```
3. The hash tier: `hash(slug) → (angle, radius)` inside the node's `THEME_LAYOUT` circle. **Must be
   pure and stable** — same slug ⇒ same point, forever, with no DB read and no randomness. Use a
   simple deterministic string hash; do not reach for a dependency (**no new runtime deps**).

**Verify:** unit tests — same slug yields the identical point across calls; every node lands **inside**
its theme circle; a node with no stored position still resolves; the precedence order is respected
(locked beats stored beats hash).

---

### ☒ T21.4 — Render the constellation

**Do:** render nodes at resolved positions inside their theme regions, reusing the **existing shared
`SkillRing`** component for node state — **do not write a second ring.** It has exactly three call
sites today (`SkillMap.tsx:40`, `ReelDetail.tsx:215`, `SkillNodeDetail.tsx:101`) and ADR 0016 point 2
requires one component, not three that drift.

- **Ship this behind the existing grouped-list view or alongside it** — the list works today and this
  is the speculative part. Do not delete the list in this epic.
- SVG is the natural fit (already used by `SkillRing`). No canvas, no charting library.
- **Node labels must be readable at 375px.** A previous fix replaced hard `truncate` with
  `line-clamp-2` for exactly this reason (`SkillMap.tsx:42`); do not regress to unreadable
  ~14-character labels.
- **ADR 0016:** `--gold` only for mastered, `--accent` for tried/focus, `--caution` **never** for
  neutral state. Tokens only, **no raw `zinc-*`/`amber-*`/`emerald-*`**.
- `prefers-reduced-motion` is already honoured globally (`globals.css:90`) — do not add unguarded
  animation.

**Verify:** `npm run build` + `npm test` green, **and required**:
```bash
npm run dev &
node scripts/design-screenshot.mjs http://localhost:3000/skills --vp phone --vp desktop
```
**Read both PNGs.** Confirm: no node overlaps another, labels legible at 375px, **body-level
horizontal overflow is 0** (the script reports it — this is the most common mobile bug in this
project), no white background. Source review is not acceptable evidence for this task.

---

### ☒ T21.5 — Manual override (desktop/iPad only)

**Do:** drag-to-place a node, which writes `position_x/y` and sets `position_locked = true`.

- **Gate to larger viewports.** ADR 0020 decision 5: dragging is fiddly on phones and this is a rare
  curation activity — **mobile parity is explicitly not required.**
- Provide "reset to computed" per node (clears the override → falls back down the tiers).
- Locked nodes are pinned forever and must never be touched by any future layout pass.

**Verify:** integration test on the write path; screenshot at `--vp desktop`. Confirm a locked node
survives a page reload.

---

## Definition of done

- [x] `npm run build` clean · `npx tsc --noEmit` clean
- [x] `npm test` green — **≥ 377 tests** at plan time (final: **424 tests / 67 files**)
- [x] `npx eslint src` reports **zero** problems (currently zero — do not regress)
- [x] `SELECT DISTINCT theme FROM skill_nodes` returns only `THEMES` values, and off-vocabulary
      inserts are rejected by the DB (verified explicitly twice — once after T21.1's migration, once
      again at epic end after `npm run db:seed` re-ran — both times a raw off-vocabulary INSERT threw
      `violates check constraint "skill_nodes_theme_check"`)
- [x] Screenshots reviewed at **both** `--vp phone` and `--vp desktop`; body overflow 0 (script prints
      an overflow warning only when > 0px; none printed at either viewport, both before and after the
      hash-tier/label-collision fixes below)
- [x] No new runtime dependencies
- [x] Status table row updated in `docs/plan/README.md` §6

## Owner feedback after first real use (2026-08-02) — REWORK NEEDED

Tested against the running app. Three findings; the first two are defects against the accepted
prototype, the third is a design change.

1. **No connections between nodes.** `docs/specs/prototypes/skill-constellation.html` defines a
   `.link` class (line 56: `stroke: var(--hairline-strong); opacity: .35`) plus a `.link.hot`
   accent state for the selected node's edges. `SkillConstellation.tsx` renders **zero** `<line>`
   elements. The prototype wins on *look* (design-review agent's precedence rule), so this is a
   conformance gap, not a preference.

2. **Cannot drag.** T21.5 shipped drag-to-place gated to desktop/iPad, and the reset-button nesting
   bug was fixed — but the owner could not drag in practice. **Unverified by me at the time**: the
   T21.5 review checked the write path and a locked position surviving reload, not the pointer
   interaction itself. Needs reproduction before a fix.

3. **The region circles are unwanted, and the desired model is different.** Owner wants **one
   identifiable key node per theme** (e.g. "Agentic Workflows") with **connections radiating to its
   related nodes** — a hub-and-spoke reading — rather than dotted circles enclosing scattered
   points. Note the prototype's `.theme-ring` (line 54, `stroke-dasharray: 2 6`) *is* the circle
   that shipped, so this supersedes the prototype too, and therefore needs an **ADR 0020
   amendment**, not just a code change.

   This lands close to ADR 0020 decision 8's layer model, where **themes are the roots**. A theme
   rendered as a real node with spokes is arguably that decision made visible one layer earlier.

**Sequencing caution — item 3 partly depends on gated work.** Drawing meaningful edges needs a
relatedness signal, and ADR 0020 decision 7 gated the relaxation pass because co-occurrence is
currently **one pair corpus-wide**. Hub-to-member spokes (theme → its own nodes) are structural and
need no signal; member-to-member edges do. Split accordingly.

## Review findings (strong model, 2026-08-01)

**Accepted.** Every high-risk claim independently re-verified, not taken on report:

- **Off-vocabulary insert genuinely fails.** Ran a raw `INSERT` with an invalid theme against
  `feedr_dev`: `ERROR: new row for relation "skill_nodes" violates check constraint
  "skill_nodes_theme_check"`. The failure mode that made T21.1 a prerequisite is now impossible at
  the DB level, not merely discouraged in TypeScript.
- **Data migrated:** `agents` ×3, `prompting` ×1 — only valid slugs remain.
- **The out-of-scope gate held.** No relaxation/force-directed/attraction code exists; the single
  grep hit is a comment explaining why the pass is *absent* (stage b). `assignLabelRows` was
  checked specifically for being a disguised layout pass and is not one — it assigns a `labelRow`
  integer and never touches `position`. Correct distinction, correctly drawn.
- **`SkillRing` reused as a fourth call site**, not duplicated. No raw palette literals added.
- **Gates re-run here:** typecheck clean, eslint 0 problems, 424 tests / 67 files.
- **Rung 1 re-done independently at 375px:** body overflow **0**; all 8 region labels render as
  **display labels** ("AGENTIC WORKFLOWS", "PROMPTING & CONTEXT"), not raw slugs, so `THEME_LABELS`
  is genuinely wired; measured **zero** node-label overlaps.

### MINOR — label crowding outside the region circle (not a blocker)

In the `agents` region, the three node labels ("Computer Use", "Agentic Tool Use", "MCP Servers")
extend well outside the region circle and crowd the neighbouring `integration` region. They are
legible and provably non-overlapping — `assignLabelRows` does its job — but the *spatial grouping*
reads as muddied, which matters for a design whose whole purpose is building spatial memory.

Not fixed here because the honest fix is a layout question, not a rendering one: either the region
radii need to account for label extent, or labels need truncation/hover-reveal at this density.
Both interact with ADR 0020's existing open question about per-theme overflow, and with decision 8's
layer 2 ("could become quite large"). **Note the subagent's own flagged uncertainty was exactly
this** — whether the 8 hand-placed regions hold up as nodes accumulate. It does not, at 3 nodes.
Fold into whatever answers per-theme overflow.

## Abweichungen / Fragen

*(Subagent: record here rather than guessing — `README.md` §1.4.)*

1. **T21.1 — DB-level enum constraint needed hand-written SQL, not `drizzle-kit generate`.**
   `text("theme", { enum: THEMES })` is a TypeScript-only narrowing in this Drizzle version — it
   generates no DB-level constraint, and no other "enum" column in this codebase (`reels.category`,
   `reels.maturity`, `sources.type`, ...) has one either. But T21.1 explicitly requires "an
   off-vocabulary insert fails at the DB level" as an *explicit check*, not just a TS-level guard, so
   a real constraint was necessary. Used `drizzle-kit generate --custom` and hand-wrote the data
   migration + a plain `CHECK` constraint (not a Postgres `ENUM` type — `CHECK` is a one-line
   drop/add if the vocabulary is re-cut later, `ENUM` would need its own `ALTER TYPE` migration).
   Conservative interpretation taken: this is a new, narrower pattern than the rest of the codebase,
   applied only to this one column because the task explicitly demanded it, not applied retroactively
   to other "enum" columns.
2. **T21.1 — the pre-existing test DB (`feedr_test`) held a leftover off-vocabulary theme row**
   (`"Tooling & Workflow"`) from before this fix, which blocked the new migration's `ADD CONSTRAINT`
   from applying (`feedr_test` is never wiped between `npm test` runs — see
   `src/test/globalSetup.ts`). Manually `TRUNCATE`d the affected tables in the test DB once,
   one-time-only; no test code relies on that stale row surviving, and every integration test that
   touches `skill_nodes` already `TRUNCATE`s it in its own `beforeEach`.
3. **T21.4 — two real bugs found only by the required screenshot review, not by source reading.**
   (a) The initial hash-tier implementation (independent continuous angle+radius per slug) let this
   project's actual seeded `agents`-theme nodes land close enough to visibly overlap their rendered
   rings. Fixed by replacing it with a sunflower/Fibonacci spiral (`hashSlotCount` sized per region
   radius) — see `src/lib/skills/layout.ts`'s docstrings for the full reasoning and the regression
   test in `layout.test.ts`. (b) Even with rings separated, permanently-visible text labels wide
   enough to stay fully readable can still collide at 375px purely from label-pixel-width vs.
   achievable-hash-spacing arithmetic — this is a real geometric tension, not a bug I could tune away
   (worked through the actual numbers; a label wide enough to guarantee zero overlap at 375px would
   need to be wider than several theme circles). Resolved with `assignLabelRows`: deterministic
   label-only collision avoidance (stacks a close label into a lower row; never moves the underlying
   node) — explicitly **not** the banned relaxation/force-directed pass, since it only ever touches
   where a label's *text* renders, never a node's resolved position.
4. **T21.5 — a real interaction bug found only by actually dragging a node in a live browser**, not
   by source review or automated tests (this project has no `@testing-library/react`/jsdom, and
   adding one was avoided as an unnecessary new devDependency for a single interaction test — see
   point 5). The "reset" `<button>` was nested inside the draggable `<Link>`; a pointerdown landing on
   the button still bubbled to the anchor's own `onPointerDown` first, so every "reset" click was
   silently treated as the start of a new (zero-distance) drag instead of a reset. Fixed by making the
   ring+label `<Link>` and the reset `<button>` siblings inside a plain positioning `<div>`, never
   nested (also fixes invalid HTML — an interactive element inside an `<a>`). Verified the fix by
   dragging, resetting, and reloading live in the browser, confirmed against `SELECT ... FROM
   skill_nodes` at each step.
5. **T21.5 — no interaction-level automated test for the drag gesture itself.** This project's test
   suite is 100% `renderToStaticMarkup`-based (no jsdom, no `@testing-library/react`); adding either
   would be a new devDependency for one feature's interaction test, which README §1.3's dependency
   rule reads as requiring the same "technically necessary, documented under Abweichungen" bar as a
   runtime dependency would. Took the conservative path: unit-tested everything `renderToStaticMarkup`
   *can* observe (the edit-mode toggle's `md:` gating, the reset button's absence outside edit mode,
   the DB write/reset functions via a real integration test, the route's request validation with
   mocked lib calls) and verified the actual drag/reset/reload-survival flow by hand in the live
   browser (documented in the commit message and this report) rather than skipping that verification
   or adding a new dependency to automate it.

## Explicitly out of scope — do not build these

- **The incremental layout/relaxation pass (stage b).** ADR 0020 decision 7 gates it: corpus-wide
  there is currently **one** co-occurring skill pair, so the pass would have nothing to compute from
  and would be machinery around pure hash placement — the alternative the ADR itself rejected as an
  end state. **Do not implement attraction, relaxation, or force-directed anything.**
- **LLM-proposed relatedness edges** — ADR 0020 decision 4's fallback, only if co-occurrence never
  densifies. Not now. And never LLM-proposed *coordinates*.
- **The three view layers** (ADR 0020 decision 8) — layers 1–3, layer-1 theme dragging, and layer-3
  focus. Note the ADR has **two open questions** there (how layer 3 is entered; whether layer-1
  dragging turns theme centres from a code constant into stored state). Both must be answered before
  that work starts.
- **Manually creating a new root/theme** — that is ADR 0027 (node seeding, proposed, unresolved
  whitelist-anchor problem and an ADR 0001 collision).
- **Any change to gating.** Skill *Map*, not Skill *Tree*: no prerequisites, every status reachable
  from every status.

## Sequencing caution (from ADR 0018 / design doc §9.9)

> *"the constellation without [Guides] is a beautiful shell over thin content… don't build 4 before 3
> and expect it to feel finished."*

Guides (ADR 0018) are **accepted but build-gated** on corpus size. This epic is safe to build because
the hash tier renders a real constellation with no signal needed — but do not expect the result to
*feel* finished, and do not "fix" that by adding scope from the out-of-scope list.
