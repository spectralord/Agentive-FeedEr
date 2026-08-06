# ADR 0002 — Decouple ingestion and enrichment

- Status: accepted
- Date: 2026-07-21

## Context / Problem

The only variable cost driver of the tool is LLM usage (tokens per call).
Collecting feeds, on the other hand, is practically free. If every item were sent
through the LLM immediately upon collection, one could easily pay multiple times for the
same item, and cost would be coupled to fetch frequency.

## Decision

The pipeline is split into two separate phases:

1. **Ingestion**: fetch all sources, store new entries as a raw **Raw Item**
   (deduplicated via source ID/link/date). No AI.
2. **Enrichment**: send only **not-yet-enriched** Raw Items through the LLM and
   process them into Reels.

## Alternatives

- **A single combined step** (fetch → enrich immediately): simpler at first
  glance, but expensive (double processing) and harder to control.

## Consequences

- LLM costs are controllable: each item is paid for at most once.
- Raw data is preserved → later re-processing (e.g. "deepen", changed
  prompts, new profile) is possible **without** scraping again.
- Requires a per-Raw-Item state ("enriched yes/no").
