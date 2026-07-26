# ADR 0016 — UX design conventions: reserved semantic color, shared ring language, design-for-shortest-content

- Status: **accepted** 2026-07-24 (user go-ahead to implement the design; strong-model review
  found no conflict with ADR 0003/0004/0005/0013). Implemented by **Epic 18**
  (`docs/plan/epic-18-ux-implementation.md`). Was: proposed (design-expert session, ADR 0014
  tier 2; user/strong-model override always possible).
- Date: 2026-07-24
- Related: `docs/specs/2026-07-24-ux-gamification-design.md` (full rationale + mockup history),
  ADR 0004 (derived labels), ADR 0014 (three-tier design process)

## Context / Problem

The visual system before this pass was ad hoc: `emerald` and `amber` were already in use (action
box, freshness notice) but not reserved — nothing stopped a future change from reusing `amber` for
an unrelated neutral notice, which is exactly the kind of drift that makes "why is this orange"
unanswerable six months later. Separately, the Skill Map (`SkillMap.tsx`, `SkillNodeDetail.tsx`)
carries `TODO(UX pass)` comments asking for a specific status-ring visual language that, if
implemented independently in three places (grid tile, node detail, Reel's Skill tab), would drift
into three slightly different rings meaning the same thing. Finally, an early design iteration
built UI against invented long-form content that doesn't match what enrichment actually produces
(see design doc §8.1) — a mistake worth preventing structurally, not just once.

## Decision

1. **Four semantic colors are reserved, each to exactly one meaning, project-wide:**
   `--accent` (signal/focus/tried), `--action` (sourced Action line + skill badge + "mark as
   tried"), `--gold` (mastered, and only mastered), `--caution` (`caveat` + freshness/supersession
   notice, and only those — never a neutral/informational badge). A future change introducing a
   new non-alarming status must not reach for `--caution` because it's "already amber" — that was
   an actual bug in an earlier iteration (a neutral `/today` badge briefly used the warning color).

2. **One status-ring component, three call sites.** The seen/tried/mastered ring (gray outline /
   partial `--accent` fill / full `--gold` fill) is implemented once and reused on the `/skills`
   grid tile, `/skills/[slug]` detail header, and the Reel Detail's Skill tab. No call site gets
   its own visual interpretation of the same three states.

3. **Design for the shortest realistic content, not the richest imaginable one.** Before adding a
   UI surface for a content field, confirm what the field actually contains today (check the
   schema/enrichment prompt, don't assume). A design that requires long content to make sense is
   wrong if the pipeline mostly produces short content — build for what's produced, let it expand
   gracefully if the content ever grows, never require growth that hasn't been committed to as a
   separate product decision.

   > **AMENDED 2026-07-25 (user decision) — the last clause is the operative one.** This point was
   > being read as "never build a surface before its content exists", which is stricter than
   > intended and was blocking the Write-up tab. The actual rule is about *unbacked assumptions*:
   > don't design a layout that silently **requires** content the pipeline doesn't produce.
   > It does **not** forbid building a surface whose content has been **committed to as a separate
   > product decision** — that is exactly the escape hatch the final clause names, and
   > ADR 0017's `reels.writeup` is exactly such a commitment.
   > **Corollary, deliberately chosen:** when a committed-to field is not yet populated, ship the
   > surface with **explicitly-labelled placeholder content** rather than hiding it. A front end
   > you cannot walk through is a front end you cannot evaluate, and flow between surfaces is the
   > thing least visible in a static prototype. Placeholders must be obvious as placeholders —
   > never real-looking invented content, and never silently reused text passed off as new
   > (ADR 0003's "null over hallucination" applies to the UI layer too: be honest that it's empty).

## Alternatives

- **Leave color usage implicit / per-component judgment call:** what the project already had;
  demonstrably drifted once already (the neutral-badge-on-amber bug). Rejected.
- **Let each Skill-Map surface style its own ring:** faster short-term, guarantees visual drift
  over time as each surface is touched independently by different implementers/subagents.
  Rejected.
- **Build the richer long-form content UI now, and treat lengthening `summary` as an implicit
  prerequisite:** couples a UI task to an unmade product decision, risks shipping a tab that looks
  broken/empty against real data. Rejected in favor of flagging it explicitly as an open product
  question (see design doc, Open questions).

## Consequences

- `globals.css`/Tailwind `@theme` needs the four tokens defined once, referenced everywhere else
  by name — no raw hex/Tailwind-palette-class color choices for these four meanings anywhere in
  the codebase going forward.
- The ring component becomes a small shared component (e.g. `src/components/SkillRing.tsx`) with
  a `status: "seen" | "tried" | "mastered"` prop — implementation detail for the building agent,
  not fixed here.
- Any future UI work touching a generated-content field should state, in its task description,
  what that field's real current shape is (length, nullability) rather than assuming.
