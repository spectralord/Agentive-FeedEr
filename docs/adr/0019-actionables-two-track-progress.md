# ADR 0019 — Actionables (To-Try) and two-track skill progress

- Status: **accepted** 2026-08-01 (grill session, strong model + user). Decisions 1–4 accepted as
  written; decisions 5–6 added below; both original open questions resolved. **Buildable now** —
  unlike ADR 0018, this ADR's premise was verified against the live data and holds: the content it
  promotes already exists.
  Was: proposed (needs strong-model grill — schema change; revisits an Epic 6 decision).
- Date: 2026-07-24 (grilled + amended 2026-08-01)
- Related: ADR 0005 (sourced-only), ADR 0008 (durable layer), ADR 0009 (SkillTagger),
  `docs/plan/epic-6-interactions.md` ("Revidiert 2026-07-23" — dropped the reel `tried`
  interaction), `docs/specs/2026-07-22-experience-reports-design.md` ("Revidierte Annahmen")
- Design context: `docs/specs/2026-07-24-ux-gamification-design.md` §9.2/§9.3

## Context / Problem

The glossary has defined **Actionable (To-Try)** since 2026-07-22 — *"a discrete, checkable,
skill-tagged recommended action, derived from Reels and Experience Reports. The user checks off
Actionables — never Reels or Reports themselves. Completed Actionables are progress evidence for
a Skill Node."* It was envisioned, planned into Epic 6/7's revised assumptions, and never built.

Meanwhile the only progress signal that exists is `user_progress.status` — one self-declared
value per node. Epic 6 deliberately **removed** a reel-level `tried` interaction (documented in
`AdoptionLog.tsx` and `SavedList.tsx`), correctly, because checking off a *news item* is
meaningless. But nothing replaced it, so "progress" is currently 100% honour-based declaration
with no evidence track at all.

The key observation that makes this cheap: **the content already exists.** `reels.action`,
`reels.effortTag` and `reels.skill` are populated by enrichment today, are already sourced-only
(ADR 0005), and are already skill-tagged (ADR 0009). Every ingredient of an Actionable is sitting
in columns; what's missing is that it can't be *checked off* and doesn't roll up anywhere.

## Decision (proposed)

1. **Promote `reels.action` to a first-class checkable Actionable.** No new LLM pass is required
   for v1 — the derivation already happened during enrichment. A completion record (actionable
   ref + done state + optional note + timestamp) is the entire net-new state.

2. **Two parallel progress tracks per Skill Node, both visible, neither gating the other:**
   - **Declared** — `user_progress.status` (`seen`/`tried`/`mastered`), honour-based, downgrades
     allowed, unchanged from today.
   - **Evidenced** — completed Actionables, guide-read state (ADR 0018), notes written.

   This is the "self-declaration *and* actionable-evidence exist alongside each other" decision
   from the 2026-07-22 grill, implemented literally. **"Mastered with zero evidence" remains
   fully allowed and fully visible** — no gates, consistent with the Skill-*Map*-not-Tree
   decision. Visibility is the feature; enforcement is explicitly not.

3. **Actionables remain sourced-only.** They are derived from what a source actually said, never
   invented to fill a node. A node with no sourced actions shows none — the same `null`-over-
   hallucination discipline as ADR 0003/0005.

4. **Completion is evidence for the node, not for the Reel.** Reels are never checked off (the
   Epic 6 decision stands). Completion rolls up to `reels.skill`'s node.

### Amendments from the 2026-08-01 grill

**Premise verified first** (the check ADR 0018 failed). Measured in `feedr_dev`: 16 Reels, **8 with
`action`**, 8 with `effort_tag`, **7 actionable-ready** (`action` *and* `skill` both present),
spread across all four nodes (3 / 2 / 1 / 1). `reels.action` and `effortTag` already render
read-only in the Detail Skill tab (`ReelDetail.tsx:239-243`). So decision 1's claim holds
literally: this adds a checkbox to content already on screen, and the net-new state is one
completion record. Also confirmed the history this ADR rests on — `interactions.type` is
`["save","hide","up","down"]`, with **no `tried`**, so Epic 6's removal is real in the schema and
the gap described is genuine.

5. **A completion record snapshots the action text it was completed against.** The Consequences
   section below argues the Actionable is a *view* over `reels.action` and therefore needs no
   duplicated text. That is right for *uncompleted* actions and wrong for completed ones:
   **`reels.action` is mutable** — a re-enrichment, or a future pass, can rewrite it. Without a
   snapshot, ticking off "try X" and later finding the column says "try Y" silently rewrites your
   own history, and the Adoption Log (which this ADR feeds) would misreport what you actually did.

   So: store the action text on the completion record. A small, deliberate denormalisation, bought
   for truthfulness of history rather than for query convenience. Uncompleted actionables remain a
   pure view — nothing is duplicated until the moment it becomes a historical fact.

6. **`effort_tag` earns its keep: Actionables are filterable/sortable by effort.** The column is
   populated on 8 Reels and rendered as a label, but drives **nothing** today — no filter, no sort.
   Once actions are checkable, *"give me a 5-minute win"* is the obvious and most-used shape of the
   feature, and `effort_tag` (`5-min-test` / `afternoon` / `know-only`) is exactly the field for it.
   Bringing it into scope here turns a decorative column into the thing that makes a To-Try list
   usable, at the cost of one filter control.

### Owner feedback after first real use (2026-08-02)

Visually accepted. One substantive gap: **the actionable currently reads as "go look at the Reel's
source", not as a meaningful task.** The owner wants genuine tasks *derived from* the source
material.

This is the v1 design working exactly as specified — decision 1 deliberately promotes the existing
`reels.action` string with **no new LLM pass**, and `reels.action` is a one-line prompt produced by
the core enrichment pass, not a worked task. So the limitation is in the *content*, not the
mechanism: the tick, the snapshot, the roll-up and the evidence track all function.

Improving it is a **prompt/generation** question, and there are three separable options — none
decided here:
1. Strengthen the `action` prompt inside core enrichment (cheapest; affects every Reel; changes
   ADR 0003's existing output, so it needs care).
2. A dedicated task-derivation pass, on the ADR 0024 pattern — user-triggered, through the
   `claude-code` executor, writing a richer task alongside the terse `action`.
3. Multi-step checklists — **already rejected for v1** in the Alternatives below, and the rejection
   said "revisit only if single-step actionables prove too coarse in real use". That condition has
   now been met, so the rejection is reopenable.

Note `future-todos.md` **T2** ("the current action prompts are still too weak") recorded precisely
this in July, and this ADR's own note there says the *structural* half is addressed while
**formulation quality remains a separate prompt question**. This feedback confirms that split.

## Alternatives

- **Reinstate a reel-level `tried` interaction:** simpler (the `interactions` table exists), but
  it is the exact thing Epic 6 removed on purpose — checking off a news item conflates "I read
  this" with "I did something." Rejected.
- **Multi-step checklists per Actionable** (as built in an early design prototype — numbered
  sub-steps with per-step state): richer, but requires an LLM pass to decompose actions into
  steps *and* a step-level state model, for a payoff that's speculative. Rejected for v1;
  revisit only if single-step actionables prove too coarse in real use.
- **Derive evidence purely from notes** (a node is "evidenced" if you wrote a note): free, but
  notes are prose, not a countable signal, and can't drive a progress indicator honestly.
  Rejected.

## Consequences

- Schema: a completion table keyed by the actionable's source (`reel_id`, and later
  `experience_report_id`), with `done_at`, optional `note`, and — per **decision 5** — the
  **action text as completed**. Still deliberately *not* a full `actionables` table mirroring every
  action on every Reel: uncompleted actionables remain a pure view over `reels.action`. Text is
  captured only at the moment completion turns it into a historical fact.
- `effort_tag` moves from display-only to functional (**decision 6**): the To-Try list is
  filterable/sortable by effort. No schema change — the column already exists and is populated.
- `getSkillMap`/`getNodeDetail` gain evidence counts alongside the existing status.
- The Reel Detail Skill tab (design doc §5.2) and the node page both surface To-Trys; both must
  write through **one shared mutation**, not two implementations (see design doc §8.4).
- Adoption Log gains a second genuine source again — it currently has only one
  (`user_progress_notes`), a documented deviation in `epic-7-skill-map.md` caused precisely by
  Epic 6 dropping the reel `tried` interaction. Completed Actionables with notes restore what
  that removal cost, without reintroducing reel-level check-offs.
- Experience Reports are **not** in v1 scope as an Actionable source (they have no `action`
  field). Adding them later means either a field or an extraction pass — a separate decision.

## Open questions — both RESOLVED 2026-08-01 (grill, user confirmed)

- ~~Auto-advance `seen → tried` on completion?~~ **No — never an automatic write.** It would blur
  the two-track separation that is the whole point of decision 2: the moment evidence silently
  moves the declared track, "declared" stops meaning *self-declared* and the two tracks stop being
  independent. The prototype's auto-advance is not carried into production. **A one-time,
  dismissible suggestion** ("you completed something here — mark this skill as tried?") is
  permitted, because it keeps the write in the user's hands.
- ~~Does an Actionable expire?~~ **No — never expired or hidden. Its parent Reel's supersession
  state is surfaced on it instead.** Epic 11's freshness machinery already computes that signal, so
  this costs a read, not a new mechanism. Expiring was rejected because superseded advice is often
  still valid, and silently removing a To-Try the user was planning to do is worse than showing it
  with an honest caveat. Note the display rule: supersession is a **`--caution`** case under
  ADR 0016 (caveat + freshness/supersession), so this is one of the few places that colour is
  correct.
