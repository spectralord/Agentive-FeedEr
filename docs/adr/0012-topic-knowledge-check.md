# ADR 0012 — Topic knowledge check: corroboration + freshness unified on clustering

- Status: accepted (design; implementation open)
- Date: 2026-07-23
- Touches/supersedes: ADR 0011 (verifier tier 2), Epic 11 (SOTA re-check); builds on
  ADR 0004 (derived views), ADR 0008 (layers, `superseded_by`).

## Context / Problem

Two planned capabilities each compare *one topic across multiple sources*:
- **Corroboration** (formerly verifier tier 2, ADR 0011): how well is a claim
  supported by independent sources → `confidence`.
- **Freshness/supersession** (formerly Epic 11): is there something newer that
  replaces something older (e.g. "parameter `batch` → `fork`") → `superseded_by`/deprecation.

Built separately, they would duplicate the same cluster/cross-comparison logic.

## Decision

Both become **one feature — the "topic knowledge check"** — based on **clustering**
(`topic_cluster` / content model C). It delivers **two outputs** from the same step:
`confidence` and `freshness`/supersession.

- **The unit of computation is the topic cluster** (that is where the comparable sources
  live). `confidence`/`freshness` are **cluster properties** and **propagate** to
  everything referencing items of the cluster (skill nodes, saved Reels, SOTA
  entries) — "your knowledge of X is outdated, see newer" or degree of support. Supersession
  lives on the items via `superseded_by` (ADR 0008), the views derive it (ADR 0004).
- **Clustering is the prerequisite** and is elevated from a vision sketch to a real
  precursor epic (topic clustering). Without clustering the check cannot be built.

## Alternatives

- **Two separate features** (confidence vs. freshness): duplicates cluster logic,
  two viewpoints on the same "what do the sources say, how current is it". Rejected.
- **Compute at the skill node instead of the cluster:** loses the fine-grained claim
  level at which supersession actually happens. Rejected (cluster as unit + propagation).

## Consequences

- Epic 11 becomes the "topic knowledge check"; verifier tier 2 (ADR 0011) folds into this.
  Verifier **tier 1** (Reel `caveat`) remains standalone and buildable without clustering.
- New precursor: **topic clustering epic** (must be built/grilled before the check).
- Open (to be clarified in a grill session on the clustering basis): how is supersession
  detected (LLM contradiction comparison within the cluster + explicit deprecation signals)?
  Auto-apply vs. propose? Cadence (own step/cron)? Definition of "independent/supporting"?
