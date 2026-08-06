# ADR 0020 — Skill Map layout: fixed theme regions, stored incremental placement, manual override

- Status: **accepted** 2026-08-01 (grill session, strong model + user). Decisions 1–5 accepted with
  amendments; decisions 6–8 added (theme vocabulary, view layers, mobile zoom). **Design accepted,
  layout pass gated** — see decision 7. Sequencing caution from ADR 0018 still stands: design doc
  §9.9 warns *"the constellation without [Guides] is a beautiful shell over thin content… don't
  build 4 before 3 and expect it to feel finished."* Guides are decided but not built
  (ADR 0018 decision 6).
  Was: proposed (needs strong-model grill — schema addition).
- Date: 2026-07-24 (grilled + amended 2026-08-01)
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

### Amendments from the 2026-08-01 grill

**Premise checked against the live data first.** Two findings, both of which change what is
buildable:

- **The theme vocabulary does not match the data.** `THEMES` (`src/lib/skills.ts`) is a closed
  8-value list of internal slugs (`parallelization`, `agents`, `tooling`, `prompting`, `evaluation`,
  `models`, `integration`, `industry`). The live `skill_nodes` rows are filed under
  **`"Agentic Workflows"`** and **`"Cost & Performance"`** — neither is in the list. `theme` is
  `text().notNull()` (free-form) and typed as plain `string` through `getSkillMap`; only the
  *tagger's* `propose_theme` is enum-validated (`skilltagger/schema.ts:22`), and `scripts/seed-dev.sql`
  bypassed it. Decision 1 keys `THEME_LAYOUT` off `THEMES`, so **as written, no current node has a
  region.** Resolved by decision 6.
- **The co-occurrence signal decision 4 depends on is effectively empty.** Across the whole corpus
  there is **one** co-occurring skill pair (`agentic-tool-use` + `mcp-servers`, count 1); four topic
  clusters, only one holding two distinct skills. The ADR treated sparsity as a future contingency;
  it is the present state. Resolved by decision 7.

6. **Themes are a closed vocabulary of 8, with separate display labels.** The `THEMES` slugs remain
   the real set — the tagger already enforces them, so the *pipeline* is already correct and only
   hand-written data drifted. Consequences: migrate existing `skill_nodes.theme` values onto the 8
   slugs, fix `scripts/seed-dev.sql` to use them, **constrain the column** (enum or FK) so
   off-vocabulary values cannot enter again, and add a `THEME_LABELS` display map so the UI can show
   "Prompting & Context" while the data says `prompting`. `THEME_LAYOUT` then keys off a set that is
   guaranteed total.

   Rejected: free-text themes with auto-assigned regions — region placement is a deliberate design
   choice per decision 1, and auto-placing unknown regions gives that away for flexibility this
   product does not need (themes change "rarely and deliberately").

   > **The 8 slug *values* are explicitly not settled (owner, 2026-08-01).** What matters here is that
   > the vocabulary is **closed and constrained**, not that it is well-chosen. Which categories
   > actually make sense will be judged once the constellation renders with real data. Re-cutting the
   > set later is cheap by construction: a `THEMES` edit plus one migration, and because
   > `THEME_LABELS` decouples display text from the stored key, *renaming* what the user sees costs
   > nothing at all. Do not treat the current 8 values, or the migration mapping onto them, as a
   > decision requiring defence.

7. **The layout pass is gated on signal density; the hash tier ships first.** Decisions 2–5 are
   accepted, but the *incremental relaxation pass* (decision 3) only earns its keep once
   co-occurrence can actually move a node. Until then it is machinery around what is effectively
   pure hash placement — the alternative this ADR explicitly rejected as an end state.

   So: build the position schema + the hash tier + (optionally) manual override now — per the
   existing Consequences note, *"the map remains renderable at every stage"*, and the hash tier alone
   produces a working constellation. Add the relaxation pass when the data supports it. Same
   accept-the-design-gate-the-build shape as ADR 0018 decision 6.

   The LLM-proposed-relatedness fallback already in decision 4 stays the escape hatch if
   co-occurrence never densifies — still **edges, never coordinates**.

8. **Three view layers, and they are zoom only — no gating.** The map gains layered navigation
   (owner decision), which this ADR previously did not describe at all:

   | Layer | Shows | Interaction |
   |---|---|---|
   | **1 — Roots** | the 8 themes as the root dots | **drag-to-arrange here**; this is where placements get fixed by hand |
   | **2 — All nodes** | every skill node within its theme region | pan + zoom matter most; minor nodes surface as zoom increases |
   | **3 — Focus** | one theme/root in isolation | entered at sufficient zoom (mechanism TBD) |

   **The themes ARE the roots** (owner decision) — no new hierarchy, no parent/child between skill
   nodes, no promotion rule. This deliberately reuses the grouping that already exists, and it means
   layer-1 dragging arranges **8 regions**, not dozens of nodes, which is exactly what decision 1's
   hand-placed `THEME_LAYOUT` already is. The layers give that constant a UI.

   **This does not revisit Skill-*Map*-not-Tree.** Layers are a viewing device: no prerequisites, no
   unlock order, every status still reachable from every status. The owner's phrasing "skill tree"
   referred to the visual, not to gating. Ordering nodes *meaningfully* is noted as a desirable
   future outlook, explicitly conditional on the app having run long enough for the real node set to
   support it — not a commitment here.

   **Manually creating a new root is deferred, and is the same feature as ADR 0027.** The owner wants
   to declare a new root/category, have it search already-ingested content, and then fetch new
   material from the web for it. That is node-seeding (**ADR 0027**, proposed) applied at the theme
   level, and it inherits 0027's unresolved whitelist-anchor problem and its collision with ADR 0001.
   Out of scope here; cross-referenced so the two are not designed twice.

9. **One canonical position per node — mobile zoom never recomputes layout.** §9.8's suggestion that
   theme-zoom could re-arrange a theme's nodes for better screen use is **rejected**: a node
   appearing in two places depending on zoom destroys the cross-device spatial memory that is the
   entire justification for stable placement. Zoom pans and scales one coordinate space. The screen
   efficiency lost at theme-zoom on a narrow phone is the accepted cost.

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
- **Schema (decision 6): `skill_nodes.theme` gets constrained** to the 8 `THEMES` values, plus a
  data migration for existing rows and a fix to `scripts/seed-dev.sql`. This is a prerequisite for
  `THEME_LAYOUT`, not optional cleanup — the layout has no region for an off-vocabulary theme.
  A `THEME_LABELS` display map is added alongside so UI copy is not the storage key.
- **Decision 7 splits the work into two shippable stages:** (a) position schema + hash tier +
  optional manual override — renders a real constellation, no signal needed; (b) the incremental
  relaxation pass, gated on co-occurrence density. Stage (a) is buildable now.
- **Decision 8 is UI work** across three layers, with layer-1 drag-to-arrange as the curation
  surface. Note the unresolved code-vs-DB question for theme centres in Open questions.
- New layout module computing/storing placements incrementally; runs after SkillTagger creates
  nodes, and on explicit full-relayout request.
- Edit mode is UI work gated to larger viewports; needs a "reset to computed" per node and a
  "re-layout unlocked nodes" action.
- The map remains renderable at every stage of this ADR's implementation — hash tier alone already
  produces a working constellation, which means the visual can ship before the layout pass exists.
  That's deliberate: it de-risks the most speculative part of the Skills vision.

## Open questions

- **Overflow within a theme:** a theme that accumulates 30+ nodes will crowd its circle. Grow the
  radius, allow a second ring, or cap and paginate? Not urgent at current node counts (max 3 per
  theme), but it is the failure mode that arrives with success. **Decision 8's layer 2 makes this
  more pressing than it was** — that layer is explicitly the "could become quite large" view, so
  whatever answers overflow also answers how layer 2 stays legible.
- **Should `position_locked` be exposed on the node detail page**, or only inside edit mode? Minor,
  but affects whether a curated placement is discoverable as a property of the node.
- **New (decision 8): how is layer 3 entered?** The owner's model is "with enough zoom and changing
  the mode — how, I don't know yet". Options include a zoom threshold, an explicit mode toggle, or
  tapping a root. Deliberately left open; it is an interaction-design question best answered against
  a rendered map, not on paper.
- **New (decision 8): does layer 1 dragging need a separate stored position from layer 2?**
  `THEME_LAYOUT` is currently a code constant (decision 1) while node positions are DB rows
  (decision 2). If the owner drags *theme regions* at layer 1, those centres stop being purely
  designed constants and become stored state too — which is a small but real inversion of decision
  1's code-vs-DB split. Needs deciding before layer-1 dragging is built.
