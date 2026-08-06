# ADR 0009 — Skill tagging as a match-or-propose pipeline stage

- Status: accepted
- Date: 2026-07-22
- Touches: ADR 0003 (single-pass enrichment)

## Context / Problem

Content (Reels + Experience Reports) should be assigned to a skill node without the
user manually tagging it. Two naive approaches fail:
- **Free generation** of a slug per item ⇒ taxonomy explosion (`prompt-caching`,
  `prompt-cache`, `caching` … as separate nodes).
- **Fixed, closed list** ⇒ new/emerging skills cannot be captured —
  fatal for a "keep up with the field" tool.

Moreover, the enrichment single pass (ADR 0003) cannot cleanly perform the assignment: it
only sees *one* item, not the *global* current node list needed for
matching.

## Decision

A **dedicated pipeline step "SkillTagger"** assigns via **match-or-propose**:
- **Match:** item + current skill node list (slugs + short descriptions) → best
  match, if above a confidence threshold. Matches are assigned
  **automatically in the background**.
- **Propose:** if nothing fits, a new node is *proposed* — created **only with
  user confirmation** (create / merge into existing / discard). Proposals do not block
  the batch; the item stays untagged until confirmed.
- **Scaling:** as long as the taxonomy fits into the prompt (dozens of nodes), plain
  LLM matching suffices. Embedding-based dedup is a **later** optimization for
  large taxonomies — not in the initial build.

Consequence for ADR 0003: skill assignment moves **out** of the single pass. The
enrichment pass now only delivers a **raw competency guess** (free text); the
reconciliation against the controlled vocabulary list is done by the SkillTagger.

**One tagger, multiple triggers** (logic decoupled from trigger, processes `skill IS NULL`):
- **Reels:** as a stage in the daily job after enrichment (batch).
- **Manual reports:** directly after saving, for that one item (single call, cheap).
- **Daily run as backstop:** sweeps all still-untagged items (failed
  on-save tagging, proposals released after confirmation).

## Alternatives

- **Open generation / closed list:** see problem — both rejected.
- **Leave assignment in the enrichment single pass:** no global taxonomy
  context, explosion risk. Rejected.
- **Embeddings/vector dedup right away:** unnecessary complexity + dependency for a small
  taxonomy. Deferred to later.

## Consequences

- Controlled, but *growing* taxonomy: automatic matching, new nodes only via
  one-click confirmation — prevents sprawl.
- Enrichment is relieved of the hard skill decision (delivers only a guess).
- New state needed: "pending proposal" for proposed, unconfirmed nodes.
- Embedding provider choice remains an open, deliberately deferred decision.
