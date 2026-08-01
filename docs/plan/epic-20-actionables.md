# Epic 20 — Actionables (To-Try) and the evidenced progress track (ADR 0019)

> **Status: PLAN, ready to delegate.** Written 2026-08-01 by the strong model.
> Implementation target: **Sonnet subagent**, branch `claude/epic-20-actionables`.
> **Binding work rules: `docs/plan/README.md` §1.** Read them before starting.

**Goal:** today the only progress signal is one self-declared status per skill (`seen` / `tried` /
`mastered`) — 100% honour-based, with no evidence track at all. Make the **recommended action**
already attached to each Reel into something you can **tick off**, and roll completions up to the
skill as a second, parallel progress track.

**References (read first, in this order):**
- **ADR 0019** — the decision this epic implements. Decisions 1–6 and both resolved open questions
  are binding. **Decision 5 (snapshot) and decision 6 (`effort_tag`) were added in the 2026-08-01
  grill — do not work from a stale reading of decisions 1–4 alone.**
- **Design doc §9.2/§9.3** (the surfaces) and **§8.4** (the one-shared-mutation constraint).
- **ADR 0005** (sourced-only), **ADR 0003** (null over hallucination), **ADR 0016** (reserved colours).
- `docs/plan/epic-6-interactions.md` — "Revidiert 2026-07-23", which **removed** a reel-level
  `tried` interaction. That removal stands; read it so you do not reinstate it.

---

## What already exists (do not rebuild)

Verified against the live DB and code on 2026-08-01:

| Thing | Where | State |
|---|---|---|
| `reels.action`, `reels.effort_tag`, `reels.skill` | `src/db/schema.ts` | **exist and are populated** — 8/16 Reels have `action`, 7 have `action`+`skill` |
| Action rendered read-only | `src/components/ReelDetail.tsx:239-245` (Skill tab) | exists — you are adding a checkbox to something already on screen |
| `action`/`effortTag` on the read model | `src/components/reelDetailData.ts` (`SkillTabView`) | exists |
| Declared progress | `user_progress` + `setProgress` / `setProgressBySlug` (`src/lib/skills/map.ts:211`) | exists — **do not change its semantics** |
| Note history / Adoption Log | `user_progress_notes`, `listAdoptionLog` (`src/lib/skills/progress.ts:74`) | exists, currently has **one** source |
| `interactions` table | types `["save","hide","up","down"]` — **no `tried`** | confirms Epic 6's removal is real in the schema |

**No LLM pass is needed anywhere in this epic.** The content was derived during enrichment already.
Net-new is: one table, one mutation, read-layer counts, and UI.

---

## Tasks

### ☒ T20.1 — Schema: the completion table

**Do:** add `actionable_completions` to `src/db/schema.ts` + a `drizzle-kit` migration.

Columns:
- `id` serial PK
- `reel_id` integer **not null**, FK → `reels.id`, **unique** (one completion per Reel; ticking is
  idempotent, not a counter)
- `skill_node_id` integer **not null**, FK → `skill_nodes.id` — resolved at completion time from
  `reels.skill`, so the roll-up does not depend on the Reel's tag staying put
- `action_text` text **not null** — **the snapshot, ADR 0019 decision 5**
- `effort_tag` text nullable — snapshot alongside, same reasoning
- `note` text nullable
- `done_at` timestamptz not null default now()

**Why `action_text` is stored even though it duplicates `reels.action`:** `reels.action` is
**mutable** — a re-enrichment can rewrite it. Without the snapshot, ticking off "try X" and later
finding the column says "try Y" silently rewrites the user's own history, and the Adoption Log would
misreport what they did. Uncompleted actionables stay a pure view over `reels.action`; text is
captured **only** at the moment completion turns it into a historical fact. Do not "simplify" this
away — it is a decision, and the reasoning is in ADR 0019 decision 5.

**Verify:** `npm run db:generate` produces one migration; `npm run db:migrate` applies clean;
`npm test` green (integration tests run against `feedr_test`, **not** the dev DB).

---

### ☐ T20.2 — `src/lib/actionables/` — the one shared mutation

**Do:**
- `toggleActionable(reelId, note?)` — the **single** write path. Inserts a completion (snapshotting
  `action_text`/`effort_tag` from the Reel, resolving `skill_node_id` from `reels.skill`), or deletes
  it if already present. Returns the resulting state.
- Refuse to complete a Reel whose `action` is `null` or whose `skill` is `null` — there is nothing to
  snapshot and nowhere to roll up. Return a typed failure, do not throw.
- `listActionablesForNode(skillNodeId, opts?)` — the To-Try list for a node: every Reel tagged to it
  that has an `action`, each annotated with its completion state. `opts` supports **filter and sort
  by `effort_tag`** (ADR 0019 decision 6).
- `countEvidenceForNodes(nodeIds)` — batch count of completions per node. **Batch, not per-node**:
  follow the existing batching pattern (`getInteractionFlags`, `getSkillTabInfoForSlugs`) rather than
  querying inside a render loop.

**⚠️ §8.4 is binding: ONE mutation, two call sites.** Both the Reel Detail Skill tab and the node page
must write through `toggleActionable`. The project has an explicit constraint against two
implementations that drift — the same rule already governs `setProgress`.

**Verify:** integration tests: toggle on → row exists with snapshotted text; toggle off → row gone;
snapshot survives a subsequent `UPDATE reels SET action = …` (this is the decision-5 regression test —
**write it, it is the point of the design**); null-action Reel is refused; effort filter/sort works.

---

### ☐ T20.3 — Read layer: evidence counts alongside declared status

**Do:**
- `getSkillMap` (`src/lib/skills/map.ts`) — add an evidence count per node via
  `countEvidenceForNodes`.
- `getNodeDetail` — add the node's actionable list + evidence count to `SkillNodeDetail`
  (currently `{ node, content, status, notes }`).
- **Do not collapse the two tracks into one number or one status.** Declared and evidenced are
  parallel and independent (ADR 0019 decision 2). "Mastered with zero evidence" must remain
  representable and visible.

**⚠️ Do not break this existing invariant:** `getSkillMap` must not treat "no `user_progress` row" as
`seen`. The DB distinguishes untouched from seen and the read layer historically discarded it; there
are tests pinning this (`src/lib/skills/map.integration.test.ts`).

**Verify:** integration tests for both functions, including a node with completions but no
`user_progress` row and vice versa.

---

### ☐ T20.4 — UI: the To-Try list and the tick

**Do:**
- **Reel Detail Skill tab** (`ReelDetail.tsx`, the existing `skill.action` block at 239-245): add the
  tick control to the action box that already renders. Optimistic update — the project has an
  existing helper (`submitFormOptimistic`, used at `ReelDetail.tsx:202`).
- **Node page** (`/skills/[slug]`, `SkillNodeDetail.tsx`): render the node's To-Try list with the tick
  and the **effort filter/sort** from decision 6.
- Show the **two tracks side by side** on the node page: declared status (the existing `SkillRing`)
  and the evidence count. Both visible, neither gating.
- **Completing an Actionable must NOT auto-advance the declared status.** At most, offer a
  *dismissible one-time suggestion* ("mark this skill as tried?") that the user actively accepts.
  ADR 0019's resolved open question: an automatic write would collapse the two-track separation the
  whole ADR is built on. **The old design prototype auto-advances — that behaviour is explicitly not
  carried into production.**
- **Supersession:** if the parent Reel is superseded (Epic 11 freshness), label the actionable —
  never hide or expire it. This is a legitimate **`--caution`** use (ADR 0016 reserves that colour for
  caveat + freshness/supersession, so here it is correct).

**Styling (ADR 0016, binding):** `--action` is already the sourced-action-line colour and the action
box uses it — keep that. `--accent` for links/focus/tried. **`--gold` is mastered-only.** Use tokens,
**no raw `zinc-*`/`amber-*`/`emerald-*` literals**. Touch targets **≥ 40px** (see
`ReelActions.tsx:31-35` for the pattern).

**⚠️ Trap:** `src/lib/env.ts` is **server-only**. Never call `env()` from anything reachable inside a
`"use client"` component — it throws during hydration. Six occurrences on record. Resolve on the
server, pass plain props.

**Verify:** `npm run build` + `npm test` green, **and required screenshots**:
```bash
npm run dev &
node scripts/design-screenshot.mjs http://localhost:3000/skills --vp phone
```
Then **read the PNGs**. Confirm: tick reachable, list legible at 375px, no horizontal overflow, filter
control usable. Source review alone is not acceptable for this task — two BLOCKERs once survived a
green build and 363 passing tests here.

---

### ☐ T20.5 — Adoption Log gains its second source

**Do:** extend `listAdoptionLog` to merge completed Actionables (those with a note) alongside
`user_progress_notes`, newest first.

**Context:** the Log currently has exactly **one** source — a documented deviation in
`epic-7-skill-map.md` caused precisely by Epic 6 dropping the reel `tried` interaction. This restores
what that removal cost **without** reintroducing reel-level check-offs: the completion belongs to the
node, not the Reel (ADR 0019 decision 4).

**Verify:** integration test with both sources present, asserting correct interleaving by timestamp.

---

## Definition of done

- [ ] `npm run build` clean · `npx tsc --noEmit` clean
- [ ] `npm test` green — **≥ 377 tests** at plan time; new tests raise it
- [ ] `npx eslint src` reports **zero** problems (currently zero — do not regress)
- [ ] Screenshots reviewed at `--vp phone` (T20.4)
- [ ] The decision-5 regression test exists and fails if the snapshot is removed
- [ ] No new runtime dependencies
- [ ] Status table row updated in `docs/plan/README.md` §6

## Abweichungen / Fragen

*(Subagent: record here rather than guessing — `README.md` §1.4.)*

## Explicitly out of scope

- **Experience Reports as an Actionable source** — they have no `action` field (ADR 0019 Consequences).
- **Multi-step checklists** per Actionable — rejected for v1 in ADR 0019's Alternatives.
- **Reinstating a reel-level `tried` interaction** — Epic 6 removed it on purpose.
- **Auto-advancing declared status** — resolved as never; see T20.4.
- Guide-read state as evidence (needs ADR 0018's Guides, which are gated).
