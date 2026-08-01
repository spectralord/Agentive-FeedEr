# ADR 0018 — Skill Guides: synthesised durable knowledge per Skill Node

- Status: **accepted** 2026-08-01 (grill session, strong model + user). Decisions 1–5 accepted as
  written; three amendments below (6 = build precondition, 7 = Reels-only for v1, 8 = manual
  control). **Design accepted, implementation gated** — see decision 6: this must not be built
  against today's corpus. Unblocks ADR 0020 and ADR 0022, both of which needed Guides *decided*,
  not shipped.
  Was: proposed (needs strong-model grill — schema + new pipeline pass).
- Date: 2026-07-24 (grilled + amended 2026-08-01)
- Related: ADR 0008 (durable vs. ephemeral layers — this ADR patches a real hole in it),
  ADR 0005 (sourced-only), ADR 0012/0013 (grounded cluster signals), ADR 0015 (executor seam,
  binding), ADR 0017 (Write-up — a *different* thing, see below)
- Design context: `docs/specs/2026-07-24-ux-gamification-design.md` §9.2

## Context / Problem

ADR 0008 promises a **durable knowledge layer** that accumulates while Reels rotate out of the
active views. Inspect what actually accumulates today: a `skill_nodes` row (slug, title, theme,
one-line description) plus the user's own `user_progress` notes. **No knowledge.** Once every Reel
tagged to "Prompt Caching" has aged out, the node is an empty shell pointing at nothing.

That has two consequences. The durable layer doesn't durably hold anything worth keeping; and
understanding a topic today means reading N news items in reverse-chronological order and
assembling the synthesis yourself, every time.

## Decision (proposed)

**A Skill Guide: one synthesised, durable document per Skill Node**, generated from all content
ever tagged to that node (Reels + Experience Reports), updated as significant new content arrives.

1. **Scope: per Skill Node, not per theme and not a new entity.** The guide belongs to the node
   (1:1, nullable). This deliberately avoids introducing a third grouping level above skill nodes
   — the exact collision ADR 0013 rejected for clusters.

2. **Citations are mandatory.** Every claim in a guide traces back to the Reel(s) it came from.
   A guide is *more* interpretive than a single-source summary (it synthesises across sources),
   so it needs *more* traceability, not less — otherwise it is unfalsifiable LLM prose sitting
   inside a product whose entire trust model is sourced-only (ADR 0005). A guide that cannot cite
   a claim must not make it.

3. **Regeneration is threshold-based, not per-Reel.** Re-synthesising on every newly tagged Reel
   is expensive and makes the document shift under the reader. Regenerate when N new items have
   been tagged since the last synthesis (N as an env-tunable constant, consistent with
   `MAX_ENRICH_PER_RUN`/`QUALITY_THRESHOLD` handling), or on explicit request.

4. **Staleness is visible.** A guide carries `synthesised_at`; the UI surfaces age. A six-month-old
   guide on a fast-moving topic is actively misleading, and Epic 11's freshness machinery already
   exists to detect exactly this class of problem.

5. **Goes through the Executor seam** (ADR 0015, binding): injected `Executor`, wired via
   `pipeline.ts`, zod-validated output, unit test with a mocked caller.

### Amendments from the 2026-08-01 grill

6. **Build precondition: do not implement this against the current corpus.** Measured in
   `feedr_dev` on 2026-08-01: four active skill nodes holding **3, 3, 3 and 1** tagged Reels; 16
   Reels total, 10 tagged; `pipeline_runs` has **one** row, i.e. the pipeline has effectively never
   run for real. A guide synthesised from three news items is not a synthesis — it is a list with
   prose overhead.

   This ADR's design is accepted, but implementation waits until at least one node carries enough
   tagged content to synthesise from. **This is the project's third brush with the same failure
   mode** — designing a surface against content the pipeline does not produce (a long-form field
   that did not exist; a multi-step checklist with no backing table). Catching it before building
   is the point.

   Corollary: open questions 1–3 below (structure, model, minimum threshold) are **empirical**.
   They are not answerable from the armchair and are deliberately left open until there is real
   content to judge — see their resolutions.

7. **v1 synthesises Reels only. Experience Reports are out of scope.** The original decision text
   named "Reels + Experience Reports" as source material, presenting as settled something that is
   not wired: `experience_reports.skill` exists as a column but is **NULL on every row**, and
   nothing populates it — SkillTagger tags Reels, not reports. Rather than smuggle a prerequisite
   task onto the critical path, v1 reads Reels via `reels.skill → skill_nodes.slug` (verified as a
   clean join). Extending guides to Experience Reports is a later, separate change that must first
   answer how reports get tagged.

8. **Manual control is part of the feature, not an afterthought.** The owner will be tuning this
   heavily against whatever the real corpus turns out to look like, so all four of these are in
   scope:

   - **Manual regenerate**, per node, ignoring the threshold in decision 3.
   - **Env-tunable thresholds** — both the regeneration N and the minimum-items-to-earn-a-guide
     floor, following the existing `QUALITY_THRESHOLD` / `MAX_ENRICH_PER_RUN` convention.
   - **Hand-editable guide text**, where the edit is **never destroyed** by regeneration.
   - **Manually declared nodes** — creating a skill node directly, not only by confirming a
     SkillTagger proposal (`/skills` already has confirm/merge/discard; this adds create-from-scratch).

   **Edit preservation is layered, not merged** (owner decision, 2026-08-01). The generated text and
   any manual edit are **separate stored layers**. Regeneration replaces only the generated layer;
   the manual edit survives untouched and is surfaced alongside it, with a diff of what changed
   underneath, and the user decides whether to fold it in. Automated LLM "fusion" of an edit with a
   fresh generation was considered and rejected: it is a three-way-merge problem whose failure
   modes are silently dropping the correction or emitting self-contradicting prose.

   The system should additionally **flag a manual edit when newer/better generated content exists**,
   to inform and encourage action rather than letting a stale hand-written passage sit unnoticed.

   The **writing assistance** the owner wants when authoring manual content is deliberately *not*
   specified here — it is a reusable, cross-cutting capability (toggleable, local-mode only) and is
   therefore its own decision: **ADR 0026**.

**Not the same as Write-up (ADR 0017) or Deep-Dive (Epic 8).** Three distinct things, worth
keeping straight:

| | Scope | Source material | Trigger |
|---|---|---|---|
| **Write-up** (ADR 0017) | one Reel | that Reel's stored `raw_content` | batch, per Reel |
| **Guide** (this ADR) | one Skill Node | *all* content tagged to the node | threshold-based |
| **Deep-Dive** (Epic 8) | one Reel | fetches *new* external pages | on-demand, agentic |

## Alternatives

- **Guide per theme instead of per node:** far fewer documents, but "Agentic Development" is not
  a thing you sit down and read — the theme level is a coarse grouping axis (8 values), not a
  learnable unit. Rejected.
- **Generate on demand when the user opens the node:** cheapest in aggregate spend, but adds
  latency to a tap and drifts toward Deep-Dive's on-demand shape, blurring a distinction worth
  keeping sharp. Rejected for guides, though it stays a reasonable fallback for rarely-visited
  nodes.
- **No guide; just list the tagged Reels (status quo):** free, and honest — but leaves ADR 0008's
  durable layer holding no knowledge, and leaves the "study" verb missing from the product.
  Rejected; that hole is the whole point of this ADR.

## Consequences

- Schema: guide content + `synthesised_at` + source-item count. **Decision 8 settles what was left
  as the implementer's call here: a `skill_guides` table, not columns on `skill_nodes`.** Layered
  edits require storing the generated text and the manual edit separately, plus enough history to
  diff a regeneration against what the reader last saw — that is a row-per-version shape, which
  columns on `skill_nodes` cannot express. This also happens to be what §9.7's "what changed" diffs
  need, so the two requirements agree.
- New pipeline pass + prompt + executor-backed module, triggered after SkillTagger in the daily
  job and exposed as a manual admin action, consistent with existing passes.
- `CONTEXT.en.md` gains a **Skill Guide** glossary entry.
- Unlocks the whole §9.7 consolidation family (explain-it-back, decay prompts, change diffs) —
  none of which are buildable without a stable document to test against.
- Cost: one more LLM pass. Threshold-gated, so it scales with *new tagged content*, not with node
  count.

## Open questions

**Deliberately deferred to implementation time, per decision 6 — these are empirical.** All three
depend on what the real corpus looks like, and answering them now would be guessing dressed as a
decision.

- **Guide structure:** free prose, or a fixed section skeleton ("what it is / when to use /
  pitfalls / how it changed")? Fixed sections make diffs and partial regeneration much easier;
  free prose reads better. Leaning fixed-ish. **Note this interacts with decision 8's layered
  edits:** a fixed skeleton makes "which section did the human change" answerable, so the diff
  surface is materially easier to build. That is an argument for fixed sections beyond readability,
  and should carry weight when this is decided.
- **Model choice:** synthesis across many sources is a harder task than per-item enrichment
  (currently Haiku). Under the local profile this runs on the `claude-code` executor
  (subscription, not metered API), so the cost argument for Haiku does not transfer — see ADR 0024
  for the same reasoning applied to Write-up. Decide against real output.
- **Minimum content threshold:** how many tagged items before a node earns a guide at all? Today
  *every* node would fail any sensible floor (max 3 items), which is exactly why decision 6 gates
  the build. The prototype already renders the "not enough signal to synthesise" state honestly.
  Env-tunable per decision 8.

**New, found during the grill — decision 3 has no cold-start rule.** "Regenerate when N new items
have been tagged **since the last synthesis**" is well-defined for *updates* but says nothing about
the *first* synthesis, which is the only one that matters until the corpus grows. The
minimum-content threshold above is the natural place to define it (first synthesis fires when the
node crosses the floor), but that link must be made explicit in the implementation, not left to be
inferred.
