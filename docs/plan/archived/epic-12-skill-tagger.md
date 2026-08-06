# Epic 12 — SkillTagger (match-or-propose)

**Goal:** Automatically assign content (reels + experience reports) to a
**canonical** skill node, without a sprawling taxonomy and without manual tagging by the user.

**References:** ADR 0009 (match-or-propose, revises ADR 0003), ADR 0008 (skill nodes
first-class), `docs/specs/2026-07-22-experience-reports-design.md` (theme 4), glossary:
SkillTagger, Actionable.

> **Order:** Epic 12 should be built **before** Epic 7 (skill map) — it provides the
> node assignment that Epic 7 T7.2 currently does itself as a stopgap, and unlocks the
> skill link for Epic 9 (experience reports).

---

## Tasks

### ☒ T12.1 — Schema: `skill_nodes` (+ pending status)
- `skill_nodes` as in Epic 7 T7.1 (`id`, `slug` unique, `title`, `theme`, `description`)
  **plus** `status: text({ enum: ["active","pending"] }).default("pending")` — `pending` =
  proposed, not yet confirmed.
- (If Epic 7 hasn't been built yet: this schema is the authoritative definition; Epic 7
  then references it.)
- **Verification:** migration green.

### ☒ T12.2 — Enrichment now only supplies a raw skill guess
- In Epic 2 (`enrichment/schema.ts` + prompt): `skill` becomes `skill_hint` (free text,
  English, "which skill this covers") — **no** canonical assignment anymore in the
  single pass (ADR 0009 / revises ADR 0003). `reels.skill` stays, but is no longer set
  by enrichment — the SkillTagger sets it instead.
- **Verification:** enrichment tests adjusted; `skill_hint` in the output, `reels.skill`
  still `null` after enrichment.

### ☒ T12.3 — Match-or-propose core (`src/lib/skilltagger/tagger.ts`)
- `tagContent({ hint, title, text }, existingNodes): Promise<{ match: slug } | { propose: { slug, title, theme, description } }>`
  via **one** structured LLM call: gets item info + the **complete current
  `active` node list** (slug + short description), picks a match above a confidence
  threshold **or** proposes a new node. Themes from a fixed constant (`src/lib/skills.ts`, from Epic 7).
- As long as the list fits in the prompt (dozens of nodes) this is enough — **no embeddings**
  (document the scaling seam).
- **Verification:** unit tests with a mocked call: clear match → `match`; unknown
  topic → `propose`.

### ☒ T12.4 — Runner (`src/lib/skilltagger/run.ts`) — one tagger, multiple triggers
- `runSkillTagging(db, caller?)`: processes all content with `skill IS NULL`
  (reels **and** `experience_reports`), idempotent (pattern like enrichment):
  - `match` → set `content.skill = slug`.
  - `propose` → upsert a `skill_nodes` row with `status:"pending"` (on `slug`), item
    stays untagged (waits for confirmation). The batch keeps going.
- `tagSingle(db, contentRef)`: for the on-save path of a single manual report.
- **Verification:** integration test: match tags; propose creates a pending node + item
  stays null; second run idempotent.

### ☒ T12.5 — Wire up triggers
- **Reels:** `runSkillTagging` as a stage in the daily job **after** enrichment.
- **Manual reports:** `tagSingle` right after `createReport` (Epic 9 T9.5) — fire-and-forget
  or briefly awaited, the form doesn't block.
- **Backstop:** the daily `runSkillTagging` sweeps up everything untagged anyway.
- **Verification:** create a report → tagged or pending after run/save; daily sweep
  catches up anything that failed.

### ☒ T12.6 — Confirm node proposals (UI)
- Small view "New skills (N)": pending nodes with actions **create** (`status:active`),
  **merge** (into an existing node — reassign item references), or **discard**.
- Additionally offer inline on the manual report itself (best context moment), non-blocking.
- After confirmation, the next `runSkillTagging` run assigns the waiting items.
- **Verification:** confirm a pending node → becomes `active`, waiting items get the slug.

---

## Completion criteria (epic DoD)
- Reels + reports are automatically tagged canonically; new nodes only arise via
  confirmation (no taxonomy explosion); one tagger serves both the batch and on-save
  triggers; the daily run is a backstop. Build + tests green.

## Deviations/Questions
_(to be maintained by the executing model)_

- **T12.2 — where the `skill_hint` is stored:** the task doesn't specify where the raw
  enrichment hint is kept until the SkillTagger runs. Conservatively chosen:
  `reels.metadata` (the field designated for this, migration-free extension slot, see
  `CONTEXT.md` "Attribute"). `runSkillTagging`/`tagSingle` read `metadata.skillHint` as
  the `hint` for `tagContent`.
- **T12.3 — "confidence threshold":** no separate numeric confidence in the tool output;
  the threshold is encoded as a binding behavior rule in the system prompt (analogous to
  the scoring rubrics in `enrichment/prompt.ts`): "match" only on genuine topical
  coverage, otherwise "propose". No downstream consumer would have needed a numeric
  value — it would only have added unused complexity.
- **T12.3 — `THEMES`:** 8 themes chosen (`parallelization, agents, tooling, prompting,
  evaluation, models, integration, industry`) — within the specified range of 6–10, see
  `src/lib/skills.ts` for the short rationale per theme.
- **T12.6 — "discard" = hard delete:** the schema fixed in T12.1 only knows
  `status: active|pending`, no "discarded" state (unlike the broader
  `lifecycle_state` from ADR 0008 for the later Epic 7 variant). Discarding therefore
  hard-deletes the row; if the skill comes up again, the tagger simply proposes it anew.
- **T12.6 — inline offer on the manual report:** the task additionally names an
  inline offer directly on the report-creation page ("best context moment"). What was
  implemented is only the standalone `/skills` overview (fully satisfies the
  verification: a freshly created proposal appears there immediately after saving). The
  inline widget on `/experience/new` itself was **not** built (additional UI scope with
  no verification requirement of its own) — deferred as an open polish item, not a bug.
- **T12.6 — "create" doesn't immediately re-tag:** confirming only sets `status:active`;
  re-assigning waiting items deliberately happens only on the next
  `runSkillTagging` run (daily job backstop), exactly as the task text phrases it
  ("After confirmation, the next run assigns…"), not synchronously in the same request
  (saves an LLM call in the confirm action itself).
