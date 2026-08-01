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

### ☐ T21.2 — `THEME_LAYOUT`: hand-placed theme regions (code constant)

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

### ☐ T21.3 — Position schema + three-tier resolution

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

### ☐ T21.4 — Render the constellation

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

### ☐ T21.5 — Manual override (desktop/iPad only)

**Do:** drag-to-place a node, which writes `position_x/y` and sets `position_locked = true`.

- **Gate to larger viewports.** ADR 0020 decision 5: dragging is fiddly on phones and this is a rare
  curation activity — **mobile parity is explicitly not required.**
- Provide "reset to computed" per node (clears the override → falls back down the tiers).
- Locked nodes are pinned forever and must never be touched by any future layout pass.

**Verify:** integration test on the write path; screenshot at `--vp desktop`. Confirm a locked node
survives a page reload.

---

## Definition of done

- [ ] `npm run build` clean · `npx tsc --noEmit` clean
- [ ] `npm test` green — **≥ 377 tests** at plan time
- [ ] `npx eslint src` reports **zero** problems (currently zero — do not regress)
- [ ] `SELECT DISTINCT theme FROM skill_nodes` returns only `THEMES` values, and off-vocabulary
      inserts are rejected by the DB
- [ ] Screenshots reviewed at **both** `--vp phone` and `--vp desktop`; body overflow 0
- [ ] No new runtime dependencies
- [ ] Status table row updated in `docs/plan/README.md` §6

## Abweichungen / Fragen

*(Subagent: record here rather than guessing — `README.md` §1.4.)*

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
