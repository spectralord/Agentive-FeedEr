# Epic 6 — Saves, feedback & resurfacing (Fast-Follow)

**Goal:** Lightweight feedback loop without ML: store reactions (save/hide/👍👎),
saves page, rolling feedback summary as additional enrichment context,
spaced resurfacing of saved reels.

**References:** design doc §7, grill decision "context-based, no ML".

> **Revised 2026-07-23** (see `docs/specs/2026-07-22-experience-reports-design.md`):
> **No `tried`/checkoff on reels in this epic** — reels/reports are never checked off;
> "tried" belongs to the derived **actionables/to-trys** (later, Epic 7 era).
> Epic 6 therefore only builds `save`/`hide`/`up`/`down`. Resurfacing nudges saved
> reels purely time-based (rotates out naturally after 21 days), with no "done" checkbox.

---

## Tasks

### ✅ T6.1 — Schema: `interactions` + `app_state`
```ts
export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").notNull().references(() => reels.id),
  type: text("type", { enum: ["save","hide","up","down"] }).notNull(),
  note: text("note"),                                   // optional (e.g. "why saved")
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appState = pgTable("app_state", {          // generic key-value store
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```
- **Verification:** migration green.

### ✅ T6.2 — API + buttons
- `POST /api/interactions` `{ reelId, type, note? }` (zod-validated) → insert;
  the same `type` on the same reel toggles it (deleting the existing row = undo).
- `ReelCard` gets an unobtrusive action bar (client component): 🔖 Save ·
  👍 · 👎 · 🙈 Hide. Optimistic UI, no full reload.
- `hide` takes effect immediately: the feed query excludes reels with an active hide interaction.
- **Verification:** toggle semantics via API test; hide removes the card from the feed.

### ✅ T6.3 — `/saved` page
- List of all reels with an active `save` interaction, most recently saved first,
  compact display like the overview history; per entry "Remove" (undo the save).
  **No** "tried/done" checkbox (see revision).
- Extend navigation with "Saved".
- **Verification:** save in the feed ⇒ appears here; removing takes it back out.

### ✅ T6.4 — Rolling feedback summary
- In the daily job, after enrichment: if ≥ 10 new interactions since the last
  summary, a small Claude call (Haiku): input = last 100 interactions
  (with reel title/category/skill), output = 5–8 bullet points
  ("likes: …, skips: …"). Result stored in `app_state["feedback_summary"]`.
- The enrichment prompt (Epic 2) appends this summary — if present — as
  additional context below the profile ("Observed behavior: …").
- **Verification:** test with a mocked call; prompt snapshot contains the summary.

### ✅ T6.5 — Spaced resurfacing on `/today`
- Below the Top-N, an extra card "🔁 Keep at it": up to 2 saved reels whose
  save is 7–21 days old — text: "Saved N days ago — take another look?"
  with a link to the reel/source. No "done" checkbox: items rotate out
  naturally after 21 days; whoever wants it gone undoes the save.
- **Verification:** seed data with matching/non-matching time windows (save age).

---

## Completion criteria (epic DoD)
- Reactions take effect immediately in the UI and flow (via the summary) into
  future relevance scoring; saves + resurfacing work; no ML, no new libs.

## Deviations/Questions
_(to be maintained by the executing model)_

- **T6.4 — threshold basis:** "≥ 10 new interactions since the last
  summary" is implemented via a counter comparison
  (`interactionCountAtGeneration` in `app_state["feedback_summary"]` vs.
  the current total count in `interactions`), not via a timestamp
  boundary — more robust against interactions that were undone (toggled)
  in the meantime, and easier to test. Behavior matches the specification.
- **T6.4 — order within the pipeline step:** `runEnrichment` reads the
  *previously* stored summary (if present) as context for the
  current run; `runFeedbackSummary` runs afterward and updates the
  summary for the *next* run — this keeps it a rolling
  summary instead of a "sees itself" circular loop.
  `runFeedbackSummary` errors are caught in `runPipelinePhases` and only
  logged (the run doesn't abort), analogous to the existing
  job error-handling principle.
- **T6.5 — no fallback when Top-N is empty:** if `/today` is empty anyway
  ("Nothing important today"), no "keep at it" card currently appears —
  the specification explicitly describes it as "below the Top-N", so it
  was conservatively attached only to the existing Top-N case rather than
  as an independent alternative path.
- **T6.5 — link target:** "link to the reel/source" is implemented as an
  external source link (`reel.url`, as in `ReelCard`/`SavedList`) — there
  is no internal reel detail page in the MVP.
