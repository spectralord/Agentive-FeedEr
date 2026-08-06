# Epic 7 — Skill map (Vision flagship)

**Goal:** Skill nodes instead of reel confetti: reels collect under skill nodes,
grouped into theme clusters, with progress `seen → tried → mastered`
via self-confirmation + adoption log. **No** prerequisite tree (deliberate
decision: skill *map*, variant A).

**References:** glossary: skill node, skill map, user_progress, adoption log;
grill decisions (nodes = skills; self-confirmation; no gates).

> **Revised 2026-07-22** (see `docs/specs/2026-07-22-experience-reports-design.md`):
> (1) **Build Epic 12 (SkillTagger) first** — T7.2 (node aggregation) is
> replaced/extended by it; `skill_nodes` is defined in Epic 12 T12.1 (incl. `pending` status).
> (2) Progress additionally runs via checked-off **actionables** (from reels *and*
> experience reports), not only via self-status; both exist side by side.
> (3) **Experience reports** (Epic 9) also show up on skill nodes, labeled alongside reels.

---

## Tasks

### ☑ T7.1 — Schema: `skill_nodes` + `user_progress`
```ts
export const skillNodes = pgTable("skill_nodes", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),        // = reels.skill (kebab-case)
  title: text("title").notNull(),               // readable
  theme: text("theme").notNull(),               // cluster, e.g. "Agentic Development"
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userProgress = pgTable("user_progress", {
  skillNodeId: integer("skill_node_id").primaryKey().references(() => skillNodes.id),
  status: text("status", { enum: ["seen","tried","mastered"] }).notNull().default("seen"),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```
- **Verification:** migration green.

### ⊘ T7.2 — Node aggregation in the daily job (superseded by Epic 12, not built — see Deviations)
- After enrichment: all distinct `reels.skill` slugs without a `skill_nodes` entry →
  **one** Claude call (batch) produces `{ title, theme, description }` per new slug;
  have it pick themes from a fixed small list (e.g. "Claude & Models",
  "Agentic Development", "Tooling & Workflow", "Prompt/Context Engineering",
  "Fundamentals & Technique") — list as a constant in `src/lib/skills.ts`.
- Upsert; never overwrite existing nodes.
- **Verification:** test with a mocked call; running twice produces no duplicates.

### ☑ T7.3 — `/skills` page (skill map)
- Grouped by `theme` (CSS grid cluster; **no** graph layout, no new lib).
- Node tile: title, reel count, status ring (gray=seen/blue=tried/gold=mastered),
  "🧪" dot if > 50% of the associated reels are experimental.
- Clicking a node ⇒ detail panel: description, associated reels (compact, with links),
  status-change buttons (seen→tried→mastered, each with an optional note;
  downgrading allowed), previous notes in chronological order (= the node's adoption log).
- A status change additionally does **not** create an `interactions` row with
  `type:"tried"` on a representative reel — progress lives exclusively in
  `user_progress` (one source of truth, no double-booking).
- **Verification:** seed with 3 themes/6 nodes; status changes + notes persist.

### ☑ T7.4 — Adoption log view
- On `/skills` a tab/section "Adoption log": all `user_progress` notes +
  tried notes from Epic 6, chronological — "what have I actually adopted
  through the tool".
- **Verification:** entries from both sources appear merged.

---

## Completion criteria (epic DoD)
- Reels automatically aggregate under nodes; the map is usable on iPad;
  progress + notes persist; no gates/prerequisites anywhere in the code.

## Deviations/Questions
_(to be maintained by the executing model)_

**Foundation-slice re-scope (2026-07-24, executing model):** built per an explicit
narrower brief from the strong model, superseding some of this file's original task
descriptions:
- **T7.2 (node-aggregation) is NOT built here** — Epic 12's SkillTagger already creates
  `skill_nodes` via Match-or-Propose; this epic only reads `status: "active"` nodes.
- **`user_progress_notes` table added** (not in this file's original T7.1 snippet):
  `user_progress` keeps exactly the given shape (one row per node, single `note` =
  latest note, so map tiles never need a join). Full chronological history — needed
  for the node detail panel and the Adoption-Log (T7.4) — lives in a small append-only
  `user_progress_notes` table (id, skill_node_id, status, note, created_at), same shape
  as other event-log tables in this schema (`interactions`). Only written when
  `setProgress` receives a non-empty note; a bare status change with no note updates
  `user_progress` but leaves no log entry (a silent status flip isn't "adopted").
- **`/skills/[slug]`** (not `/skills/[id]`) is the node detail route, since nodes are
  addressed by slug everywhere else in the UI (SkillTagger's `active`/`pending` list
  already uses slug as the stable identifier).
- **Content counts / associated-content lists are not quality/experimental-filtered**:
  the Skill Map is an index of everything tagged to a node, not the feed — it counts
  and lists all reels with `reels.skill == slug` regardless of `qualityScore`/
  `experimental`, and all experience reports with `lifecycleState: "active"` only
  (matching the default view elsewhere, ADR 0008; deprecated/archived reports are
  omitted from the count but not from the underlying data).
- **T7.4 Adoption-Log = `user_progress_notes` only.** Epic 6 dropped the reel "tried"
  interaction (see `epic-6-interactions.md`, "Revidiert 2026-07-23") — there is no
  second note source left to merge in, unlike this file's original T7.4 wording assumed.
- **No gamified visuals invented.** Status is shown as plain text/badges, not the
  gray/blue/gold rings described in the original T7.3; that visual pass is explicitly
  deferred to a future UX/gamification design session (see `CLAUDE.md`
  Design-Prozess Ebene 2). Marked in the code with `{/* TODO(UX pass): ... */}`.
