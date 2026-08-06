# ADR 0013 — Topic clustering: match-or-propose, narrow granularity, `is_primary`

- Status: accepted (design; implementation open)
- Date: 2026-07-23
- Builds on: ADR 0009 (match-or-propose in skill tagging — the pattern template),
  ADR 0012 (topic knowledge check computes on clusters), ADR 0008 (layers),
  ADR 0004 (derived views), ADR 0003 (null instead of hallucination).
- Prerequisite for: Epic 11 (topic knowledge check), content bundling (content model C).

## Context / Problem

Content model C and the topic knowledge check (ADR 0012) need a **unit of computation**
that groups "multiple sources on *one* topic": that is a **topic cluster**. Open
questions were **how** clusters are formed (stability, granularity), how they relate to
the broad skill level (Epic 12), and how to honestly count "**independent**"
sources for later corroboration, without reblogs inflating the count.

## Decision

1. **Formation = match-or-propose against active clusters** (analogous to ADR 0009). Each
   new Reel is either assigned via LLM pass to an existing cluster within a
   time window (**match**) or justifies a new one (**propose**). This keeps clusters
   **stable** over time (no re-rolling per run) and bounds the LLM context.
   Embeddings/threshold are a later scaling seam, not part of the MVP.

2. **Granularity = narrow / feature- or announcement-specific.** A cluster groups content
   about *one concrete thing and its usage* ("the batch command"), not the generic
   capability. Only this way is a later corroboration number honest (independent sources
   on the *same specific* claim, not mixed topic-wide).

3. **The broad thematic level is the skill node (Epic 12), not a second cluster type.**
   A Reel carries two "peer sets": the **narrow topic cluster** (Epic 15) for
   corroboration/freshness, and one or more **skill nodes** (Epic 12) for the broad
   thematic knowledge/browsing view. There is deliberately **no** standalone
   two-tier cluster hierarchy.

4. **Independence via `is_primary` per cluster member, deliberately coarse.** The clustering
   pass marks, per Reel, whether it is an **independent/first-hand** statement (official
   primary source, own test, experience report) or a recognizable **restatement** of
   another cluster member (reblog). The actual `confidence` is derived by **Epic 11**
   from this as a **coarse scale (few/some/strong)** — not an exact number —
   so that errors in echo detection barely propagate.

## Alternatives

- **Batch clustering / embeddings from the start:** more powerful, but unstable (clusters
  drift per run) or new infrastructure without current scaling pressure. Rejected in favor
  of match-or-propose; embeddings remain a later option.
- **Wide granularity (feature family) as cluster:** dilutes the corroboration number
  (sources counted across different claims). Rejected — breadth belongs at the skill node.
- **A separate two-tier cluster hierarchy** (narrow cluster + thematic super-cluster):
  a third grouping concept alongside tag and skill node, more machinery without added
  benefit, since the skill node already provides the broad level. Rejected.
- **Plain `source` counting for "independent":** distorted by reblogs (echo counts like
  primary). Rejected in favor of `is_primary`.

## Consequences

- New schema: table `topic_clusters`, `reels.topic_cluster_id` (nullable, FK),
  `reels.is_primary`. New pipeline step after enrichment/SkillTagger (cron + admin button),
  fault-tolerant and idempotent.
- Feed bundles clusters as a stacked card ("N sources on this topic"), primary on top.
- Epic 11 (topic knowledge check) becomes buildable: `confidence` from `is_primary`,
  `freshness`/supersession as a grounded comparison of cluster members; both propagate to
  referencing items (ADR 0012).
- External web corroboration (actively expanding sources) stays outside this ADR and
  touches ADR 0001 → its own decision.
