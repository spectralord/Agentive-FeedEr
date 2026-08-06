# ADR 0011 — Two-tier content verifier

- Status: accepted (design; implementation open)
- Date: 2026-07-23
- Touches: ADR 0003 (single pass), ADR 0001 (curated sources), ADR 0004
  (derived views), ADR 0007 (experience reports), ADR 0008 (layers)

## Context / Problem

The verifier is meant to critically cross-check content. But an LLM that judges "truth"
is itself most likely to hallucinate exactly there — an unreliable checker is worse
than none. At the same time, `quality_score` already exists (substance vs. hype), so the
verifier must deliver *something different* in order not to be redundant.

## Decision

The verifier is **two-tiered**, along the layers from ADR 0008:

**Tier 1 — Reel verifier (ephemeral Reels):**
- A **dedicated critic pass** (separate LLM call, "critic" role) receives **source +
  finished Reel** and checks: **(A) fidelity** — does the write-up overstate the
  source? — and **(B) skepticism** — risky claim types (unsubstantiated benchmarks,
  superlatives/"X replaces Y", single-case generalizations).
- Result: `caveat` (text, nullable). **Gated:** only checks Reels that are actually
  displayed (above the quality/relevance threshold) → cost stays bounded.
- `caveat` is its **own stored fact**, made visible as ⚠️, and is
  filterable, **but does not feed into `quality_score`** (separate signals, ADR 0004;
  "transparency instead of silently hiding").

**Tier 2 — Cluster corroboration (durable knowledge layer):**
- At the cluster/knowledge level, a **`confidence`** is derived from the number of
  **independent supporting sources** — a **consensus signal**, not an LLM truth
  judgment.
- **Own corpus first** (topic cluster with N independent sources); **external
  web search later** as a deliberate extension (touches ADR 0001 → its own decision).
- Depends on **clustering** (`topic_cluster` / content model C / vision V1).

**Experience reports (ADR 0007 preserved):** tier-1 fidelity does not apply (no external
source reference); skepticism only as a **narrow overclaim flag** (absolute
statements), **never** subjectivity itself. Main value is tier-2 corroboration. The
`caveat` **frames**, it does not discredit.

Tier 1 is a **second pass** and thus **revises ADR 0003** (single pass) — in
the same spirit as ADR 0009 (SkillTagger): distinct concerns get their own
pass with matching context.

## Alternatives

- **Real fact-checker against external knowledge (tier-1-C):** highest hallucination risk
  in the checker itself. Rejected; if used at all, then as grounded corroboration (tier 2).
- **Self-flagging in the enrichment single pass:** cheap, but self-critique bias undermines
  the purpose. Rejected in favor of the dedicated critic pass.
- **Fold `caveat` into `quality_score`:** mixes two different signals
  (fidelity caveat vs. substance). Rejected (ADR 0004).

## Consequences

- Two checking levels with different effort/cadence: tier 1 per Reel (cheap, gated),
  tier 2 rarely at cluster level (needs clustering).
- New stored field `caveat` on Reels; `confidence` at cluster level (later).
- Reliability through groundedness (fidelity = comparison with source; confidence =
  counting independent sources) instead of a fabricated second opinion.
- Cost: +1 LLM call per displayed Reel (Haiku, gated). External web corroboration
  is a later, separately decided extension.
