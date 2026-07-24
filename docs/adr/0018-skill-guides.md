# ADR 0018 — Skill Guides: synthesised durable knowledge per Skill Node

- Status: proposed (needs strong-model grill — schema + new pipeline pass)
- Date: 2026-07-24
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

- Schema: guide content + `synthesised_at` + source-item count. Either columns on `skill_nodes`
  or a small `skill_guides` table (implementer's call; a table is cleaner if guide history is ever
  wanted, and history is what makes §9.7's "what changed" diffs possible).
- New pipeline pass + prompt + executor-backed module, triggered after SkillTagger in the daily
  job and exposed as a manual admin action, consistent with existing passes.
- `CONTEXT.en.md` gains a **Skill Guide** glossary entry.
- Unlocks the whole §9.7 consolidation family (explain-it-back, decay prompts, change diffs) —
  none of which are buildable without a stable document to test against.
- Cost: one more LLM pass. Threshold-gated, so it scales with *new tagged content*, not with node
  count.

## Open questions

- **Guide structure:** free prose, or a fixed section skeleton ("what it is / when to use /
  pitfalls / how it changed")? Fixed sections make diffs and partial regeneration much easier;
  free prose reads better. Leaning fixed-ish, but genuinely open.
- **Model choice:** synthesis across many sources is a harder task than per-item enrichment
  (currently Haiku). Worth deciding deliberately rather than inheriting the default.
- **Minimum content threshold:** how many tagged items before a node earns a guide at all? A node
  with two Reels probably shouldn't have one (the prototype renders this state honestly as "not
  enough signal to synthesise").
