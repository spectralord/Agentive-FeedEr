# ADR 0003 — Structured enrichment in a single LLM pass

- Status: accepted
- Date: 2026-07-21

## Context / Problem

A Reel needs many derived fields: summary, `category`, `maturity`,
`experimental`, `relevance_score`, `quality_score`, a documented example, Action,
effort tag, and `skill` tag. Producing these via multiple specialized LLM calls
multiplies cost and latency. At the same time, the LLM must not invent anything.

## Decision

Every Raw Item is enriched in **one** LLM call with a **strict JSON schema**
(Structured Output). The call returns exactly one validated Reel object. Fields that
cannot be substantiated from the source come back as `null` — not guessed.
The `quality_score` (substance vs. hype) is also produced in **the same**
pass, not as a second call.

## Alternatives

- **Multiple specialized calls** (summarizer, classifier, judge …): cleaner
  single responsibility, but n-times the cost/latency. Unnecessary for a single-user
  daily batch.
- **Free-text output** instead of a JSON schema: more error-prone to parse,
  invites hallucination.

## Consequences

- Cheap and fast: one call per item.
- `null`-instead-of-guessing makes the sourced-only principle (see ADR 0005) technically
  enforceable.
- The JSON object is the stable attachment point for later enrichment (deepening).
- A very large prompt carries a lot of responsibility; schema validation and clear
  field instructions are mandatory.
