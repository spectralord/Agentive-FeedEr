# ADR 0019 — Actionables (To-Try) and two-track skill progress

- Status: proposed (needs strong-model grill — schema change; revisits an Epic 6 decision)
- Date: 2026-07-24
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
  `experience_report_id`), with `done_at` and optional `note`. Deliberately *not* a full
  `actionables` table duplicating action text that already lives on the Reel — the Actionable is
  a *view* over `reels.action`, with only completion state stored net-new.
- `getSkillMap`/`getNodeDetail` gain evidence counts alongside the existing status.
- The Reel Detail Skill tab (design doc §5.2) and the node page both surface To-Trys; both must
  write through **one shared mutation**, not two implementations (see design doc §8.4).
- Adoption Log gains a second genuine source again — it currently has only one
  (`user_progress_notes`), a documented deviation in `epic-7-skill-map.md` caused precisely by
  Epic 6 dropping the reel `tried` interaction. Completed Actionables with notes restore what
  that removal cost, without reintroducing reel-level check-offs.
- Experience Reports are **not** in v1 scope as an Actionable source (they have no `action`
  field). Adding them later means either a field or an extraction pass — a separate decision.

## Open questions

- Should completing an Actionable **auto-advance** the declared status `seen → tried`? Convenient,
  and arguably honest ("you demonstrably tried something"), but it blurs the two-track separation
  this ADR is built on. The design prototype does auto-advance; leaning toward *not* doing it in
  production, or making it a one-time suggestion rather than an automatic write.
- Does an Actionable ever expire? A "5-min-test" from a Reel that has since been superseded
  (Epic 11 freshness) is arguably stale advice. Cheap option: surface the parent Reel's
  supersession state on the actionable rather than expiring it.
