# ADR 0017 — Write-up: a second enrichment pass for long-form Reel content

- Status: **accepted** 2026-08-01 (user decision). Decision 1 (the `reels.writeup` field) and the
  Write-up tab were accepted 2026-07-25 and built as Epic 18 T18.6. **Decisions 2–4 — the second
  pass that fills the field — are now accepted as written**: a decoupled pass (2), sourced-only
  from the already-stored `raw_items.raw_content` (3), through the injected Executor seam (4). All
  three open questions are resolved in the section at the bottom; the resolution is that generation
  is **user-triggered on demand**, whose mechanism is **ADR 0024**. `writeup` remains `NULL` — and
  the tab keeps its explicit placeholder — for any Reel nobody has requested a write-up for, which
  is now the expected steady state rather than a temporary gap.
  Was: partially accepted 2026-07-25.
- Date: 2026-07-24 (amended 2026-07-25, 2026-08-01)
- Related: `docs/specs/2026-07-24-ux-gamification-design.md` §2.2/§8.1 (the Detail view's
  Write-up tab this backs), ADR 0002 (decoupled ingestion/enrichment), ADR 0003 (structured
  single-pass enrichment), ADR 0005 (sourced-only), ADR 0015 (executor seam, binding)

## Context / Problem

The UX design for the Reel Detail view includes a "Write-up" tab: a genuinely longer, more
discursive piece of writing than the Compact card's one-paragraph `summary` — closer to "what does
this actually mean, what's the context, what would I compare it to" than a news-brief. No field in
`reels` holds this today; `summary` is short by convention (one paragraph), `example` is a short
sourced snippet, `action` is one sentence. Building the Write-up tab's UI without this field would
mean either duplicating `summary` (adds a navigation step for zero new information) or leaving the
tab empty for most Reels.

The product owner explicitly wants the tab kept and is open to a data-model change to support it —
this ADR is that change, proposed for grill/review rather than assumed.

## Decision (proposed)

1. **New field: `reels.writeup` (text, nullable).** Longer-form prose — a few paragraphs, no hard
   cap, written by a second LLM pass. Nullable because not every Reel need get one immediately (or
   ever — see the generation-scope question below); Compact and the rest of Detail work correctly
   with it absent (the Write-up tab simply isn't shown, per the design doc's tab-hiding rule).

   > **AMENDED 2026-07-25 (user decision) — the Write-up tab is never hidden.** The original
   > wording above made the tab conditional on content existing, which would have left it
   > invisible until the enrichment pass ships. The product owner's requirement is the opposite:
   > **the tab must be present now, before any content exists**, because the point of building
   > the redesign is to *feel how the surfaces flow together* in a real front end — which cannot
   > be evaluated from a static prototype, and cannot be evaluated at all for a tab that isn't
   > rendered. So: when `writeup IS NULL`, the tab still renders, showing **explicitly-marked
   > placeholder content** (clearly labelled as such — not silently duplicated `summary` text
   > passed off as real). The §2.2 tab-hiding rule continues to apply to **Context and Skill**,
   > and Write-up remains the one tab that is always shown, exactly as §2.2 already states.
   > This also supersedes §8.1's "adds a navigation step for zero new information" objection for
   > the interim period: the navigation step is the thing being evaluated.

2. **A second, decoupled pass, not a change to the core enrichment call.** Consistent with the
   existing pattern (SkillTagger, Clustering, Topic-Knowledge-Check all run as their own passes
   after the initial Reel-creating enrichment) — this keeps ADR 0003's single-pass *core*
   enrichment contract intact and lets Write-up generation be retried/re-run independently without
   touching the fields the core pass owns.

3. **Sourced-only still applies (ADR 0005).** The write-up elaborates using the *already-stored*
   `raw_items.raw_content` (no new fetching) — it can draw on more of that content than the short
   `summary` does, but it may not introduce claims the source doesn't support. This is explicitly
   **not** the same feature as the Deep-Dive vision (Epic 8): Deep-Dive is on-demand, agentic,
   fetches *new* external pages beyond the original source. Write-up is a batch pipeline step
   working from what's already been ingested. Keeping these conceptually separate matters — reusing
   "Deep-Dive" language for this would collide with an already-reserved term (see CONTEXT.en.md).

4. **Goes through the Executor seam.** Per ADR 0015 (binding): an injected `Executor`, wired
   through `pipeline.ts`, zod-validated output, unit test with a mocked caller — no direct API
   access, no `claude-code`-path fallback. Same requirement as every other LLM step added since
   that ADR.

## Alternatives

- **Lengthen `summary` itself instead of adding a field:** simpler schema, but conflates two
  different jobs — a fast-scan compact summary and a genuinely longer piece — forcing Compact to
  either show all of it (defeats the "compact" card's purpose, reintroduces the over-long-card
  problem earlier iterations moved away from) or truncate awkwardly. Rejected in favor of a
  separate field with a separate purpose.
- **Generate on-demand when a user opens the Write-up tab (lazy):** cheapest in aggregate token
  spend, but adds latency to a tap that should feel instant, and starts to resemble Deep-Dive's
  on-demand shape closely enough to blur the distinction point 3 above is trying to keep clean.
  Not rejected outright — worth the strong model's judgment call, see Open questions.

## Consequences

- Migration: add `writeup text` (nullable) to `reels`.
- New pipeline step + prompt, new executor-backed module (naming to follow existing convention,
  e.g. `src/lib/writeup/`), triggered after core enrichment in the daily job and available as a
  manual admin action (consistent with how other passes are exposed today).
- `CONTEXT.en.md` gets a glossary entry for **Write-up** (added alongside this ADR).
- UX design doc's Detail view now depends on this ADR landing before the Write-up tab can ship
  with real content — tracked as task #10 in that doc's priority list, explicitly independent of
  tasks #1–9.

## Open questions — all three RESOLVED 2026-08-01 (user decision)

The resolution is a single decision that answers all three at once: **generation is
user-triggered, on demand, from the Write-up tab.** See **ADR 0024** for the mechanism.

- ~~**Generation scope:**~~ **Resolved: ungated, but nothing is generated until asked for.** Both
  proposed gates were rejected on the same ground — this is a **single-user** app, so
  `QUALITY_THRESHOLD` and "Top-N/day" are proxies for "content someone might open" in a product
  where the user *is* the only someone, and where the act of opening a Reel is itself the signal.
  Gating on a popularity heuristic to predict the interest of the one person who can just press a
  button is strictly worse than the button. There is no per-Reel cost question left: quota is spent
  only on items actually being read.
- ~~**Model choice:**~~ **Resolved: the executor decides, not this pass.** Under ADR 0024 the
  write-up runs through the `claude-code` executor, i.e. the Claude Code **subscription**, not the
  metered API — so the "Haiku for cost" reasoning that governs batch enrichment does not transfer.
  The pass names no model of its own; it inherits whatever the executor resolves.
- ~~**Lazy vs. batch:**~~ **Resolved: lazy.** The Alternatives section leaned batch to avoid making
  the user wait. That trade-off inverts once generation is an explicit, user-initiated action: a
  visible "generating…" state on a button the user just pressed is understood latency, not a stall.
  Batch would also spend quota ahead of demand — the thing lazy generation exists to avoid.

`writeup` is a persisted column, so this stays a one-time cost per Reel: once generated it is
cached for every subsequent read (and, in a multi-user future, for every user).
