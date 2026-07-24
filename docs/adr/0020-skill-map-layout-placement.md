# ADR 0020 — Skill Map layout: fixed theme regions, stored incremental placement, manual override

- Status: proposed (needs strong-model grill — schema addition)
- Date: 2026-07-24
- Related: ADR 0012/0013 (grounded computation preferred over LLM judgment — the pattern this
  follows), `src/lib/skills.ts` (`THEMES`), `src/lib/sources.ts` (code-as-source-of-truth pattern)
- Design context: `docs/specs/2026-07-24-ux-gamification-design.md` §9.5

## Context / Problem

The target Skill Map is a sprawling constellation — visually rich, the kind of map you build
spatial memory of. Sprawling maps normally look good because **a designer hand-placed every
node**. Agentive-FeedEr's nodes are created by the SkillTagger (Match-or-Propose, ADR 0009) from
whatever the news stream produced, with **no prerequisite relationships by design** (Skill-*Map*,
not Skill-*Tree*). Naive auto-layout of an emergent graph looks like spilled spaghetti.

Two failure modes to avoid, both fatal to the concept:
1. **Re-flow on change.** If adding a node moves existing ones, spatial memory breaks every night
   and the map is never learnable.
2. **Meaningless positions.** Pure hash placement is perfectly stable but encodes nothing — two
   deeply related skills can land on opposite sides of their region. Stability without meaning is
   only half the goal.

## Decision (proposed)

**The skeleton is designed and fixed; only the leaves are dynamic.**

1. **Theme regions are hand-placed code constants.** The 8 `THEMES` get a companion
   `THEME_LAYOUT` (centre + radius per theme) living in code, matching the project's existing
   convention that structural constants are code (`THEMES`, `SOURCE_REGISTRY`) while accumulating
   state is DB rows. Themes change rarely and deliberately; their arrangement is a design choice,
   not derived data.

2. **Node position resolves in three tiers:**
   ```
   position = manual override (if locked)
           ?? stored computed layout
           ?? deterministic hash fallback
   ```
   The hash fallback (`hash(slug) → angle + radius` within the theme circle) guarantees every
   node always has *some* stable position, even before any layout pass has run.

3. **The layout pass is incremental, and its output is stored.** When a new node appears: pin
   every existing node, place the newcomer (hash seed, then relaxation against its neighbours),
   store the result. **Existing nodes never move.** A full re-layout is an explicit, deliberate
   action only — never automatic, because it would invalidate spatial memory wholesale.

4. **Meaning comes from grounded relationships, not from an LLM picking coordinates.** Attraction
   between nodes is driven by **co-occurrence** — skills appearing together in the same topic
   clusters (Epic 15 data, already computed). This follows the project's established pattern of
   preferring grounded computation over LLM judgment (ADR 0012's confidence from independent
   source counts, ADR 0013's `is_primary`).

   If co-occurrence proves too sparse, an LLM pass may later propose **adjacency/relatedness
   edges** — but never coordinates. "Are these two skills conceptually neighbours?" is a question
   a model answers well; "what should this node's x/y be?" is not.

5. **Manual override + edit mode as the escape hatch.** Drag-to-place sets an explicit position
   and marks it locked; locked nodes are pinned forever and are never touched by any layout pass.
   The productive pattern is iterative: **pin the placements that are right, re-run the layout for
   the rest.** Edit mode is a desktop/iPad affordance for occasional curation — dragging is fiddly
   on phones and this is a rare activity, so mobile parity is explicitly not required.

## Alternatives

- **Pure deterministic hash, no stored layout (the prototype):** dead simple, zero schema, always
  stable — but positions stay meaningless forever and related nodes never cluster. Rejected as
  the *end state*; retained as the fallback tier, which is the right role for it.
- **Live force-directed simulation on every render:** positions reflect structure, but the map
  reshuffles whenever data changes, destroying spatial memory — failure mode 1 above. Rejected.
- **Fully hand-authored positions for every node:** best-looking, but the node set grows from an
  automated tagger; hand-placing every new node is unbounded manual work. Rejected as the default,
  kept as the override tier.
- **LLM proposes coordinates directly:** the naive reading of "AI placement". Models are poor at
  spatial coordinate assignment and would produce overlapping, unbalanced output requiring
  correction anyway. Rejected in favour of LLM-proposes-relationships (point 4).

## Consequences

- Schema: `skill_nodes` gains position fields (`position_x`, `position_y`, `position_locked`) —
  nullable, so an unplaced node simply falls through to the hash tier.
- New layout module computing/storing placements incrementally; runs after SkillTagger creates
  nodes, and on explicit full-relayout request.
- Edit mode is UI work gated to larger viewports; needs a "reset to computed" per node and a
  "re-layout unlocked nodes" action.
- The map remains renderable at every stage of this ADR's implementation — hash tier alone already
  produces a working constellation, which means the visual can ship before the layout pass exists.
  That's deliberate: it de-risks the most speculative part of the Skills vision.

## Open questions

- **Overflow within a theme:** a theme that accumulates 30+ nodes will crowd its circle. Grow the
  radius, allow a second ring, or cap and paginate? Not urgent at current node counts, but it is
  the failure mode that arrives with success.
- **Should `position_locked` be exposed on the node detail page**, or only inside edit mode? Minor,
  but affects whether a curated placement is discoverable as a property of the node.
- **Mobile zoom-to-constellation** (design doc §9.8) interacts with this: at theme-zoom level the
  layout could arguably be recomputed per-theme for better use of screen space. That would break
  the "one true position" model — worth deciding explicitly rather than discovering later.
